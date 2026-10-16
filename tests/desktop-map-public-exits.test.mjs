import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
for(const[name,entry]of [['store','storage/store'],['key','key-model'],['doc','key-document'],['contracts','key-contracts']])buildSync({entryPoints:['src/app/'+entry+'.ts'],outfile:'.build/map-public-'+name+'.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const require=createRequire(import.meta.url),{CampaignStore}=require('../.build/map-public-store.cjs'),{renderDungeonKey}=require('../.build/map-public-key.cjs'),{dungeonKeyMarkdown}=require('../.build/map-public-doc.cjs'),{emptyKey}=require('../.build/map-public-contracts.cjs');
for(const secret of ['destination style','corridor style','destination key'])test(`public automatic exits omit a secret ${secret} while GM exits remain available`,()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'map-public-')),store=new CampaignStore(path.join(dir,'db.sqlite'));
 try{
  const rooms=[0,1].map(i=>({id:randomUUID(),scopeId:'local',floorId:'ground',number:String(i+1),name:['Gate','Secret archive'][i],revision:0,polygons:[{outer:[{x:i*9.144,y:0},{x:i*9.144+6.096,y:0},{x:i*9.144+6.096,y:6.096},{x:i*9.144,y:6.096}],holes:[]}],sections:[{id:randomUUID(),kind:'markdown',markdown:''}]}));
  const c=store.create('Map public QA',rooms),w=store.activate(c.id),execute=action=>store.executeDrawing({commandId:randomUUID(),token:w.token,campaignId:c.id,action});
  for(const room of rooms)execute({kind:'volume-initialize',roomId:room.id,expectedRoomRevision:0,expectedVolumeRevision:null,heightSteps:2});
  const anchor=room=>({roomId:room.id,volumeId:null,pinned:false,local:null});
  const preview=store.previewPath(w.token,{id:randomUUID(),revision:0,scopeId:'local',name:'Hidden corridor',notes:'',from:anchor(rooms[0]),to:anchor(rooms[1]),waypoints:[],segments:[{form:'corridor',widthSteps:1,heightSteps:2,factor:1}],medium:'air',mode:'path',roomId:null,volumeId:null,fromPassageId:randomUUID(),toPassageId:randomUUID(),basis:'',route:[]});
  execute({kind:'path-publish',preview,expectedRevision:null});let g=store.dungeon(w.token),id=secret==='corridor style'?g.drawing.paths[0].roomId:rooms[1].id;
  if(secret==='destination key'){const content={...emptyKey(rooms[1]),secret:true};execute({kind:'key-content',content,expectedRevision:null});}
  else execute({kind:'style',style:{id,scopeId:'local',revision:0,ceilingMeters:3.048,fill:'#d8cbb5',wall:'#574b3f',publicLabel:'',secret:true},expectedRevision:null});
  g=store.dungeon(w.token);const records=g.drawing.keyContent??[],render=audience=>renderDungeonKey(g.rooms.find(r=>r.id===rooms[0].id),records,g,{audience,discovered:new Set(),heading:null}).text;
  assert.match(render('gm'),/Eine Passage/);assert.doesNotMatch(render('public'),/Eine Passage/);
  const publicKey=dungeonKeyMarkdown(g,'local',true,'ground');assert.doesNotMatch(publicKey,/Eine Passage/);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
