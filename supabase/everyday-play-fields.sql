-- Phase one: optional metadata only. Existing rows and policies are preserved.
alter table public.games
  add column if not exists abilities text[],
  add column if not exists difficulty text,
  add column if not exists players text,
  add column if not exists simple_how text,
  add column if not exists advanced_how text,
  add column if not exists parent_tips text,
  add column if not exists safety_notes text;
