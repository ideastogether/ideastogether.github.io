import {readFile} from 'node:fs/promises';
import {taiwanDay,eligible,similarGame} from './content-rules.mjs';
const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!base||!key){console.error('Missing GitHub Secrets: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');process.exit(1)}
let requests=0;
async function api(path,method='GET',body){
 if(++requests>35)throw Error('Request budget exceeded');
 const r=await fetch(base+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Database request failed: '+r.status);return r.status===204?null:r.json();
}
const day=taiwanDay();let claimed=false;
try{
 const settings=(await api('daily_content_settings?id=eq.1'))[0];
 if(!settings?.enabled){console.log('Daily update paused');process.exit(0)}
 const claim=await api('rpc/claim_daily_content','POST',{});
 if(!claim){console.log('Taiwan date already attempted');process.exit(0)}claimed=true;
 // Read-only existing discovery cache; never invoke the existing potentially expensive search function.
 const rows=await api('web_activity_candidates?select=*&order=found_at.desc&limit=200');
 const events=await api('events?select=title,city,link,start_at&limit=1001');
 const drafts=await api('official_event_drafts?select=title,payload,source_url&limit=1001');
 const games=await api('games?select=title,how,materials,age&limit=1001');
 const gd=await api('game_cloud_drafts?select=payload&limit=1001');
 if([events,drafts,games,gd].some(x=>x.length>1000))throw Error('Duplicate-check budget exceeded; pause and review');
 let duplicates=0;const counts={},ages={};
 events.forEach(e=>counts[e.city]=(counts[e.city]||0)+1);
 const known=[...games,...gd.map(x=>x.payload)];known.forEach(g=>ages[g.age]=(ages[g.age]||0)+1);
 const chosen=[];
 for(const r of rows.map(r=>eligible(r)).filter(Boolean).sort((a,b)=>(counts[a.city]||0)-(counts[b.city]||0))){
 if([...events,...drafts.map(d=>({...d.payload,link:d.source_url})),...chosen].some(e=>e.link===r.link||(e.title===r.title&&e.city===r.city))){duplicates++;continue}
 if(chosen.length<Math.min(5,settings.event_limit))chosen.push(r);
 }
 const library=JSON.parse(await readFile(new URL('./game-library.json',import.meta.url)));
 const selected=[];
 for(const g of library.sort((a,b)=>(ages[a.age]||0)-(ages[b.age]||0))){
 if([...known,...selected].some(e=>similarGame(e,g))){duplicates++;continue}
 if(selected.length<Math.min(5,settings.game_limit))selected.push(g);
 }
 await api('rpc/finish_daily_content','POST',{p_day:day,p_events:chosen,p_games:selected,p_duplicates:duplicates});
 console.log(JSON.stringify({day,events:chosen.length,games:selected.length,duplicates,requests}));
}catch(e){
 console.error(e.message);
 if(claimed)try{await api('daily_content_runs?day=eq.'+day,'PATCH',{status:'failed',error:e.message,finished_at:new Date().toISOString()})}catch{console.error('Cloud log unavailable; see Actions log')}
 process.exitCode=1;
}
