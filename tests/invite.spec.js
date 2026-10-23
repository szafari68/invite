import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const appHtml=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const reference=fs.readFileSync(new URL('./fixtures/reference.html',import.meta.url),'utf8');
const style=html=>html.match(/<style>\s*([\s\S]*?)<\/style>/)[1];
const fonts=appHtml.match(/<style data-bundled-fonts>[\s\S]*?<\/style>/)[0];

test('reference CSS and all four invitation cards are identical',async({page,context})=>{
 expect(style(appHtml)).toBe(style(reference));
 const ref=await context.newPage();
 await ref.route('**/__reference',route=>route.fulfill({contentType:'text/html',body:reference.replace(/<link href="https:\/\/fonts.googleapis.com\/[^>]+>/,()=>fonts)}));
 await ref.goto('/__reference#'+Buffer.from('سارا').toString('base64url'));
 await page.goto('/?demo=1');
 for(const p of [page,ref]){await p.evaluate(()=>document.fonts.ready);await p.addStyleTag({content:'.tp,.fl,.cf,.lights{display:none!important}*,*::before,*::after{animation:none!important;transition:none!important}'})}
 async function compare(){const expected=await ref.locator('.card').screenshot();const actual=await page.locator('.card').screenshot();expect(actual.equals(expected)).toBeTruthy()}
 await expect(page.getByRole('heading')).toHaveText('سارا، با من میای سر قرار؟');await compare();
 for(const p of [page,ref])await p.locator('#yes').evaluate(el=>el.click());
 for(const p of [page,ref])await expect(p.locator('.day')).toHaveCount(7);await compare();
 for(const p of [page,ref])await p.locator('#nx').evaluate(el=>el.click());await compare();
 for(const p of [page,ref]){await p.locator('[data-f="پاستا"]').evaluate(el=>el.click());await p.locator('#go').evaluate(el=>el.click());await expect(p.getByRole('heading')).toHaveText('خوشحالم نگفتی نه!')}
 await compare();await ref.close();
});

for(const width of [390,1440])test(`single HTML complete invitation and private results at ${width}px`,async({page,browser,request})=>{
 await page.setViewportSize({width,height:900});await page.goto('/');
 await page.locator('#nm').fill('سارا');await page.locator('#mk').click();await expect(page.locator('#owner-link')).toBeVisible();
 const guest=await page.locator('#lk').textContent(),owner=await page.locator('#owner-link').textContent();const id=new URL(guest).searchParams.get('invite');
 expect((await request.get(`/api/invites/${id}/result`)).status()).toBe(403);
 const publicResult=await(await request.get(`/api/invites/${id}`)).json();expect(publicResult.key).toBeUndefined();expect(publicResult.answer).toBeUndefined();
 const context=await browser.newContext({viewport:{width,height:900}});const visitor=await context.newPage();const errors=[];visitor.on('pageerror',e=>errors.push(e.message));await visitor.goto(guest);await visitor.evaluate(()=>document.fonts.ready);
 const before=await visitor.locator('#yes').boundingBox();await visitor.locator('#no').click();await expect(visitor.locator('#yes')).toHaveCSS('transform','matrix(1.45, 0, 0, 1.45, 0, 0)');expect((await visitor.locator('#yes').boundingBox()).width).toBeGreaterThan(before.width);
 await visitor.locator('#yes').click();await expect(visitor.locator('.day')).toHaveCount(7);await expect(visitor.locator('.day.sel')).toHaveCount(1);await visitor.locator('.day').nth(4).click();const chosen=await visitor.locator('.day.sel').innerText();expect(chosen).toMatch(/[۰-۹]/);
 await visitor.locator('#tm').fill('20:30');await visitor.locator('#nx').click();await expect(visitor.locator('#go')).toBeDisabled();await visitor.locator('[data-f="پاستا"]').click();await expect(visitor.locator('[data-f="پاستا"]')).toHaveClass(/sel/);await visitor.locator('#go').click();await expect(visitor.getByRole('heading')).toHaveText('خوشحالم نگفتی نه!');await expect(visitor.locator('.lights')).toBeVisible();await expect(visitor.locator('.cf').first()).toBeAttached();
 await page.goto(owner);await expect(page.locator('.res')).toContainText('آره');await expect(page.locator('.res')).toContainText('۲۰:۳۰');await expect(page.locator('.res')).toContainText('پاستا');await expect(page.locator('.res')).toContainText('۱');
 expect(errors).toEqual([]);expect(await visitor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await context.close();
});

test('server persists intermediate answers, validates answers and escapes names',async({page,request})=>{
 const r=await(await request.post('/api/invites',{data:{name:'<img src=x onerror=alert(1)>',sender:'',message:''}})).json();await page.goto(`/?invite=${r.id}`);await expect(page.getByRole('heading')).toContainText('<img src=x onerror=alert(1)>');expect(await page.locator('#app img').count()).toBe(0);
 expect((await request.post(`/api/invites/${r.id}/answer`,{data:{status:'started',noCount:2}})).status()).toBe(200);
 const owner=await(await request.get(`/api/invites/${r.id}/result`,{headers:{Authorization:`Bearer ${r.key}`}})).json();expect(owner.answer.status).toBe('started');
 expect((await request.post(`/api/invites/${r.id}/answer`,{data:{status:'accepted',date:'2027-02-30',time:'20:30',food:'پاستا'}})).status()).toBe(400);
 expect((await request.post(`/api/invites/${r.id}/answer`,{data:{status:'declined',noCount:-1}})).status()).toBe(400);
});

test('touch hearts, small screens and reduced motion work',async({browser})=>{
 const context=await browser.newContext({viewport:{width:360,height:640},hasTouch:true});const page=await context.newPage();await page.goto('/?demo=1');await page.locator('#no').tap();await expect(page.locator('.tp').first()).toBeAttached();await expect(page.locator('.tp').first()).toHaveCSS('pointer-events','none');
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.locator('#yes').tap();await expect(page.locator('.day')).toHaveCount(7);await page.locator('#nx').tap();await page.locator('[data-f="قهوه"]').tap();await page.locator('#go').tap();await expect(page.getByRole('heading')).toHaveText('خوشحالم نگفتی نه!');await expect(page.locator('.lights,.cf')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await context.close();
});
