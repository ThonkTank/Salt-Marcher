/** Disposable KWin virtual output and private D-Bus. Never connects to the host compositor. */
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const root=process.cwd(),args=process.argv.slice(2);
if(args[0]==='--child'){
 const output=process.env.TW_VIRTUAL_OUTPUT,command=JSON.parse(process.env.TW_VIRTUAL_COMMAND);
 const compositorPid=Number(execFileSync('gdbus',['call','--session','--dest','org.freedesktop.DBus','--object-path','/org/freedesktop/DBus','--method','org.freedesktop.DBus.GetConnectionUnixProcessID','org.kde.KWin'],{encoding:'utf8'}).match(/uint32 (\d+)/)?.[1]);
 const evidence={compositorPid,isolatedVirtualSession:true,runtime:process.env.XDG_RUNTIME_DIR,waylandDisplay:process.env.WAYLAND_DISPLAY,sessionBus:process.env.DBUS_SESSION_BUS_ADDRESS,command,started:new Date().toISOString()};
 for(const [file,cmd,params]of [['wayland-info.txt','wayland-info',[]],['kwin-dbus.txt','gdbus',['introspect','--session','--dest','org.kde.KWin','--object-path','/org/kde/KWin/EIS/RemoteDesktop']],['kwin-support.txt','gdbus',['call','--session','--dest','org.kde.KWin','--object-path','/KWin','--method','org.kde.KWin.supportInformation']]]){
  try{await writeFile(path.join(output,file),execFileSync(cmd,params,{encoding:'utf8',timeout:10000}));}catch(error){await writeFile(path.join(output,file),String(error));}
 }
 const child=spawn(command[0],command.slice(1),{stdio:'inherit',env:{...process.env,TW_VIRTUAL_SESSION:'1',QA_OZONE_PLATFORM:'wayland'}});evidence.pid=child.pid;
 const exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});evidence.exit=exit;evidence.finished=new Date().toISOString();
 evidence.pidAbsent=await stat('/proc/'+child.pid).then(()=>false,()=>true);await writeFile(path.join(output,'session.json'),JSON.stringify(evidence,null,2));process.exitCode=exit.code??1;
}else{
 const command=args[0]==='--'?args.slice(1):args;assert(command.length,'Provide a bounded test command after --');
 const output=path.resolve('.build/terrain-water-virtual',`${Date.now()}-${process.pid}`);await mkdir(output,{recursive:true});
 const runtime=await mkdtemp(path.join(os.tmpdir(),'saltmarcher-tw02-'));await mkdir(path.join(runtime,'config'));await mkdir(path.join(runtime,'cache'));await mkdir(path.join(runtime,'data'));
 const script=path.join(runtime,'session.sh'),quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
 await writeFile(script,'#!/bin/sh\nexec '+quote(process.execPath)+' '+quote(path.join(root,'tools/terrain-water-virtual-session.mjs'))+' --child\n',{mode:0o700});
 const compositorArgs=['--virtual','--width','1920','--height','1080','--output-count','1','--socket','saltmarcher-tw02','--no-lockscreen','--no-global-shortcuts','--no-kactivities','--inputmethod','/usr/bin/true','--exit-with-session',script];
 const evidence={output,runtime,compositor:'kwin_wayland',compositorArgs,hostWaylandDisplay:process.env.WAYLAND_DISPLAY,hostLockReadOnly:null,started:new Date().toISOString()};
 try{evidence.hostLockReadOnly=execFileSync('gdbus',['call','--session','--dest','org.freedesktop.ScreenSaver','--object-path','/ScreenSaver','--method','org.freedesktop.ScreenSaver.GetActive'],{encoding:'utf8',timeout:5000}).trim();}catch(error){evidence.hostLockReadOnly=String(error);}
 const log=createWriteStream(path.join(output,'compositor.log'));
 const child=spawn('dbus-run-session',['--','kwin_wayland',...compositorArgs],{cwd:root,env:{...process.env,XDG_RUNTIME_DIR:runtime,XDG_CONFIG_HOME:path.join(runtime,'config'),XDG_CACHE_HOME:path.join(runtime,'cache'),XDG_DATA_HOME:path.join(runtime,'data'),XDG_SESSION_TYPE:'wayland',WAYLAND_DISPLAY:'saltmarcher-tw02',TW_VIRTUAL_OUTPUT:output,TW_VIRTUAL_COMMAND:JSON.stringify(command)},stdio:['ignore','pipe','pipe']});
 evidence.pid=child.pid;child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
 try{evidence.exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});evidence.session=await readFile(path.join(output,'session.json'),'utf8').then(JSON.parse).catch(()=>null);evidence.compositorPidAbsent=evidence.session?.compositorPid?await stat('/proc/'+evidence.session.compositorPid).then(()=>false,()=>true):false;evidence.normalExit=evidence.exit.code===0&&evidence.exit.signal===null&&evidence.session?.exit.code===0&&evidence.session?.exit.signal===null;evidence.pidAbsent=await stat('/proc/'+child.pid).then(()=>false,()=>true);}
 finally{await new Promise(resolve=>log.end(resolve));await rm(runtime,{recursive:true,force:true});evidence.runtimeRemoved=await stat(runtime).then(()=>false,()=>true);try{evidence.hostLockAfterReadOnly=execFileSync('gdbus',['call','--session','--dest','org.freedesktop.ScreenSaver','--object-path','/ScreenSaver','--method','org.freedesktop.ScreenSaver.GetActive'],{encoding:'utf8',timeout:5000}).trim();}catch(error){evidence.hostLockAfterReadOnly=String(error);}evidence.finished=new Date().toISOString();await writeFile(path.join(output,'result.json'),JSON.stringify(evidence,null,2));}
 console.log(output);assert(evidence.normalExit,'The isolated compositor and its test command must exit normally');assert(evidence.runtimeRemoved);assert(evidence.pidAbsent);assert(evidence.compositorPidAbsent);
}
