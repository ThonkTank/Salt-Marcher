import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Database=require('better-sqlite3');
buildSync({entryPoints:['src/app/storage/atlas-region.ts'],outfile:'.build/test-atlas-region-reader.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {AtlasRegionReader}=require('../.build/test-atlas-region-reader.cjs');
export function atlasRegionBridge(store){
 const db=new Database(store.filename,{readonly:true}),reader=new AtlasRegionReader(db);let cursor;
 const result=fn=>{try{return{ok:true,value:fn()};}catch(error){return{ok:false,error:error.message};}};
 const source=async token=>{const next=store.atlasRegionSource(token,cursor);await reader.sync(next);cursor={epoch:next.epoch,sequence:next.sequence};return next;};
 return{close:()=>db.close(),api:{
  atlasRegion:async(token,q)=>{try{const s=await source(token);return{ok:true,value:store.atlasRegionView(token,reader.read(s,q),q.perception===true)};}catch(error){return{ok:false,error:error.message};}},
  atlasObjectFocus:async(token,kind,id)=>{try{const s=await source(token);return{ok:true,value:reader.focus(s,kind,id)};}catch(error){return{ok:false,error:error.message};}},
  atlasRegionHit:async(token,q,p,fence)=>{try{const s=await source(token);if(s.fence!==fence)throw new Error('Atlas inzwischen geändert.');return{ok:true,value:reader.hit(s,q,p)};}catch(error){return{ok:false,error:error.message};}},
  atlasRegionCandidates:async(token,q,p,fence,offset=0,layer='all')=>{try{const s=await source(token);if(s.fence!==fence)throw new Error('Atlas inzwischen geändert.');return{ok:true,value:reader.candidatesAt(s,q,p,offset,layer)};}catch(error){return{ok:false,error:error.message};}},
  cancelAtlasRegion:async()=>({ok:true,value:undefined}),
  atlasCitySite:async(token,id,unit)=>result(()=>store.atlasCitySite(token,id,unit)),
  workspaceInitial:async token=>result(()=>store.workspaceInitial(token)),
  executeAtlasTravelCommit:async command=>result(()=>store.executeAtlasTravelCommit(command)),
 }};
}
