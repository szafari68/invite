import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const dataDir=process.env.DATA_DIR||path.join(root,'.data');fs.mkdirSync(dataDir,{recursive:true,mode:0o700});
const file=path.join(dataDir,'invitations.json');
let records=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
function save(){fs.writeFileSync(file+'.tmp',JSON.stringify(records),{mode:0o600});fs.renameSync(file+'.tmp',file)}
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))};
async function body(req){let s='';for await(const chunk of req){s+=chunk;if(Buffer.byteLength(s)>4096)throw new Error('large')}return JSON.parse(s)}
function authorized(req,r){const key=(req.headers.authorization||'').replace(/^Bearer /,'');return key.length===r.key.length&&timingSafeEqual(Buffer.from(key),Buffer.from(r.key))}
const publicRecord=r=>({id:r.id,name:r.name,sender:r.sender,message:r.message});
const server=http.createServer(async(req,res)=>{
 try{
 const u=new URL(req.url,'http://localhost');const parts=u.pathname.split('/').filter(Boolean);
 if(u.pathname.startsWith('/api/')){
 if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`&&!(process.env.NODE_ENV!=='production'&&['http://127.0.0.1:5173','http://localhost:5173'].includes(req.headers.origin)))return send(res,403,{error:'درخواست مجاز نیست'});
 if(req.method==='POST'&&u.pathname==='/api/invites'){
 const b=await body(req);if(typeof b.name!=='string'||!b.name.trim()||b.name.length>60||typeof b.sender!=='string'||b.sender.length>60||typeof b.message!=='string'||b.message.length>300)return send(res,400,{error:'اسم و پیام را بررسی کن'});
 const id=randomBytes(16).toString('hex'),key=randomBytes(32).toString('hex');const r={id,key,name:b.name.trim(),sender:b.sender.trim(),message:b.message.trim(),createdAt:new Date().toISOString(),answer:null};records[id]=r;save();return send(res,201,{...publicRecord(r),key});
 }
 const r=records[parts[2]];if(!r)return send(res,404,{error:'دعوت پیدا نشد'});
 if(req.method==='GET'&&parts.length===3)return send(res,200,publicRecord(r));
 if(req.method==='GET'&&parts[3]==='result'){if(!authorized(req,r))return send(res,403,{error:'لینک مدیریت معتبر نیست'});return send(res,200,{...publicRecord(r),createdAt:r.createdAt,answer:r.answer})}
 if(req.method==='POST'&&parts[3]==='answer'){
 const b=await body(req);if(!['accepted','declined'].includes(b.status))return send(res,400,{error:'پاسخ معتبر نیست'});
 if(b.noCount!==undefined&&(!Number.isInteger(b.noCount)||b.noCount<0||b.noCount>10000))return send(res,400,{error:'تعداد پاسخ معتبر نیست'});
 if(b.status==='accepted'){
 if(typeof b.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||!Number.isFinite(Date.parse(b.date))||typeof b.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time)||!['پیتزا','قهوه','پاستا','کوبیده'].includes(b.food))return send(res,400,{error:'جزئیات قرار کامل نیست'});
 }
 r.answer={status:b.status,...(b.noCount!==undefined?{noCount:b.noCount}:{}),...(b.status==='accepted'?{date:b.date,time:b.time,food:b.food}:{}),updatedAt:new Date().toISOString()};save();return send(res,200,{ok:true});
 }
 return send(res,405,{error:'درخواست پشتیبانی نمی‌شود'});
 }
 if(process.env.NODE_ENV!=='production'){return send(res,404,{error:'Use the Vite development server'})}
 const dist=path.join(root,'dist');const requested=path.resolve(dist,'.'+decodeURIComponent(u.pathname));if(!requested.startsWith(dist+path.sep)&&requested!==dist)return send(res,403,{});
 const target=fs.existsSync(requested)&&fs.statSync(requested).isFile()?requested:path.join(dist,'index.html');const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.woff':'font/woff','.woff2':'font/woff2'};
 res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});fs.createReadStream(target).pipe(res);
 }catch{send(res,400,{error:'ذخیره انجام نشد؛ دوباره تلاش کن'})}
 });
server.on('error',error=>{
 if(error.code==='EADDRINUSE'&&process.env.NODE_ENV==='development'&&process.env.DEV_PORT_FALLBACK==='1'){
  console.warn('Requested API port is occupied; selecting a free port.');
  server.listen(0,'0.0.0.0');
 }else{
  console.error(`API could not start: ${error.message}`);
  process.exitCode=1;
  if(process.connected)process.disconnect();
 }
});
server.on('listening',()=>{
 const port=server.address().port;
 if(process.send)process.send({type:'ready',port});
});
server.listen(Number(process.env.API_PORT||3001),'0.0.0.0');
