import {test} from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
test('occupied API port falls back and Vite proxies to the new API', {timeout:25000},async()=>{
 const holder=net.createServer();holder.listen(0,'127.0.0.1');await once(holder,'listening');const occupied=holder.address().port;
 const dir=await mkdtemp(path.join(os.tmpdir(),'invite-port-'));
 const child=spawn(process.execPath,['dev.js','--port','5173','--strictPort'],{env:{...process.env,API_PORT:String(occupied),DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
 try{
  let available=false;
  for(let i=0;i<100;i++){
   if(child.exitCode!==null)throw new Error(output);
   if(output.includes('VITE')&&output.includes('Local:')){available=true;break}
   await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(available,output);assert.match(output,/selecting a free port/);
  const actual=Number(output.match(/API ready on port (\d+)/)?.[1]);assert.ok(actual);assert.notEqual(actual,occupied);
  const response=await fetch('http://127.0.0.1:5173/api/invites',{method:'POST',headers:{'content-type':'application/json',origin:'http://127.0.0.1:5173'},body:JSON.stringify({name:'آزمون پورت',sender:'',message:''})});
  assert.equal(response.status,201);const r=await response.json();assert.equal(r.name,'آزمون پورت');
  const publicResult=await fetch(`http://127.0.0.1:5173/api/invites/${r.id}`);assert.equal(publicResult.status,200);
 }finally{
  child.kill('SIGINT');if(child.exitCode===null)await once(child,'exit');
  await new Promise(resolve=>holder.close(resolve));await rm(dir,{recursive:true,force:true});
 }
});
