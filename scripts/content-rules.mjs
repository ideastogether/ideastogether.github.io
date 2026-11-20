import {prepareCandidate} from '../admin/official-discovery.js';
export const taiwanDay=(now=Date.now())=>new Date(now+28800000).toISOString().slice(0,10);
export const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
export const gameSignature=g=>norm([...(g.materials||[])].sort().join(''))+'|'+norm(g.how);
export function similarGame(a,b){
 if(norm(a.title)===norm(b.title)||gameSignature(a)===gameSignature(b))return true;
 const grams=s=>new Set(Array.from({length:Math.max(0,s.length-2)},(_,i)=>s.slice(i,i+3)));
 const x=grams(norm(a.how)),y=grams(norm(b.how));
 return x.size&&y.size&&[...x].filter(v=>y.has(v)).length/Math.min(x.size,y.size)>.65;
}
export function eligible(row,now=Date.now()){
 const today=taiwanDay(now), horizon=new Date(today+'T00:00:00Z');
 const day=horizon.getUTCDate();horizon.setUTCDate(1);horizon.setUTCMonth(horizon.getUTCMonth()+3);
 const last=new Date(Date.UTC(horizon.getUTCFullYear(),horizon.getUTCMonth()+1,0)).getUTCDate();horizon.setUTCDate(Math.min(day,last));
 const r=prepareCandidate(row,now),d=row.details||{};
 if(!r||!r.officialOrganizer||!r.candidate.title||!row.venue||!row.audience_evidence||!d.description||!d.schedule?.length)return null;
 if(row.first_day<today||row.first_day>horizon.toISOString().slice(0,10)||/full|cancelled/.test(d.booking_status||'')||/已額滿|已取消/.test(d.description))return null;
 // No invented midnight, registration state or registration URL.
 if(!d.schedule.some(s=>s.d===row.first_day&&/^\d{2}:\d{2}$/.test(s.s||''))||!['open','walkin','upcoming','waitlist'].includes(d.booking_status))return null;
 if(d.booking_status!=='walkin'&&!d.registration_url)return null;
 return {...r.candidate,booking_status:d.booking_status,source_url:row.source_url,registration_url:d.registration_url||null};
}
