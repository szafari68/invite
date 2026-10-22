import {fork,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const api=fork(fileURLToPath(new URL('./server.js',import.meta.url)),[],{
  cwd:root,stdio:['inherit','inherit','inherit','ipc'],
  env:{...process.env,NODE_ENV:'development',DEV_PORT_FALLBACK:'1'},
});
let vite,stopping=false,ready=false;
function stop(code=0){
  if(stopping)return;
  stopping=true;
  process.exitCode=code;
  clearTimeout(timer);
  api.kill();
  vite?.kill();
}
const timer=setTimeout(()=>{console.error('API startup timed out.');stop(1)},15000);
api.on('message',message=>{
  if(message?.type!=='ready'||ready||stopping)return;
  ready=true;clearTimeout(timer);
  console.log(`API ready on port ${message.port}`);
  vite=spawn(process.execPath,[fileURLToPath(new URL('./node_modules/vite/bin/vite.js',import.meta.url)),'--host','0.0.0.0',...process.argv.slice(2)],{
    cwd:root,stdio:'inherit',env:{...process.env,API_PORT:String(message.port)},
  });
  vite.on('error',error=>{console.error(error.message);stop(1)});
  vite.on('exit',code=>stop(code??1));
});
api.on('error',error=>{console.error(error.message);stop(1)});
api.on('exit',code=>stop(code??1));
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
