// Reproducible A/B over the frozen M0 overview anchors. The retained legacy
// visibility-grid path and current geometry-height path use identical sources.
// Instrumented developer-host timings, not native latency or p95 evidence.
import {createReadStream,createWriteStream} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {createGunzip} from 'node:zlib';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {buildSync} from 'esbuild';

const root=process.cwd(),output=resolve('.build/geometry-height-stream',`${Date.now()}-${process.pid}`);
await mkdir(output,{recursive:true});
const filename=join(output,'workbench.sqlite');
await pipeline(createReadStream(resolve('docs/reference/atlas-rebuild-m0-20261023/mixed-world.sqlite.gz')),createGunzip(),createWriteStream(filename,{flags:'wx'}));
const bundle=join(output,'probe.cjs');
buildSync({stdin:{contents:"export {CampaignStore} from './src/app/storage/store';export {AtlasRegionReader} from './src/app/storage/atlas-region';export {AtlasGeometryTiles} from './src/app/storage/atlas-geometry-tiles';",resolveDir:root},outfile:bundle,bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const require=createRequire(import.meta.url),Database=require('better-sqlite3'),{CampaignStore,AtlasRegionReader,AtlasGeometryTiles}=require(bundle);
const store=new CampaignStore(filename),db=new Database(filename,{readonly:true}),reader=new AtlasRegionReader(db),tiles=new AtlasGeometryTiles(join(output,'cache'));
try{
 const campaign=db.prepare('SELECT id FROM campaign').get(),token=store.activateShell(campaign.id).token,source=store.atlasRegionSource(token),points=[];
 db.exec('BEGIN');await reader.sync(source,'core');
 const actual=reader.geometryHeight.bind(reader);
 const baseline=(s,p)=>{const box={x:p.x-.5,y:p.y-.5,width:1,height:1};return reader.terrainVisibility(s,{box,frame:box,columns:3,rows:3,focusM:0,tilt:0,rotation:0,exaggeration:1}).heights[4];};
 reader.geometryHeight=(s,p)=>{points.push({x:p.x,y:p.y});return actual(s,p);};
 const steps=tiles.read(source,{tile:{lod:4,x:0,y:0},revision:source.revision},reader);
 for(;;){const step=steps.next();if(step.done)break;db.exec('COMMIT');db.exec('BEGIN');}
 db.exec('COMMIT');reader.geometryHeight=actual;
 if(points.length!==5000)throw Error(`Expected 5000 anchors, captured ${points.length}`);
 const runCurrent=()=>points.map(p=>baseline(source,p));
 const runStream=()=>points.map(p=>actual(source,p));
 const bench=fn=>{reader.landscape.projectionCache.tiles.clear();const start=performance.now(),values=fn(),ms=performance.now()-start,warmStart=performance.now(),warmValues=fn();return{ms,values,warmMs:performance.now()-warmStart,warmValues};};
 bench(runCurrent);bench(runStream); // discard first-JIT/statement-prepare passes
 const results={anchors:points.length,rounds:[]};
 for(let round=0;round<4;round++){
  const order=round%2?['stream','current']:['current','stream'],values={};
  for(const name of order)values[name]=bench(name==='current'?runCurrent:runStream);
  if(values.current.values.some((v,i)=>!Object.is(v,values.stream.values[i])))throw Error(`Height mismatch at anchor ${values.current.values.findIndex((v,i)=>!Object.is(v,values.stream.values[i]))}`);
  if(values.current.warmValues.some((v,i)=>!Object.is(v,values.stream.warmValues[i])||!Object.is(v,values.current.values[i])))throw Error('Warm height mismatch');
  results.rounds.push({currentMs:values.current.ms,streamMs:values.stream.ms,ratio:values.stream.ms/values.current.ms,currentWarmMs:values.current.warmMs,streamWarmMs:values.stream.warmMs});
 }
 await writeFile(join(output,'result.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({...results,output}));
}finally{tiles.close();db.close();store.close();}
