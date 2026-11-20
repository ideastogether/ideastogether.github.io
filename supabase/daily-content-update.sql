-- Review and execute in Supabase SQL Editor after approval. Initially paused.
begin;
create table public.daily_content_settings (
 id integer primary key check(id=1), enabled boolean not null default false,
 event_limit integer not null default 5 check(event_limit between 0 and 5),
 game_limit integer not null default 5 check(game_limit between 0 and 5)
);
insert into public.daily_content_settings(id) values(1);
create table public.daily_content_runs (
 day date primary key, started_at timestamptz not null default now(), finished_at timestamptz,
 status text not null default 'running', events integer not null default 0,
 games integer not null default 0, duplicates integer not null default 0, error text
);
create table public.game_cloud_drafts (
 id uuid primary key default gen_random_uuid(), title text not null, payload jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.daily_content_settings enable row level security;
revoke all on public.daily_content_settings from anon, authenticated;
grant select, update on public.daily_content_settings to authenticated;
grant all on public.daily_content_settings to service_role;
create policy daily_admin on public.daily_content_settings to authenticated
 using ((select public.is_admin()) and not (select public.is_suspended()))
 with check ((select public.is_admin()) and not (select public.is_suspended()));
alter table public.daily_content_runs enable row level security;
revoke all on public.daily_content_runs from anon, authenticated;
grant select on public.daily_content_runs to authenticated;
grant all on public.daily_content_runs to service_role;
create policy daily_admin on public.daily_content_runs to authenticated
 using ((select public.is_admin()) and not (select public.is_suspended()))
 with check ((select public.is_admin()) and not (select public.is_suspended()));
alter table public.game_cloud_drafts enable row level security;
revoke all on public.game_cloud_drafts from anon, authenticated;
grant select, insert, update, delete on public.game_cloud_drafts to authenticated;
grant all on public.game_cloud_drafts to service_role;
create policy daily_admin on public.game_cloud_drafts to authenticated
 using ((select public.is_admin()) and not (select public.is_suspended()))
 with check ((select public.is_admin()) and not (select public.is_suspended()));

create function public.claim_daily_content() returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.daily_content_settings where enabled) then return false; end if;
 insert into public.daily_content_runs(day) values((now() at time zone 'Asia/Taipei')::date) on conflict do nothing;
 return found;
end $$;
create function public.finish_daily_content(p_day date,p_events jsonb,p_games jsonb,p_duplicates integer)
returns void language plpgsql security invoker set search_path='' as $$
declare s public.daily_content_settings; r public.daily_content_runs; item jsonb; owner_id uuid;
begin
 select * into s from public.daily_content_settings where id=1 for update;
 select * into r from public.daily_content_runs where day=p_day for update;
 if r.day is null or r.status <> 'running' or p_day<>(now() at time zone 'Asia/Taipei')::date then raise exception 'Invalid run'; end if;
 if not s.enabled then raise exception 'Paused'; end if;
 if jsonb_array_length(p_events)>s.event_limit or jsonb_array_length(p_games)>s.game_limit then raise exception 'Daily quota exceeded'; end if;
 select id into owner_id from public.profiles where is_admin and not suspended order by id limit 1;
 if owner_id is null then raise exception 'No active administrator'; end if;
 for item in select value from jsonb_array_elements(p_events) loop
 insert into public.official_event_drafts(created_by,title,payload,source_url)
 values(owner_id,item->>'title',item,item->>'source_url');
 end loop;
 for item in select value from jsonb_array_elements(p_games) loop
 insert into public.game_cloud_drafts(title,payload) values(item->>'title',item);
 end loop;
 update public.daily_content_runs set status='completed',finished_at=now(),events=jsonb_array_length(p_events),games=jsonb_array_length(p_games),duplicates=p_duplicates where day=p_day;
 delete from public.daily_content_runs where day<p_day-90;
end $$;
revoke all on function public.claim_daily_content() from public,anon,authenticated;
revoke all on function public.finish_daily_content(date,jsonb,jsonb,integer) from public,anon,authenticated;
grant execute on function public.claim_daily_content(),public.finish_daily_content(date,jsonb,jsonb,integer) to service_role;
-- Atomic review submission; existing games insert RLS enforces ownership and pending state.
create function public.submit_game_cloud_draft(p_id uuid) returns void language plpgsql security invoker set search_path='' as $$
declare d public.game_cloud_drafts; g jsonb;
begin
 if not public.is_admin() or public.is_suspended() then raise exception 'Admin only'; end if;
 select * into d from public.game_cloud_drafts where id=p_id for update;
 if d.id is null then raise exception 'Draft missing or already submitted'; end if;
 g=d.payload;
 insert into public.games(author_id,title,how,age,materials,tags,photos,duration_label,status)
 values(auth.uid(),g->>'title',g->>'how',(g->>'age')::integer,
 array(select jsonb_array_elements_text(g->'materials')),array(select jsonb_array_elements_text(g->'tags')),
 '{}'::text[],g->>'duration_label','pending');
 delete from public.game_cloud_drafts where id=p_id;
end $$;
revoke all on function public.submit_game_cloud_draft(uuid) from public,anon;
grant execute on function public.submit_game_cloud_draft(uuid) to authenticated;
commit;
