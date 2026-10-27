import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import assert from 'node:assert/strict';
/** EIS is restricted by the helper to the temporary virtual compositor. */
export async function createTerrainWaterKeyboard(){
 assert.equal(process.env.TW_VIRTUAL_SESSION,'1');
 const child=spawn('python',[new URL('./terrain-water-eis-keyboard.py',import.meta.url).pathname],{stdio:['pipe','pipe','pipe']});
 const evidence={pid:child.pid,events:[],stderr:''},pending=new Map();let id=0,readyResolve,readyReject;
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 child.stderr.on('data',bytes=>{evidence.stderr+=String(bytes);});
 const exited=new Promise(resolve=>child.once('exit',(code,signal)=>{evidence.exit={code,signal};readyReject(Error('EIS helper exited: '+evidence.stderr));for(const p of pending.values())p.reject(Error('EIS helper exited'));resolve({code,signal});}));
 createInterface({input:child.stdout}).on('line',line=>{try{const message=JSON.parse(line);evidence.events.push(message);if(message.ready)readyResolve(message);else if(pending.has(message.id)){pending.get(message.id).resolve(message);pending.delete(message.id);}}catch(error){readyReject(error);}});
 let timer;try{evidence.ready=await Promise.race([ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('EIS readiness timeout')),7000);})]);}finally{clearTimeout(timer);}
 const codes={w:17,a:30,s:31,d:32,Escape:1};
 async function send(name,down){const code=codes[name];assert(code,'Only the bounded TW02 keyboard keys are supported');const next=++id;let timer;try{const answer=new Promise((resolve,reject)=>{pending.set(next,{resolve,reject});timer=setTimeout(()=>reject(Error('EIS action timeout')),3000);});child.stdin.write(JSON.stringify({id:next,code,down})+'\n');await answer;}finally{clearTimeout(timer);pending.delete(next);}}
 return {evidence,down:name=>send(name,true),up:name=>send(name,false),press:async name=>{await send(name,true);await send(name,false);},close:async()=>{child.stdin.end(JSON.stringify({close:true})+'\n');const exit=await exited;assert.deepEqual(exit,{code:0,signal:null});}};
}
if(process.argv.includes('--probe')){const keyboard=await createTerrainWaterKeyboard();await keyboard.press('w');await keyboard.close();console.log(JSON.stringify(keyboard.evidence));}
