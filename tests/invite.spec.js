import {persianParts} from '../calendar.js';
import {test,expect} from '@playwright/test';
for(const width of [390,1440])test(`personal invitation and private results at ${width}px`,async({page,browser,request})=>{
 await page.setViewportSize({width,height:900});
 await page.goto('/');await page.locator('#recipient').fill('سارا');await page.locator('#sender').fill('علی');await page.locator('#message').fill('یه قهوه با هم؟');await page.getByRole('button',{name:'دعوت مخصوصمون رو بساز'}).click();
 await expect(page.locator('#guest-link')).toBeVisible();const guest=await page.locator('#guest-link').inputValue();const management=await page.locator('#manage-link').inputValue();
 const id=new URL(guest).searchParams.get('invite');
 expect((await request.get(`/api/invites/${id}/result`)).status()).toBe(403);
 const publicData=await (await request.get(`/api/invites/${id}`)).json();expect(publicData.key).toBeUndefined();expect(publicData.answer).toBeUndefined();
 const context=await browser.newContext({viewport:{width,height:900}});const visitor=await context.newPage();const errors=[];visitor.on('pageerror',e=>errors.push(e.message));await visitor.goto(guest);
 await expect(visitor.getByRole('heading')).toContainText('سارا جان');await expect(visitor.getByText('یه قهوه با هم؟')).toBeVisible();
 let height=(await visitor.locator('#yes').boundingBox()).height;
 for(let i=0;i<3;i++){await visitor.locator('#no').click();const next=(await visitor.locator('#yes').boundingBox()).height;expect(next).toBeGreaterThan(height);height=next;}
 expect(await visitor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await expect(visitor.locator('.content')).toHaveCSS('opacity','1');await visitor.screenshot({path:`/workspace/exports/invitation-reference-${width}.png`,fullPage:true});
 await visitor.locator('#yes').click();await expect(visitor.locator('#date-next')).toBeDisabled();const jp=persianParts('2027-12-25');await visitor.getByLabel('سال شمسی').selectOption(String(jp.year));await visitor.getByLabel('ماه شمسی').selectOption(String(jp.month));await visitor.locator('[data-date="2027-12-25"]').click();await expect(visitor.locator('#date')).toHaveValue('2027-12-25');await expect(visitor.locator('.calendar-selection')).toContainText('دی');await expect(visitor.locator('.content')).toHaveCSS('opacity','1');await visitor.screenshot({path:`/workspace/exports/persian-calendar-${width}.png`,fullPage:true});await visitor.locator('#time').fill('20:30');await visitor.getByRole('button',{name:'بریم مرحلهٔ بعد'}).click();await expect(visitor.locator('#confirm')).toBeDisabled();await visitor.getByRole('button',{name:/پاستا/}).click();await expect(visitor.locator('.touch-heart').first()).toBeAttached();await expect(visitor.locator('.content')).toHaveCSS('opacity','1');await visitor.screenshot({path:`/workspace/exports/food-selection-${width}.png`,fullPage:true});await visitor.locator('#confirm').click();await expect(visitor.getByRole('heading')).toHaveText('خوشحالم نگفتی نه!');
 await expect(visitor.locator('body')).toHaveClass(/final-celebration/);await expect(visitor.locator('.celebration-lights')).toBeVisible();expect(await visitor.locator('.celebration-lights').evaluate(el=>getComputedStyle(el).pointerEvents)).toBe('none');await expect(visitor.locator('.celebration-lights')).toHaveCSS('opacity','1');await visitor.screenshot({path:`/workspace/exports/final-reference-${width}.png`,fullPage:true});await visitor.getByRole('button',{name:'ویرایش قرار'}).click();await expect(visitor.locator('body')).not.toHaveClass(/final-celebration/);await page.goto(management);await page.reload();await expect(page.getByText('جوابش آره بود! یه قرار قشنگ در راهه.')).toBeVisible();await expect(page.locator('.result-ticket')).toContainText('20:30');await expect(page.locator('.result-ticket')).toContainText('پاستا');expect(errors).toEqual([]);await context.close();
});
test('untrusted names render as text and malformed answers rejected',async({request,page})=>{
 const created=await request.post('/api/invites',{data:{name:'<img src=x onerror=alert(1)>',sender:'',message:'<script>alert(1)</script>'}});const r=await created.json();await page.goto(`/?invite=${r.id}`);await expect(page.getByRole('heading')).toContainText('<img src=x onerror=alert(1)>');expect(await page.locator('.content img').count()).toBe(0);
 expect((await request.post(`/api/invites/${r.id}/answer`,{data:{status:'accepted',date:'bad',time:'29:99',food:'پاستا'}})).status()).toBe(400);
});

test('touch effects and reduced motion remain usable',async({browser})=>{
 const context=await browser.newContext({viewport:{width:360,height:800},hasTouch:true,reducedMotion:'reduce'});const page=await context.newPage();await page.goto('/?demo=1');await page.locator('#yes').tap();await expect(page.locator('.touch-heart')).toHaveCount(1);await expect(page.locator('.touch-heart')).toHaveCSS('pointer-events','none');await expect(page.locator('#persian-calendar')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await context.close();
});
