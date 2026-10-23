import {test} from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
async function start(dir,port=0,dev=false){
 const child=spawn(process.execPath,[dev?'dev.js':'server.js','--port',String(port)],{env:{...process.env,DATA_DIR:dir},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(output);const actual=output.match(/Local: http:\/\/localhost:(\d+)/)?.[1];if(actual)return {child,base:`http://127.0.0.1:${actual}`,output};await new Promise(r=>setTimeout(r,50))}child.kill();throw Error('Startup timeout: '+output);
}
async function stop(child){child.kill();if(child.exitCode===null)await once(child,'exit')}
test('single server fallback, static serving, API and disk persistence', {timeout:20000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'invite-node-'));const holder=net.createServer();holder.listen(0,'0.0.0.0');await once(holder,'listening');let running;
 try{
  running=await start(dir,holder.address().port,true);assert.match(running.output,/selecting a free port/);
  const html=await(await fetch(running.base)).text();assert.match(html,/<main class="card" id="app">/);assert.ok(!html.includes('src.js'));assert.ok(!html.includes('claude.use'));
  assert.equal((await fetch(running.base+'/server.js')).status,404);
  const r=await(await fetch(running.base+'/api/invites',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'ماندگار',sender:'',message:''})})).json();
  await fetch(`${running.base}/api/invites/${r.id}/answer`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({status:'accepted',date:'2027-12-25',time:'20:30',food:'قهوه',noCount:3})});
  await stop(running.child);running=await start(dir);
  const response=await fetch(`${running.base}/api/invites/${r.id}/result`,{headers:{authorization:`Bearer ${r.key}`}});assert.equal(response.status,200);const result=await response.json();assert.equal(result.answer.food,'قهوه');assert.equal(result.answer.noCount,3);
 }finally{if(running&&running.child.exitCode===null)await stop(running.child);await new Promise(r=>holder.close(r));await rm(dir,{recursive:true,force:true})}
});
