const {writeFileSync}=require('node:fs');
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const Database=require('better-sqlite3');
const {AtlasLandscapeReader,LandscapeRasterizer}=require(process.cwd()+'/.build/terrain-base-samples-test.cjs');
const filename=process.argv[2];
if(!filename)throw Error('Pass the retained world-navigation profile workbench.sqlite path.');
const db=new Database(filename,{readonly:true});
const campaignId=db.prepare('SELECT campaign_id FROM atlas_landscape LIMIT 1').get().campaign_id;
const source={campaignId,epoch:'base-benchmark',reset:true,changes:[]};
const reader=new AtlasLandscapeReader(db);reader.sync(source);const stream=reader.terrainStream(source);
const result={filename,method:'Uncached base-paint phase plus finish; all other layers excluded equally. Alternating unfiltered/filtered order. Same readonly database; pixel equality required.',runs:[]};
const box={x:-60000000,y:-60000000,width:120000000,height:120000000};
for(const width of [64,128,512])for(let repeat=0;repeat<3;repeat++){
 const images=[];
 for(const filtered of repeat%2?[true,false]:[false,true]){
  const image=new LandscapeRasterizer(box,width,width),start=performance.now();let payloads=0;
  for(const r of stream('base',image.sampleBox,filtered?image.sampleLattice():undefined)){payloads++;image.paint(r);}
  const baseMs=performance.now()-start,pixels=image.finish();images.push(pixels);
  result.runs.push({width,repeat,filtered,payloads,baseMs});
 }
 assert.deepEqual(images[0],images[1]);
}
db.close();writeFileSync('.build/base-samples-measurement.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result.runs));
