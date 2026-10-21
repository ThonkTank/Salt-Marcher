// Compare the actual readonly fallback against an explicit earlier reader/raster
// implementation. Both bundles share the current storage/schema and fixture.
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=process.cwd(),out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/atlas-raster-slices'),require=createRequire(import.meta.url);
const ref=process.argv[2];if(!ref)throw Error('Pass the baseline Git ref explicitly.');
mkdirSync(out,{recursive:true});
const files=['src/app/landscape-raster.ts','src/app/storage/atlas-landscape-region.ts'];
const baseline=new Map(files.map(file=>[path.join(root,file),execFileSync('git',['show',ref+':'+file],{encoding:'utf8'})]));
const versions={};
for(const version of ['baseline','current']){
 const filename=out+'/'+version+'.cjs';
 buildSync({stdin:{resolveDir:root,contents:"export * from './src/app/storage/store';export * from './src/app/storage/atlas-landscape-region';export * from './src/app/terrain-height';"},outfile:filename,bundle:true,platform:'node',format:'cjs',external:['better-sqlite3'],plugins:version==='baseline'?[{name:'baseline-raster',setup(build){build.onLoad({filter:/\.ts$/},args=>baseline.has(args.path)?{contents:baseline.get(args.path),loader:'ts'}:undefined);}}]:[]});
 versions[version]=require(filename);
}
const base=homedir()+'/.cache/saltmarcher/tests';mkdirSync(base,{recursive:true});const profile=mkdtempSync(base+'/raster-slices-');
const {CampaignStore,heightRecord}=versions.current,store=new CampaignStore(profile+'/world.sqlite'),campaign=store.create('Raster coverage'),token=store.activate(campaign.id).token;
for(const pixel of [1024,16])for(let y=-1;y<1;y++)for(let x=-1;x<1;x++)store.executeAtlasCommit({token,campaignId:campaign.id,commandId:randomUUID(),action:{kind:'landscape-put',expectedRevision:null,record:heightRecord(x*64*pixel,y*64*pixel,pixel,Float32Array.from({length:4096},(_,i)=>pixel===1024?20:20+90*Math.exp(-((x*1024+i%64*16)**2+(y*1024+Math.floor(i/64)*16)**2)/40000)))}});
const source=store.atlasRegionSource(token),query={box:{x:-438.077,y:-355.054,width:876.154,height:710.108},width:1986,height:1610,scopeId:null,floorId:'ground',slice:null,roofs:true,terrainRaster:true,contours:-1};
const Database=require('better-sqlite3'),{PNG}=require('pngjs'),runs=[];let reference;
try{
 for(const version of ['baseline','current','current','baseline']){
  const db=new Database(store.filename,{readonly:true}),reader=new versions[version].AtlasLandscapeReader(db);
  try{
   reader.sync(source);const start=performance.now(),layer=reader.read(source,query,4*1024*1024),ms=performance.now()-start;
   assert.equal(layer.state,'ready');const decoded=layer.tiles.map(t=>({...t,pixels:PNG.sync.read(Buffer.from(t.data.split(',')[1],'base64')).data}));
   if(!reference)reference=decoded;
   for(const tile of decoded){
    const old=reference.find(r=>r.box.x<=tile.box.x&&r.box.y<=tile.box.y&&r.box.x+r.box.width>=tile.box.x+tile.box.width&&r.box.y+r.box.height>=tile.box.y+tile.box.height);assert(old);
    const dx=old.box.width/old.width,dy=old.box.height/old.height,left=(tile.box.x-old.box.x)/dx,top=(tile.box.y-old.box.y)/dy;
    assert.equal(tile.box.width/tile.width,dx);assert.equal(tile.box.height/tile.height,dy);assert(Number.isInteger(left)&&Number.isInteger(top));
    for(let y=0;y<tile.height;y++)assert.equal(Buffer.compare(tile.pixels.subarray(y*tile.width*4,(y+1)*tile.width*4),old.pixels.subarray(((y+top)*old.width+left)*4,((y+top)*old.width+left+tile.width)*4)),0,'identical retained pixels');
   }
   const row={version,ms,tiles:layer.tiles.map(({box,width,height})=>({box,width,height})),pixels:layer.tiles.reduce((n,t)=>n+t.width*t.height,0),bytes:Buffer.byteLength(JSON.stringify(layer))};runs.push(row);console.log(JSON.stringify(row));
  }finally{db.close();}
 }
}finally{
 store.close();writeFileSync(out+'/result.json',JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),baseline:execFileSync('git',['rev-parse',ref],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),baselineFiles:files,profile,query,runs},null,2));
}
