import {spawn,spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {isMemoryBounded} from './local-check-policy.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export async function runLocalCheck(command,args,{ci=!!process.env.CI}={}) {
 let group='';try{group=readFileSync('/proc/self/cgroup','utf8').split('\n').find(l=>l.startsWith('0::')).slice(3);}catch{}
 const bounded=process.platform==='linux'&&isMemoryBounded();
 const scoped=process.platform==='linux'&&!ci&&!bounded;
 const unit='salt-check-'+randomUUID();
 const executable=scoped?'systemd-run':command;
 const argv=scoped?['--user','--scope','--quiet','--unit='+unit,'-p','MemoryHigh=2G','-p','MemoryMax=3G','--',command,...args]:args;
 console.log(`Local check: ${scoped?'new 2G/3G scope':bounded?'existing bounded cgroup':ci?'CI portable execution':'portable execution; no OS memory limit'}; group=${group||'unavailable'}`);
 return await new Promise((resolve,reject)=>{
  const child=spawn(executable,argv,{stdio:'inherit',env:{...process.env,NODE_OPTIONS:process.env.NODE_OPTIONS||'--max-old-space-size=2304'}});
  // Check the state of this invocation’s own scope; never retry outside it.
  let timer;
  if(scoped) timer=setTimeout(()=>{
   const state=spawnSync('systemctl',['--user','show',unit+'.scope','--property=ActiveState','--value'],{encoding:'utf8',timeout:3000});
   if(state.stdout?.trim()!=='active'){
    console.error('Local scope did not start within 30 seconds; cancelling only '+unit+'.scope');
    spawnSync('systemctl',['--user','stop','--no-block',unit+'.scope'],{timeout:3000});child.kill('SIGTERM');
   }
  },30000);
  const signals=['SIGINT','SIGTERM'];const handlers=signals.map(signal=>{const handler=()=>child.kill(signal);process.on(signal,handler);return handler;});
  function cleanup(){clearTimeout(timer);signals.forEach((s,i)=>process.off(s,handlers[i]));}
  child.once('error',error=>{cleanup();reject(error);});
  child.once('exit',(code,signal)=>{cleanup();resolve({code,signal,policy:scoped?'systemd-2G-3G':bounded?'existing-bounded':ci?'ci':'portable',group});});
 });
}
export function propagateExit(result){if(result.signal)process.kill(process.pid,result.signal);else process.exitCode=result.code??1;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);if(args[0]==='--')args.shift();const command=args.shift();
 if(!command)throw Error('Usage: npm run verify:local -- COMMAND [ARGUMENTS]');
 propagateExit(await runLocalCheck(command,args));
}
