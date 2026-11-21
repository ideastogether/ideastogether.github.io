const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
await (await import('node:fs/promises')).mkdir('/tmp/activity-review-qa',{recursive:true});const results=[];
for(const width of [320,390,430]){
const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
await page.route('**/*',async route=>{const url=route.request().url();if(url.includes('cdn.jsdelivr.net'))return route.fulfill({contentType:'text/javascript',body:`window.testWrites=[];window.supabase={createClient(){return {auth:{getUser:async()=>({data:{user:{id:'mock'}}})},from(table){let update;const q={select(){return q},eq(){return q},order(){return q},range(){return q},limit(){return q},single(){return q},insert(v){update=v;return q},update(v){update=v;return q},then(resolve){if(update)window.testWrites.push(update);return Promise.resolve({data:table==='profiles'?{is_admin:true,suspended:false}:table==='events'?[]:[{id:'mock',title:'活動測試草稿',payload:{description:'官方活動測試內容',fee:0,title:'活動測試草稿',city:'臺南市',start_at:'2026-12-01T10:00:00+08:00',link:'https://example.org/test'}}],error:null}).then(resolve)}};return q}}}};`});
const path=new URL(url).pathname.slice(1);assert.ok(path.startsWith('admin/')&&!path.includes('..'));return route.fulfill({contentType:path.endsWith('.html')?'text/html':'text/javascript',body:await readFile(root+path,'utf8')});});
await page.goto('https://mobile.test/admin/ai-import.html');await page.getByRole('button',{name:'線上編輯',exact:true}).click();await page.getByRole('textbox',{name:'活動名稱',exact:true}).fill('手機活動編輯');await page.getByRole('button',{name:'儲存到雲端',exact:true}).click();await page.waitForFunction(()=>window.testWrites.length>0);
await page.getByRole('button',{name:'確認內容並送審',exact:true}).click();await page.getByText('請先核對原始公告，並勾選確認。',{exact:true}).waitFor();await page.locator('#draft-source-verified').check();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'確認內容並送審',exact:true}).click();await page.getByText('建立完成：1 筆待審核、0 筆失敗。請回管理後台審核，失敗時請確認欄位格式與權限。',{exact:true}).waitFor();
const layout=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,id:e.id})),saved:window.testWrites[0].payload.title==='手機活動編輯'}));results.push({page:'activity',width,...layout});await page.screenshot({path:'/tmp/activity-review-qa/activity-'+width+'.png',fullPage:true});await page.close();
}
await browser.close();console.log(JSON.stringify(results));
