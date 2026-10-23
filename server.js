import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const dataDir=process.env.DATA_DIR||path.join(root,'.data');
fs.mkdirSync(dataDir,{recursive:true,mode:0o700});
const file=path.join(dataDir,'invitations.json');
const records=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
const index=process.argv.indexOf('--port');
const port=Number(index>=0?process.argv[index+1]:process.env.PORT||process.env.API_PORT||5173);
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Port must be between 0 and 65535.');
function save(){fs.writeFileSync(file+'.tmp',JSON.stringify(records),{mode:0o600});fs.renameSync(file+'.tmp',file)}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>4096)throw new Error('Request too large')}return JSON.parse(text)}
function authorized(req,record){const key=(req.headers.authorization||'').replace(/^Bearer /,'');const actual=Buffer.from(key),expected=Buffer.from(record.key);return actual.length===expected.length&&timingSafeEqual(actual,expected)}
function publicRecord(r){return {id:r.id,name:r.name,sender:r.sender,message:r.message}}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/healthz')return send(res,200,{ok:true});
  if(url.pathname.startsWith('/api/')){
   if(req.headers.origin&&![`http://${req.headers.host}`,`https://${req.headers.host}`].includes(req.headers.origin))return send(res,403,{error:'درخواست مجاز نیست'});
   if(req.method==='POST'&&url.pathname==='/api/invites'){
    const b=await body(req);
    if(typeof b.name!=='string'||!b.name.trim()||b.name.length>60||typeof b.sender!=='string'||b.sender.length>60||typeof b.message!=='string'||b.message.length>300)return send(res,400,{error:'اسم و پیام را بررسی کن'});
    const id=randomBytes(16).toString('hex'),key=randomBytes(32).toString('hex');
    const record={id,key,name:b.name.trim(),sender:b.sender.trim(),message:b.message.trim(),createdAt:new Date().toISOString(),answer:null};
    records[id]=record;save();return send(res,201,{...publicRecord(record),key});
   }
   const match=url.pathname.match(/^\/api\/invites\/([a-f0-9]{32})(?:\/(result|answer))?$/);
   const record=match&&records[match[1]];
   if(!record)return send(res,404,{error:'دعوت پیدا نشد'});
   if(req.method==='GET'&&!match[2])return send(res,200,publicRecord(record));
   if(req.method==='GET'&&match[2]==='result'){
    if(!authorized(req,record))return send(res,403,{error:'لینک مدیریت معتبر نیست'});
    return send(res,200,{...publicRecord(record),createdAt:record.createdAt,answer:record.answer});
   }
   if(req.method==='POST'&&match[2]==='answer'){
    const b=await body(req);
    if(!['accepted','declined','started'].includes(b.status))return send(res,400,{error:'پاسخ معتبر نیست'});
    if(b.noCount!==undefined&&(!Number.isInteger(b.noCount)||b.noCount<0||b.noCount>10000))return send(res,400,{error:'تعداد پاسخ معتبر نیست'});
    if(b.status==='accepted'){
     if(typeof b.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||!Number.isFinite(Date.parse(b.date))||new Date(b.date).toISOString().slice(0,10)!==b.date||typeof b.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time)||!['پیتزا','قهوه','پاستا','کوبیده'].includes(b.food))return send(res,400,{error:'جزئیات قرار کامل نیست'});
    }
    record.answer={status:b.status,...(b.noCount!==undefined?{noCount:b.noCount}:{}),...(b.status==='accepted'?{date:b.date,time:b.time,food:b.food}:{}),updatedAt:new Date().toISOString()};
    save();return send(res,200,{ok:true});
   }
   return send(res,405,{error:'درخواست پشتیبانی نمی‌شود'});
  }
  if(!['/','/index.html'].includes(url.pathname))return send(res,404,{error:'صفحه پیدا نشد'});
  if(!['GET','HEAD'].includes(req.method))return send(res,405,{});
  const html=fs.readFileSync(path.join(root,'index.html'));
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Length':html.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
  res.end(req.method==='HEAD'?undefined:html);
 }catch{send(res,400,{error:'ذخیره انجام نشد؛ دوباره تلاش کن'})}
});
server.on('error',error=>{
 if(error.code==='EADDRINUSE'&&process.env.DEV_PORT_FALLBACK==='1'&&!process.argv.includes('--strictPort')){
  console.warn('Requested port is occupied; selecting a free port.');server.listen(0,'0.0.0.0');
 }else{console.error(`Server could not start: ${error.message}`);process.exitCode=1;if(process.connected)process.disconnect()}
});
server.on('listening',()=>{const actual=server.address().port;console.log(`Node.js ready\nLocal: http://localhost:${actual}`);if(process.send)process.send({type:'ready',port:actual})});
server.listen(port,'0.0.0.0');
