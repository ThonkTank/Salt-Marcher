// Counterprobe: exact cached product before index preparation versus eager setup.
// Both variants pin and verify the same canonical snapshot. Not a native latency test.
import assert from 'node:assert/strict';
import {createReadStream,createWriteStream} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {createGunzip} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {serialize} from 'node:v8';
import {join,resolve} from 'node:path';
import {buildSync} from 'esbuild';
const root=process.cwd(),output=resolve('.build/atlas-first-product',`${Date.now()}-${process.pid}`);await mkdir(output,{recursive:true});
const filename=join(output,'world.sqlite'),cacheDirectory=join(output,'cache');
await pipeline(createReadStream('docs/reference/atlas-rebuild-m0-20261023/mixed-world.sqlite.gz'),createGunzip(),createWriteStream(filename,{flags:'wx'}));
const bundle=join(output,'probe.cjs');
buildSync({stdin:{contents:"export {CampaignStore} from './src/app/storage/store';export {AtlasRegionReader} from './src/app/storage/atlas-region';export {AtlasGeometryTiles} from './src/app/storage/atlas-geometry-tiles';export {AtlasProjectionIndex} from './src/app/storage/atlas-projection-index';export {atlasProjectionSource} from './src/app/storage/atlas-shape-source';export {TerrainScalePyramid} from './src/app/storage/terrain-scale';",resolveDir:root},outfile:bundle,bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const require=createRequire(import.meta.url),Database=require('better-sqlite3'),api=require(bundle),store=new api.CampaignStore(filename);
const campaign=store.db.prepare('SELECT id FROM campaign').get(),token=store.activateShell(campaign.id).token,source=store.atlasRegionSource(token),request={tile:{lod:4,x:0,y:0},revision:source.revision};
const drain=steps=>{for(;;){const step=steps.next();if(step.done)return step.value;}};
const hash=value=>createHash('sha256').update(serialize(value)).digest('hex');
const pinned=db=>{db.exec('BEGIN');assert.equal(db.prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?').get(source.campaignId).revision,source.revision);assert.deepEqual(api.atlasProjectionSource(db,source.campaignId),{shapeVersion:source.shapeVersion,geometryVersion:source.geometryVersion});};
let expected;
try{
 const db=new Database(filename,{readonly:true}),index=await api.AtlasProjectionIndex.open(db,source,cacheDirectory),reader=new api.AtlasRegionReader(db,undefined,index),tiles=new api.AtlasGeometryTiles(cacheDirectory);
 try{pinned(db);await reader.sync(source,'core');expected=drain(tiles.read(source,request,reader));db.exec('COMMIT');assert(await index.flush());}finally{tiles.close();await index.close();db.close();}
 const runs=[];
 for(let round=0;round<4;round++)for(const mode of round%2?['product-first','eager']:['eager','product-first']){
  const db=new Database(filename,{readonly:true}),tiles=new api.AtlasGeometryTiles(cacheDirectory);let index;
  try{
   const times={},start=performance.now();let reader;
   if(mode==='eager'){let t=performance.now();index=await api.AtlasProjectionIndex.open(db,source,cacheDirectory);times.indexOpen=performance.now()-t;t=performance.now();reader=new api.AtlasRegionReader(db,undefined,index);times.readerInit=performance.now()-t;}
   let t=performance.now();pinned(db);times.sourceCheck=performance.now()-t;
   if(mode==='eager'){t=performance.now();await reader.sync(source,'core');times.sync=performance.now()-t;new api.TerrainScalePyramid().sync(db,source);}
   t=performance.now();const value=mode==='eager'?drain(tiles.read(source,request,reader)):tiles.cached(source,request);assert(value);times.tile=performance.now()-t;db.exec('COMMIT');times.total=performance.now()-start;
   assert.equal(value.cache,'hit');assert.deepEqual(value.model,expected.model);runs.push({round,mode,times,digest:hash(value.model)});
  }finally{tiles.close();if(db.inTransaction)db.exec('ROLLBACK');await index?.close();db.close();}
 }
 const result={scope:'Alternating same-world exact geometry overview cache hits. Pins and validates sources; does not measure worker startup, UI or cold view.',bundleHash:createHash('sha256').update(await readFile(bundle)).digest('hex'),source,request,runs};
 await writeFile(join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,output}));
}finally{store.close();}
