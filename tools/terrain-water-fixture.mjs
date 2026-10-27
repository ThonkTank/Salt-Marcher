import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSync} from 'esbuild';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const manifestPath=path.join(root,'tools/fixtures/terrain-water/v1.json');
export const manifestBytes=await readFile(manifestPath);
export const manifest=JSON.parse(manifestBytes);
export const manifestHash=createHash('sha256').update(manifestBytes).digest('hex');
const require=createRequire(import.meta.url);
await mkdir(path.join(root,'.build/terrain-water-fixture'),{recursive:true});
buildSync({stdin:{contents:"export {CampaignStore} from './src/app/storage/store';export {heightRecord,TerrainSampler} from './src/app/terrain-height';",resolveDir:root},outfile:path.join(root,'.build/terrain-water-fixture/store.cjs'),bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,heightRecord,TerrainSampler}=require(path.join(root,'.build/terrain-water-fixture/store.cjs'));

/** Formula and source grids are versioned with the input manifest. No city,
 * routes, vegetation or room geometry participates in the measured scene. */
export function terrainWaterRecords(){
 const records=[];
 for(const [name,definition]of Object.entries(manifest.terrain)){
  if(typeof definition!=='object')continue;
  const {pixel,tiles}=definition,edge=64*pixel;
  for(const ty of tiles)for(const tx of tiles){
   const values=Float32Array.from({length:4096},(_,i)=>{
    const x=(tx*64+i%64)*pixel,y=(ty*64+Math.floor(i/64))*pixel;
    if(name==='coarse')return 250+3000*Math.sin(x/5000000)*Math.cos(y/7000000);
    if(name==='region')return 250+x*.08+160*Math.sin(x/700)*Math.cos(y/500)+40*Math.sin(x/70)*Math.sin(y/65);
    return 250+2*Math.sin(x/2)*Math.cos(y/3)+.5*Math.sin(x*2)*Math.sin(y*2);
   });
   records.push(heightRecord(tx*edge,ty*edge,pixel,values));
  }
 }
 return records;
}
export const heightPayloadHash=records=>createHash('sha256').update(JSON.stringify(records.filter(r=>r.height).sort((a,b)=>a.id.localeCompare(b.id)).map(r=>[r.id,r.height]))).digest('hex');
export async function createTerrainWaterFixture(profile){
 const filename=path.join(profile,'workbench.sqlite'),store=new CampaignStore(filename);
 try{
  const campaign=store.create('Terrain und Wasser v1',[]),active=store.activate(campaign.id),records=terrainWaterRecords();
  records.forEach((record,i)=>store.executeAtlasCommit({commandId:`terrain-water-v1-${i}`,campaignId:campaign.id,token:active.token,action:{kind:'landscape-put',record,expectedRevision:null}}));
  store.tutorial('skipped');
  const samples=new TerrainSampler(records,false);
  return{filename,campaignId:campaign.id,campaignName:campaign.name,manifestHash,fixtureHash:heightPayloadHash(records),records:records.length,heights:[-10000000,-1000,-2,0,2,1000,10000000].map(x=>({x,y:0,...samples.sample({x,y:0})}))};
 }finally{store.close();}
}
