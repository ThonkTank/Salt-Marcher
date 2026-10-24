// Isolated M2 field-index promotion probe. It never opens the user's database:
// each path gets its own writable copy of the frozen M0 fixture and cache.
import assert from 'node:assert/strict';
import {createReadStream,createWriteStream} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {createGunzip} from 'node:zlib';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {buildSync} from 'esbuild';

const root=process.cwd(),output=resolve('.build/atlas-field-promotion',`${Date.now()}-${process.pid}`);
await mkdir(output,{recursive:true});
const fixture=resolve('tests/fixtures/atlas/mixed-world.sqlite.gz');
const compressedFixtureHash=createHash('sha256').update(await readFile(fixture)).digest('hex'),fixtureDigest=createHash('sha256');
for await(const chunk of createReadStream(fixture).pipe(createGunzip()))fixtureDigest.update(chunk);
const fixtureHash=fixtureDigest.digest('hex');
const bundle=join(output,'probe.cjs');
buildSync({stdin:{contents:`export {CampaignStore} from './src/app/storage/store';
export {AtlasRegionReader} from './src/app/storage/atlas-region';
export {AtlasProjectionIndex} from './src/app/storage/atlas-projection-index';
export {atlasTerrainTileQuery} from './src/app/atlas-terrain-tile';`,resolveDir:root},outfile:bundle,bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const require=createRequire(import.meta.url),Database=require('better-sqlite3');
const {CampaignStore,AtlasRegionReader,AtlasProjectionIndex,atlasTerrainTileQuery}=require(bundle);
const hash=value=>createHash('sha256').update(JSON.stringify(value,(k,v)=>ArrayBuffer.isView(v)?Array.from(v):v)).digest('hex');
const ms=fn=>{const start=performance.now(),value=fn();return {ms:performance.now()-start,value};};
const timeAsync=async fn=>{const start=performance.now(),value=await fn();return {ms:performance.now()-start,value};};
// Production may already request this ordering. Strip only that known suffix,
// then apply the selected probe mode exactly once.
const landscapeSelect=sql=>sql.replace(/\s+ORDER\s+BY\s+id\s*;?\s*$/i,'');
const copyStats=(index,{orderById=false}={})=>{
 const copyCurrent=index.copy.bind(index),stats=[];
 index.copy=(table,columns,select,args)=>{
  const started=performance.now(),before=table==='landscape_shape_bounds'?index.prepare('SELECT count(*) n FROM temp.landscape_shape_bounds').get().n:null;
  const base=table==='landscape_shape_bounds'?landscapeSelect(select):select,sql=table==='landscape_shape_bounds'&&orderById?base+' ORDER BY id':base;
  const queryPlan=table==='landscape_shape_bounds'?index.source.prepare('EXPLAIN QUERY PLAN '+sql).all(...args).map(row=>row.detail):undefined;
  let value;
  if(!index.separate)value=copyCurrent(table,columns,sql,args);
  else{
   // Baseline v1: reproduce the former private-index path explicitly. One
   // cached single-row INSERT per SELECT row; TEMP remains INSERT ... SELECT.
   const put=index.prepare('INSERT INTO temp.'+table+' VALUES('+Array(columns).fill('?').join(',')+')');
   for(const row of index.source.prepare(sql).raw().iterate(...args))put.run(...row);
  }
  const after=table==='landscape_shape_bounds'?index.prepare('SELECT count(*) n FROM temp.landscape_shape_bounds').get().n:null;
  stats.push({table,rows:before===null?null:after-before,ms:performance.now()-started,implementation:index.separate?'baseline-v1-single-row':'SQLite INSERT SELECT',...(queryPlan?{queryPlan,orderById}: {})});return value;
 };
 return stats;
};
const installBoundedCopy=(index,{orderById=false}={})=>{
 const original=index.copy.bind(index),stats=[];
 index.copy=(table,columns,select,args)=>{
  if(table!=='landscape_shape_bounds')return original(table,columns,select,args);
  const started=performance.now(),before=index.prepare('SELECT count(*) n FROM temp.landscape_shape_bounds').get().n;
  const base=landscapeSelect(select),ordered=orderById?base+' ORDER BY id':base;
  if(!index.separate)original(table,columns,ordered,args);else{
   const batchRows=256,tuple='('+Array(columns).fill('?').join(',')+')',put=index.prepare('INSERT INTO temp.'+table+' VALUES'+tuple),block=index.prepare('INSERT INTO temp.'+table+' VALUES'+Array(batchRows).fill(tuple).join(','));
   let values=[];
   for(const row of index.source.prepare(ordered).raw().iterate(...args)){
    values.push(...row);
    if(values.length===columns*batchRows){block.run(...values);values=[];}
   }
   for(let offset=0;offset<values.length;offset+=columns)put.run(...values.slice(offset,offset+columns));
  }
  const after=index.prepare('SELECT count(*) n FROM temp.landscape_shape_bounds').get().n;
  const queryPlan=index.source.prepare('EXPLAIN QUERY PLAN '+ordered).all(...args).map(row=>row.detail);
  stats.push({table,rows:after-before,ms:performance.now()-started,implementation:index.separate?'fixed-256-plus-single-tail':'SQLite INSERT SELECT',batchRows:256,orderById,queryPlan});return undefined;
 };
 return stats;
};
const unpack=async(name)=>{const filename=join(output,name+'.sqlite');await pipeline(createReadStream(fixture),createGunzip(),createWriteStream(filename,{flags:'wx'}));return filename;};
const canonicalRows=projection=>projection.prepare(`SELECT id,source_row,kind,terrain_kind,resolution,paint_version,paint_order,payload_bytes,min_x,max_x,min_y,max_y FROM temp.landscape_shape_bounds ORDER BY source_row`).all();
const fieldRows=projection=>projection.prepare(`SELECT id,source_row,kind,terrain_kind,resolution,paint_version,paint_order,payload_bytes,min_x,max_x,min_y,max_y FROM temp.landscape_shape_bounds WHERE terrain_kind IN ('height','route','lake') ORDER BY source_row`).all();
const terrainProduct=(reader,source)=>{
 const query=atlasTerrainTileQuery({tile:{lod:0,x:0,y:0},revision:source.revision},source.fence),started=performance.now();
 const steps=reader.terrainSteps(source,query);let result;
 for(;;){const step=steps.next();if(step.done){result=step.value;break;}}
 return {ms:performance.now()-started,width:result.width,height:result.height,heightsHash:hash(result.grid.heights),maxHeight:Math.max(...result.grid.heights),pixelsHash:hash(result.pixels),forestHash:hash(result.forest),routesHash:hash(result.routes),heightCount:result.grid.heights.length};
};
async function openWorld(label,filename,cacheDir,{multirow=false,promote=false,freshFull=false,orderById=false}={}){
 const store=new CampaignStore(filename);let db,index,reader;
 try{
  const campaignId=store.db.prepare('SELECT id FROM campaign').get().id,token=store.activateShell(campaignId).token,source=store.atlasRegionSource(token);
  db=new Database(filename,{readonly:true});db.pragma('temp_store = FILE');
  index=await AtlasProjectionIndex.open(db,{...source,reset:true},cacheDir,randomUUID());
  const copies=multirow?installBoundedCopy(index,{orderById}):copyStats(index,{orderById});
  reader=new AtlasRegionReader(db,undefined,index);
  let fieldSyncMs=0,fieldCount=0,fieldDigest='',fieldCopy=[];
  if(!freshFull){
   db.exec('BEGIN');const syncField=await timeAsync(()=>reader.sync({...source,reset:true},'core','field'));
   fieldSyncMs=syncField.ms;db.exec('COMMIT');fieldCount=index.prepare('SELECT count(*) n FROM temp.landscape_shape_bounds').get().n;
   fieldDigest=hash(fieldRows(index));fieldCopy=copies.slice();
  }
  if(promote){
   await index.flush();await index.close();db.close();index=undefined;db=undefined;reader=undefined;
   db=new Database(filename,{readonly:true});db.pragma('temp_store = FILE');
   index=await AtlasProjectionIndex.open(db,source,cacheDir,randomUUID());
   const reopenCopies=multirow?installBoundedCopy(index,{orderById}):copyStats(index,{orderById});
   reader=new AtlasRegionReader(db,undefined,index);db.exec('BEGIN');
   const reopenStart=performance.now();await reader.sync(source,'core','field');const reopenSyncMs=performance.now()-reopenStart;db.exec('COMMIT');
   const afterReopen={syncMs:reopenSyncMs,copy:reopenCopies.slice(),rows:index.prepare('SELECT count(*) n FROM temp.landscape_shape_bounds').get().n,digest:hash(fieldRows(index))};
   const promoteCopies=reopenCopies;db.exec('BEGIN');
   const promoteStart=performance.now();await reader.sync(source,'core','full');const promotionSyncMs=performance.now()-promoteStart;db.exec('COMMIT');
   const fullRows=canonicalRows(index),fullDigest=hash(fullRows),fieldSubsetDigest=hash(fieldRows(index));
   const terrain=terrainProduct(reader,source);
   await index.flush();
   return {label,fieldSyncMs,fieldRows:fieldCount,fieldDigest,fieldCopy,afterReopen,promotionSyncMs,promotionCopy:promoteCopies,fullRows:fullRows.length,fullDigest,fieldSubsetDigest,fieldSubsetPreserved:fieldSubsetDigest===fieldDigest,terrain,indexPersistent:index.persistent};
  }
  const fullStart=performance.now();await reader.sync(freshFull?{...source,reset:true}:source,'core','full');const fullSyncMs=performance.now()-fullStart;
  const fullRows=canonicalRows(index),terrain=terrainProduct(reader,source);
  return {label,fieldSyncMs,fieldRows:fieldCount,fieldDigest,fieldCopy,fullSyncMs,fullCopy:copies.slice(),fullRows:fullRows.length,fullDigest:hash(fullRows),fieldSubsetDigest:hash(fieldRows(index)),terrain,indexPersistent:index.persistent};
 }finally{if(db?.inTransaction)db.exec('ROLLBACK');reader?.rollback('core');if(index)await index.close();db?.close();store.close();}
}
const mainFile=await unpack('promotion'),freshFile=await unpack('fresh-full'),batchFile=await unpack('bounded-copy');
const store=new CampaignStore(mainFile);let source;
try{const id=store.db.prepare('SELECT id FROM campaign').get().id,token=store.activateShell(id).token;source=store.atlasRegionSource(token);}finally{store.close();}
const matrix=[['single-sorted','batch-sorted','unchanged','fresh-full','fresh-sorted'],['batch-sorted','unchanged','fresh-full','fresh-sorted','single-sorted'],['unchanged','fresh-full','fresh-sorted','single-sorted','batch-sorted']],runs=[];
for(let round=0;round<3;round++)for(const strategy of matrix[round]){
 const freshFull=strategy==='fresh-full'||strategy==='fresh-sorted',multirow=strategy==='batch-sorted',orderById=strategy==='single-sorted'||strategy==='batch-sorted'||strategy==='fresh-sorted';
 const filename=freshFull?freshFile:multirow?batchFile:mainFile,label=`round-${round+1}-${strategy}`;
 const run=await openWorld(label,filename,join(output,`cache-${label}`),{promote:!freshFull,freshFull,multirow,orderById});run.round=round+1;run.strategy=strategy;runs.push(run);
}
const reference=runs.find(run=>run.strategy==='fresh-full');
for(const run of runs){assert.equal(run.fullDigest,reference.fullDigest,`${run.label}: full metadata must match fresh full.`);assert.equal(run.terrain.heightsHash,reference.terrain.heightsHash,`${run.label}: height query must match fresh full.`);assert.equal(run.terrain.pixelsHash,reference.terrain.pixelsHash,`${run.label}: terrain raster must match fresh full.`);if(run.fieldSubsetPreserved!==undefined)assert.equal(run.fieldSubsetPreserved,true,`${run.label}: promotion must preserve field rows.`);const copy=(run.promotionCopy??run.fullCopy).find(c=>c.table==='landscape_shape_bounds');assert.equal(copy.orderById,run.strategy==='single-sorted'||run.strategy==='batch-sorted'||run.strategy==='fresh-sorted',`${run.label}: copy must use the strategy's requested ordering.`);}
const result={scope:'Isolated CPU/SQLite mechanism probe only. Frozen M0 source copied to disposable workbench databases; persistent cache and workers are isolated under .build. Three alternating rounds compare unchanged row copy, ORDER BY id row copy, ORDER BY id bounded 256-row copy, fresh TEMP full, and fresh TEMP full ORDER BY id. No production edits or native/fullbuild execution.',node:process.version,fixture,fixtureHash,compressedFixtureHash,source:{campaignId:source.campaignId,revision:source.revision,fence:source.fence,shapeVersion:source.shapeVersion},roundOrder:matrix,discardedRuns:[{path:'.build/atlas-field-promotion/1792800082451-1280632/result.json',reason:'Unsuitable preliminary 3-round matrix: per-row promotion instrumentation stacked copy wrappers and inflated its timings. Excluded from all reported comparisons.'},{path:'.build/atlas-field-promotion/1792800189703-1281709/result.json',reason:'Unsuitable follow-up matrix: orderById was not passed into copyStats calls, so sorted-single and fresh-sorted did not execute the requested SQL. Excluded from all reported comparisons.'}],runs,equivalence:{allMetadataDigestsMatch:runs.every(run=>run.fullDigest===reference.fullDigest),allTerrainHeightsMatch:runs.every(run=>run.terrain.heightsHash===reference.terrain.heightsHash),allTerrainRastersMatch:runs.every(run=>run.terrain.pixelsHash===reference.terrain.pixelsHash),allPromotionsPreserveFieldSubset:runs.filter(run=>run.fieldSubsetPreserved!==undefined).every(run=>run.fieldSubsetPreserved)},interpretation:'Per-run landscape_shape_bounds copy timings and EXPLAIN QUERY PLAN are captured. Terrain tile query records elapsed time, dimensions, maximum sampled height and deterministic hashes. All source reads use the active readonly snapshot; no additional canonical connection is opened.'};
await writeFile(join(output,'result.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({complete:true,output,result},null,2));
