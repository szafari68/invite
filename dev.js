import {spawn} from 'node:child_process';
const api=spawn(process.execPath,['server.js'],{stdio:'inherit'});
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','0.0.0.0',...process.argv.slice(2)],{stdio:'inherit'});
let stopping=false;function stop(){if(stopping)return;stopping=true;api.kill();vite.kill()}
process.on('SIGINT',stop);process.on('SIGTERM',stop);api.on('exit',stop);vite.on('exit',stop);
