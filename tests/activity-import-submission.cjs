// Isolated browser regression: node tests/activity-import-submission.cjs
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const row=(id,title)=>({title,source_url:`https://www.gov.taipei/events/${id}`,first_day:'2027-01-01',city:'台北市',venue:'圖書館',organizer:'公共圖書館',details:{description:'親子共讀活動',fee_note:'免費',schedule:[{d:'2027-01-01',s:'10:00',e:'11:00'}]}});
const candidate=r=>({title:r.title,link:r.source_url,start_at:'2027-01-01T10:00:00+08:00',city:r.city,venue:r.venue,shared_organizer:r.organizer,description:r.details.description,fee:0});
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  for(const width of [390,1280]){
   const sources=[row('new','尚未送審的親子活動'),row('pending','已送審的親子活動'),row('approved','已上架的親子活動'),row('draft','草稿中的親子活動')];
   let seed={sources,events:[...Array.from({length:501},(_,i)=>({id:String(i).padStart(4,'0'),title:'其他活動',city:'高雄市'})),{id:'pending',...candidate(sources[1]),author_id:'other-admin',status:'pending'},{id:'approved',...candidate(sources[2]),status:'approved'}],drafts:[{id:'draft-1',title:sources[3].title,payload:candidate(sources[3])},{id:'stale-draft',title:sources[1].title,payload:candidate(sources[1])}],writes:[],failInsert:false,failRead:false,failDelete:false,ranges:[]};
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.pathname.startsWith('/admin/'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync('.'+url.pathname,'utf8')});
    return route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><div id="root"></div><script type="module">
     import {mountActivityImport} from '/admin/activity-import.js';
     window.backend=${JSON.stringify(seed)};
     window.submitted=0;
     const sb={functions:{invoke:async()=>({data:{rows:backend.sources}})},from(table){
      let op='select',values,filters=[],single=false,range;
      const q={select(){return q},order(){return q},limit(){return q},range(a,b){range=[a,b];return q},
       eq(k,v){filters.push([k,v]);return q},in(k,vs){filters.push([k,vs]);return q},
       insert(v){op='insert';values=v;return q},delete(){op='delete';return q},
       single(){single=true;return q},maybeSingle(){single=true;return q},
       then(resolve,reject){return Promise.resolve().then(()=>{
        if(table==='events'&&op==='select'&&backend.failRead)return {error:{message:'read failed'}};
        if(op==='insert'&&backend.failInsert)return {error:{message:'insert failed'}};
        if(op==='delete'&&backend.failDelete)return {error:{message:'delete failed'}};
        let rows=table==='events'?backend.events:backend.drafts;
        const matches=r=>filters.every(([k,v])=>Array.isArray(v)?v.includes(r[k]):r[k]===v);
        if(op==='insert'){const value={id:'inserted-'+backend.writes.length,...values};rows.push(value);backend.writes.push(value);return {data:[value]}}
        if(op==='delete'){backend.drafts=rows.filter(r=>!matches(r));return {data:[]}}
        let data=rows.filter(matches);
        if(range){backend.ranges.push(range);data=data.slice(range[0],range[1]+1)}
        return {data:single?data[0]||null:data};
       }).then(resolve,reject)}
      };return q;
     }};
     mountActivityImport(document.querySelector('#root'),{sb,userId:'admin',cities:['台北市','高雄市'],canManage:()=>true,onSubmitted(){submitted++}});
    </script>`});
   });
   const results=page.locator('#activity-results [data-result]');
   const submit=async()=>{await page.check('[name=verified]');await page.click('button[type=submit]')};
   const waitSearch=()=>page.waitForFunction(()=>document.querySelector('#activity-count').textContent.startsWith('找到'));
   await page.goto('https://app.test/');await waitSearch();
   assert.equal(await results.count(),2,'pending and approved events are excluded, including later pages and other admins');
   assert.ok(await page.evaluate(()=>backend.ranges.some(([a])=>a===500)));
   await results.first().click();
   await page.fill('[name=title]','核對後修改的活動名稱');
   await submit();
   await page.waitForFunction(()=>submitted===1);
   assert.equal(await results.count(),1,'successful submission immediately removes the original search result');
   assert.equal(await page.evaluate(()=>backend.writes.length),1);
   assert.equal(await page.evaluate(()=>backend.writes[0].status),'pending');
   await page.click('#activity-refresh');await waitSearch();
   assert.equal(await results.count(),1,'refresh keeps submitted events hidden despite title/time serialization changes');
   seed=await page.evaluate(()=>backend);await page.reload();await waitSearch();
   assert.equal(await results.count(),1,'reload persists exclusion using database records');
   await page.click('[data-import-view=drafts]');
   assert.equal(await page.locator('[data-edit]').count(),1,'stale submitted drafts are hidden');
   await page.click('[data-edit]');
   await page.evaluate(()=>backend.failInsert=true);await submit();
   await page.waitForFunction(()=>document.querySelector('[data-editor-status]').textContent.includes('insert failed'));
   assert.equal(await page.locator('#activity-editor').isVisible(),true,'failed submission stays editable');
   await page.click('[data-editor-back]');
   assert.equal(await page.locator('[data-edit]').count(),1,'failed submission retains its draft');
   await page.click('[data-import-view=search]');
   assert.equal(await results.count(),1,'failed submission retains its search result');
   await page.click('[data-import-view=drafts]');await page.click('[data-edit]');
   await page.evaluate(()=>{backend.failInsert=false;backend.failDelete=true});await submit();
   await page.waitForFunction(()=>submitted===1);
   assert.equal(await page.locator('[data-edit]').count(),0,'cleanup failure does not leave a resubmittable draft');
   await page.click('[data-import-view=search]');
   assert.equal(await results.count(),0);
   seed=await page.evaluate(()=>backend);await page.reload();await waitSearch();
   assert.equal(await results.count(),0);
   await page.click('[data-import-view=drafts]');assert.equal(await page.locator('[data-edit]').count(),0);
   seed.failRead=true;await page.reload();
   await page.waitForFunction(()=>document.querySelector('#activity-count').textContent.includes('比對已送審活動失敗'));
   assert.equal(await results.count(),0,'failed duplicate lookup must not show unfiltered search results');
   assert.deepEqual(errors,[]);
   await page.close();
   console.log('PASS '+width+'px: submission, refresh/reload, pagination, existing events, failed writes, stale drafts and query failure');
  }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
