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
 await visitor.screenshot({path:`/tmp/invite-personal-${width}.png`,fullPage:true});
 await visitor.locator('#yes').click();await visitor.locator('#date').fill('2027-12-25');await visitor.locator('#time').fill('20:30');await visitor.getByRole('button',{name:'بریم مرحلهٔ بعد'}).click();await expect(visitor.locator('#confirm')).toBeDisabled();await visitor.getByRole('button',{name:/پاستا/}).click();await visitor.locator('#confirm').click();await expect(visitor.getByRole('heading')).toHaveText('پس شد یه قرار دو نفره!');
 await page.goto(management);await page.reload();await expect(page.getByText('جوابش آره بود! یه قرار قشنگ در راهه.')).toBeVisible();await expect(page.locator('.result-ticket')).toContainText('20:30');await expect(page.locator('.result-ticket')).toContainText('پاستا');expect(errors).toEqual([]);await context.close();
});
test('untrusted names render as text and malformed answers rejected',async({request,page})=>{
 const created=await request.post('/api/invites',{data:{name:'<img src=x onerror=alert(1)>',sender:'',message:'<script>alert(1)</script>'}});const r=await created.json();await page.goto(`/?invite=${r.id}`);await expect(page.getByRole('heading')).toContainText('<img src=x onerror=alert(1)>');expect(await page.locator('.content img').count()).toBe(0);
 expect((await request.post(`/api/invites/${r.id}/answer`,{data:{status:'accepted',date:'bad',time:'29:99',food:'پاستا'}})).status()).toBe(400);
});
