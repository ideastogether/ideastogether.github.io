// Run with: GAME_SNAPSHOT=/tmp/ideastogether-games.json node tests/phase-one-browser.cjs
// All API responses are isolated fixtures; this never writes to production.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 if(!process.env.GAME_SNAPSHOT)throw Error('Set GAME_SNAPSHOT to the read-only game snapshot JSON');
 const games=JSON.parse(fs.readFileSync(process.env.GAME_SNAPSHOT,'utf8'));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const errors=[],writes=[];
 const context=await browser.newContext({ignoreHTTPSErrors:true});
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='localhost')return route.continue();
  if(u.hostname==='cdn.jsdelivr.net')return route.fulfill({contentType:'application/javascript',body:fs.readFileSync('/tmp/ideastogether-supabase.js','utf8')});
  if(u.hostname!=='impuxatitpghslleasma.supabase.co')return route.fulfill({status:200,body:''});
  let body=[];
  if(u.pathname==='/rest/v1/games'){if(route.request().method()==='POST'){writes.push(route.request().postDataJSON());body=null}else body=games;}
  else if(u.pathname==='/rest/v1/profiles')body={id:'test-member',nickname:'測試家長',account_type:'personal',is_admin:false,suspended:false};
  else if(u.pathname.endsWith('increment_content_view'))body=1;
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:900});
  await page.goto('http://localhost:4173/');
  await page.getByRole('heading',{name:'今天想陪孩子玩什麼？'}).waitFor();
  assert.ok(await page.locator('#app').innerText().then(t=>t.indexOf('每日遊戲推薦')<t.indexOf('近期親子活動')));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`home overflow at ${width}`);
  assert.ok(await page.locator('.daily-game').evaluate(el=>el.getBoundingClientRect().width>=document.querySelector('#app').getBoundingClientRect().width-2));
  assert.ok(await page.locator('.daily-game .c').evaluate(el=>el.getBoundingClientRect().width>=document.querySelector('.daily-game').getBoundingClientRect().width-2));
  await page.screenshot({path:`/tmp/phase1-home-${width}.png`,fullPage:true});
  await page.locator('.pick[href="#/games/today"]').click();
  await page.locator('#recommend-form').waitFor();
  await page.locator('[name=age]').selectOption('3');await page.locator('[name=time]').selectOption('15');
  await page.locator('#recommend-form [type=submit]').click();
  const actual=await page.locator('#recommend-results article').count();assert.ok(actual>0&&actual<=3);
  await page.getByRole('button',{name:'重新推薦'}).click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`recommend overflow at ${width}`);
  await page.screenshot({path:`/tmp/phase1-recommend-${width}.png`,fullPage:true});
  await page.locator('[name=age]').selectOption('0');await page.locator('[name=time]').selectOption('5');await page.locator('[name=scene]').selectOption('戶外');
  await page.getByRole('button',{name:'重新推薦'}).click();
  assert.equal(await page.locator('#recommend-results article').count(),0);
  assert.match(await page.locator('#recommend-status').innerText(),/沒有符合所有條件/);
  await page.goto('http://localhost:4173/#/games/materials');await page.locator('#recommend-form').waitFor();
  assert.equal(await page.locator('[name=limitMaterials]').isChecked(),true);
  await page.locator('#recommend-form [type=submit]').click();
  const noMaterial=games.filter(g=>g.materials.length===0).length;assert.equal(await page.locator('#recommend-results article').count(),Math.min(3,noMaterial));
  await page.goto('http://localhost:4173/#/games');await page.locator('#q').waitFor();
  await page.locator('.browse-filters summary').click();await page.getByRole('button',{name:'紙杯',exact:true}).click();
  assert.ok(await page.locator('#gl article').count()>0);
  await page.getByRole('button',{name:'清除所有篩選'}).first().click();assert.equal(await page.locator('#gl article').count(),14);
  await page.goto('http://localhost:4173/#/games/g/'+games[0].id);await page.getByRole('heading',{name:games[0].title,exact:true}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'家長引導技巧',exact:true}).count(),0);
  for(const name of ['☆ 收藏 0','我們玩過了','分享連結'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),1);
  await page.getByRole('button',{name:'☆ 收藏 0',exact:true}).click();await page.locator('#md.s').waitFor();await page.getByRole('button',{name:'關閉',exact:true}).click();
  console.log(`PASS ${width}px: home, recommendations, reroll, no match, materials, search filters, detail, login gate`);
 }
 // Optional metadata and ability filtering use a local augmented fixture only.
 games[0].abilities=['手眼協調'];games[0].simple_how='先用一個紙杯';games[0].parent_tips='<script>測試安全編碼</script>';
 await page.evaluate(()=>G.reset());await page.goto('http://localhost:4173/#/games');await page.locator('#q').waitFor();if(!await page.locator('.browse-filters').evaluate(el=>el.open))await page.locator('.browse-filters summary').click();
 await page.getByRole('button',{name:'手眼協調',exact:true}).click();assert.equal(await page.locator('#gl article').count(),1);
 await page.goto('http://localhost:4173/#/games/g/'+games[0].id);await page.getByRole('heading',{name:'家長引導技巧',exact:true}).waitFor();
 assert.match(await page.locator('.game-detail-copy').last().innerText(),/<script>/);
 await page.evaluate(()=>setUser({user:{id:'test-member'}}));
 await page.getByRole('button',{name:'測試家長',exact:true}).waitFor();
 await page.goto('http://localhost:4173/#/games');await page.getByRole('button',{name:'＋ 分享遊戲'}).click();
 await page.locator('#game-ft').waitFor();await page.locator('#game-ft').fill('共玩測試');
 await page.getByRole('button',{name:/下一步/}).click();
 await page.locator('#game-fh').fill('第一步一起玩');await page.locator('#md details').last().locator('summary').click();
 await page.locator('#game-abilities').fill('手眼協調');await page.locator('#game-parent_tips').fill('一起觀察孩子反應');
 await page.getByRole('button',{name:/下一步/}).click();await page.getByRole('button',{name:/上一步/}).click();
 assert.equal(await page.locator('#game-parent_tips').inputValue(),'一起觀察孩子反應');
 await page.getByRole('button',{name:/下一步/}).click();await page.getByRole('button',{name:'送出審核',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('#md.s'));
 assert.equal(writes.length,1);assert.equal(writes[0].status,'pending');assert.deepEqual(writes[0].abilities,['手眼協調']);assert.equal(writes[0].parent_tips,'一起觀察孩子反應');assert.equal(writes[0].simple_how,null);
 assert.deepEqual(errors,[]);console.log('PASS ability filter, optional metadata, HTML escaping, member posting wizard; no JS errors');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
