import {createNativeSession} from '../../../tools/native-session.mjs';
import {atlasCanvasReady} from '../../../tools/atlas-canvas-probe.mjs';
import {copyFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.QA_EVIDENCE_DIR,root=process.cwd();await mkdir(out,{recursive:true});
const sourceProfile=process.env.QA_SOURCE_PROFILE;assert(sourceProfile,'QA_SOURCE_PROFILE must name a closed synthetic world profile');
const native=await createNativeSession({root,output:out,name:'atlas-reply-size'});
await copyFile(sourceProfile+'/workbench.sqlite',native.profile+'/workbench.sqlite');
try{
 const page=await native.launch(),app=native.app;
 await app.evaluate(({ipcMain})=>{
  const channel='atlas:geometry-region',handler=ipcMain._invokeHandlers.get(channel);if(!handler)throw Error('Missing region handler');
  global.__atlasReplySizes=[];
  ipcMain.removeHandler(channel);ipcMain.handle(channel,async(...args)=>{
   const reply=await handler(...args),v=reply.value;if(v){
    const bytes=x=>Buffer.byteLength(JSON.stringify(x));
    global.__atlasReplySizes.push({query:args[2],bytes:bytes(reply),fields:Object.fromEntries(Object.entries(v).map(([key,value])=>[key,{bytes:bytes(value),count:Array.isArray(value)?value.length:undefined}])),counts:{rooms:v.workspace?.rooms?.length,elements:v.geometry?.drawing?.elements?.length,labels:v.region?.labels?.length,landscape:v.region?.landscape?.records?.length,tiles:v.region?.landscape?.tiles?.length}});
   }return reply;
  });
 });
 await page.locator('.campaign-card').filter({hasText:'Sparse world navigation'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
 await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
 if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
 await atlasCanvasReady(page);await page.locator('#atlas-overview').click();await atlasCanvasReady(page);
 const box=await page.locator('#campaign-map').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,-600);
 await page.waitForTimeout(1500);await atlasCanvasReady(page);
 const replies=await app.evaluate(()=>global.__atlasReplySizes);assert(replies.length>0,'No actual region replies captured');
 await native.close();await native.finish({replies,sourceProfile,measurement:'Payload inventory only; JSON serialization instrumentation changes timing.'});console.log(JSON.stringify(replies));
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}
