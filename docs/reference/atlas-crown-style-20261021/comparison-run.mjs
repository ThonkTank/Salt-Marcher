import {_electron} from 'playwright-core';
import {writeFile,stat,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=process.cwd(),out=root+'/.build/crown-style-prototype',errors=[];
await rm(out+'/result.json',{force:true});
const app=await _electron.launch({executablePath:root+'/node_modules/electron/dist/electron',args:[out+'/main.cjs','--ozone-platform=x11'],timeout:30000});
const child=app.process(),result={pid:child.pid,errors,views:[]};
try{const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.stack));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
await page.waitForFunction(()=>document.body.dataset.ready==='true');
for(const tilt of [0,45]){result.views.push({tilt,stats:await page.evaluate(t=>window.pose(t,0),tilt)});await page.screenshot({path:out+'/comparison-'+tilt+'.png'});}
result.performance=[];for(const index of [0,1,1,0])result.performance.push({index,...await page.evaluate(i=>window.pair[i].measure(),index)});
const exited=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());result.exit=await exited;result.pidAbsent=!(await stat('/proc/'+child.pid).catch(()=>null));await writeFile(out+'/result.json',JSON.stringify(result,null,2));assert.deepEqual(errors,[]);assert.equal(result.exit.code,0);assert(result.pidAbsent);
}finally{if(child.exitCode===null)await app.close();}
