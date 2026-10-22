// Cold/reopened compact-index parity on a copied, retained synthetic mixed world.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const require=createRequire(import.meta.url),Database=require('better-sqlite3'),{buildSync}=require('esbuild');
const input=process.env.ATLAS_MIXED_SOURCE;assert(input,'Set ATLAS_MIXED_SOURCE to a retained synthetic world');
const output=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/atlas-region-cache');mkdirSync(output,{recursive:true});
const filename=path.join(output,'world.sqlite'),cacheDir=path.join(output,'cache'),bundle=path.join(output,'reader.cjs');
buildSync({stdin:{contents:"export * from './src/app/storage/atlas-region';export * from './src/app/storage/atlas-region-cache';export * from './src/app/storage/atlas-shape-source';",resolveDir:process.cwd()},outfile:bundle,bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {AtlasRegionReader,AtlasRegionCache,installAtlasShapeSource,atlasShapeSource}=require(bundle),original=new Database(input,{readonly:true});await original.backup(filename);original.close();
const writer=new Database(filename);writer.transaction(()=>installAtlasShapeSource(writer))();writer.close();
const runs=[];
for(const label of ['uncached','cold','reopened']){
 const db=new Database(filename,{readonly:true});try{
  db.exec('BEGIN');const root=db.prepare('SELECT * FROM campaign_atlas').get(),source={filename,campaignId:root.campaign_id,token:'diagnostic',fence:'diagnostic',revision:root.revision,epoch:'diagnostic',sequence:0,reset:true,changes:[],shapeVersion:atlasShapeSource(db,root.campaign_id)};
  const building=db.prepare("SELECT b.* FROM atlas_binding b JOIN room_group g ON g.campaign_id=b.campaign_id AND g.id=b.owner_id WHERE b.campaign_id=? AND b.parent='world' ORDER BY b.rowid LIMIT 1").get(root.campaign_id),dungeon=db.prepare("SELECT b.* FROM atlas_binding b WHERE b.campaign_id=? AND b.kind='dungeon' AND (SELECT count(*) FROM room r WHERE r.campaign_id=b.campaign_id AND r.scope_id=b.owner_id)>4000 LIMIT 1").get(root.campaign_id);assert(building&&dungeon);
  const reader=new AtlasRegionReader(db,undefined,label==='uncached'?undefined:new AtlasRegionCache(cacheDir)),project=reader.project.bind(reader);let projected=0;reader.project=(...args)=>{projected++;return project(...args);};
  const start=performance.now();await reader.sync(source);const syncMs=performance.now()-start;
  const views=[];for(const [name,box,scopeId]of [['world',{x:-20000000,y:-12500000,width:40000000,height:25000000},null],['region',{x:-1000000,y:-600000,width:2000000,height:1200000},null],['building',{x:building.x-20,y:building.y-20,width:40,height:40},building.owner_id],['dungeon',{x:dungeon.x-20,y:dungeon.y-20,width:100,height:60},dungeon.owner_id]]){
   const start=performance.now(),view=reader.read(source,{box,width:1440,height:900,scopeId,floorId:'ground',slice:null,roofs:true,terrainRaster:false}),json=JSON.stringify(view);views.push({name,ms:performance.now()-start,sha256:createHash('sha256').update(json).digest('hex'),coverage:view.coverage,rooms:view.rooms.length,elements:view.drawing.elements.length});
  }
  const result={label,syncMs,projected,views};runs.push(result);console.log(JSON.stringify(result));
 }finally{db.close();}
}
const equal=runs.every(r=>r.views.every((v,i)=>v.sha256===runs[0].views[i].sha256)),files=readdirSync(cacheDir).map(name=>({name,bytes:statSync(path.join(cacheDir,name)).size}));
writeFileSync(path.join(output,'result.json'),JSON.stringify({bundleSha256:createHash('sha256').update(readFileSync(bundle)).digest('hex'),equal,runs,files},null,2));assert(equal);assert.equal(runs[2].projected,0);
