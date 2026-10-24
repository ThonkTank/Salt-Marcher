import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const referenceCommit='16eb0aa8807ac21704abfea5412ac3a22033a23a';
export const referencePath='tests/fixtures/atlas/mixed-world.sqlite.gz';
const format=JSON.parse(readFileSync(new URL('../src/app/data-format.json',import.meta.url)));
const quote=name=>'"'+name.replaceAll('"','""')+'"';

// Stored values include IDs, history, payload bytes and bindings. SQLite page
// layout and indexes are deliberately excluded from the content identity.
export function referenceContents(db){
 return Object.fromEntries(format.tables.map(table=>{
  const columns=db.prepare(`PRAGMA table_info(${quote(table)})`).all().map(c=>quote(c.name));
  const hash=createHash('sha256');let count=0;
  for(const row of db.prepare(`SELECT * FROM ${quote(table)} ORDER BY ${columns.join(',')}`).iterate()){
   hash.update(JSON.stringify(row)+'\n');count++;
  }
  return [table,{count,sha256:hash.digest('hex')}];
 }));
}

export function assertReferenceInventory(db){
 const count=where=>db.prepare(`SELECT count(*) n FROM atlas_landscape WHERE ${where}`).get().n;
 for(const [name,where,expected] of [
  ['height',"json_extract(payload,'$.height') IS NOT NULL",1028],
  ['place',"json_extract(payload,'$.kind')='place'",5000],
  ['road',"json_extract(payload,'$.kind')='road'",1024],
  ['vegetation',"json_extract(payload,'$.kind')='vegetation'",1024],
  ['source cells',"json_extract(payload,'$.sourceCell') IS NOT NULL",100000],
 ])assert.equal(count(where),expected,`Reference world: ${name}`);
 assert.equal(db.prepare('SELECT count(*) n FROM room_group').get().n,5000);
 assert.equal(db.prepare('SELECT count(*) n FROM room').get().n,15701);
 assert.equal(db.prepare("SELECT count(*) n FROM room WHERE scope_id='mixed-dungeon'").get().n,4001);
 assert.deepEqual(db.pragma('foreign_key_check'),[]);
 assert.equal(db.pragma('integrity_check',{simple:true}),'ok');
}

export function assertReferenceContents(db,manifest){
 assert.equal(manifest.sourceCommit,referenceCommit);assert.equal(manifest.sourcePath,referencePath);
 assertReferenceInventory(db);
 assert.deepEqual(referenceContents(db),manifest.tables,'The complete reference world must retain its original stored contents');
}

// Compare a fixed map-only window in the original 1280×852 native captures.
// The 200% run doubles the window dimensions, keeping the CSS layout/world view.
// Per-channel error tolerates raster/AA differences; palette populations ensure
// that a small road or marker cannot disappear inside a large background average.
export function assertReferenceMapImage(actual,expected,{markerVisible=true}={}){
 assert.equal(actual.width/expected.width,actual.height/expected.height,'Reference viewport aspect ratio');
 const scale=actual.width/expected.width;
 const colors={land:[238,229,207],forest:[159,167,129],road:[163,126,81],marker:[91,67,56]};
 const populations=Object.fromEntries(Object.keys(colors).map(k=>[k,{expected:0,actual:0}]));
 let error=0,pixels=0;
 for(let y=250;y<610;y++)for(let x=575;x<1280;x++){
  const a=(Math.floor((y+.5)*scale)*actual.width+Math.floor((x+.5)*scale))*4,b=(y*expected.width+x)*4;
  for(let c=0;c<3;c++)error+=Math.abs(actual.data[a+c]-expected.data[b+c]);
  for(const [key,color] of Object.entries(colors)){
   const near=(image,i,rendered=false)=>{
    // The overview road now blends at its visibility threshold. Preserve
    // the frozen reference population and allow only a small brown palette
    // shift in the rendered image (neither green forest nor bare land).
    if(key==='road'&&rendered)return color.every((v,c)=>Math.abs(image.data[i+c]-v)<=13);
    if(key!=='forest')return color.every((v,c)=>Math.abs(image.data[i+c]-v)<=4);
    // Cartographic canopy modulates luminance, not forest coverage or hue.
    // Keep the frozen image and population threshold; accept only its green
    // palette along the bounded shading axis, never water or bare ground.
    const shade=image.data[i+1]/color[1];
    return shade>=.7&&shade<=1.15&&Math.abs(image.data[i]-color[0]*shade)<=5&&Math.abs(image.data[i+2]-color[2]*shade)<=5;
   };
   if(near(expected,b))populations[key].expected++;
   if(near(actual,a,true))populations[key].actual++;
  }
  pixels++;
 }
 const meanChannelError=error/(pixels*3);
 assert(meanChannelError<=12,`Reference map changed: mean RGB error ${meanChannelError}`);
 for(const [key,p] of Object.entries(populations))if((key!=='marker'||markerVisible)&&p.expected>=(key==='marker'?4:100)){
  assert(p.actual>=p.expected*.65,`Visible ${key} missing: ${JSON.stringify(p)}`);
 }
 return {meanChannelError,populations};
}
