import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const runner=resolve('tools/ui-session.py');
const live=pid=>{try{return readFileSync('/proc/'+pid+'/stat','utf8').split(') ')[1].split(' ')[0]!=='Z';}catch{return false;}};
test('UI session preserves child status and isolates inherited ownership',()=>{
 const result=spawnSync('python3',[runner,'python3','-c',"import os,sys; assert int(os.environ['CODEX_OWNED_UI_SESSION'])==os.getsid(0)==os.getpgrp(); sys.exit(7)"],{encoding:'utf8'});
 assert.equal(result.status,7,result.stderr);
});
test('UI cleanup removes a TERM-resistant descendant and preserves an unrelated process',()=>{
 const root=mkdtempSync(join(tmpdir(),'ui-session-')),pidfile=join(root,'pid'),foreign=spawn('sleep',['30']);
 try{
  const script="import subprocess,sys; p=subprocess.Popen([sys.executable,'-c','import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); print(\"ready\",flush=True); time.sleep(30)'],stdout=subprocess.PIPE,text=True); p.stdout.readline(); open(sys.argv[1],'w').write(str(p.pid))";
  const result=spawnSync('python3',[runner,'python3','-c',script,pidfile],{encoding:'utf8',timeout:10000});
  assert.equal(result.status,0,result.stderr);assert.equal(live(Number(readFileSync(pidfile,'utf8'))),false);assert.equal(live(foreign.pid),true);
 }finally{foreign.kill();rmSync(root,{recursive:true,force:true});}
});
