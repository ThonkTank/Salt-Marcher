import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/storage/store';export * from './src/app/storage/atlas-landscape-region';export * from './src/app/atlas-landscape';export * from './src/app/terrain-height';export * from './src/app/terrain-route';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['better-sqlite3'],outfile:'.build/terrain-kind-index-test.cjs'});
const {CampaignStore,AtlasLandscapeReader,bounds,emptyRecord,heightRecord,routeSpec}=require('../.build/terrain-kind-index-test.cjs');
const kinds=['height','route','lake'];
const polygon={outer:[{x:0,y:0},{x:64,y:0},{x:64,y:64},{x:0,y:64}],holes:[]};
function record(kind,id,i=0){
 const resolution=2**(i%4),order=i%3?i%7:undefined;
 if(kind==='height')return {...heightRecord(0,0,resolution,new Float32Array(4096).fill(i)),id,order};
 if(kind==='route'){const points=[{x:0,y:0},{x:64,y:64}];return {...emptyRecord('road'),id,points,route:routeSpec('road',points),resolution,order};}
 return {...emptyRecord('patch'),id,polygons:[polygon],resolution,order,...(kind==='lake'?{surface:'freshwater',waterLevelM:30}:{values:{terrain:'forest'}})};
}
test('sparse terrain kinds use ordered indexes and preserve exact streams through metadata changes',t=>{
 const root=homedir()+'/.cache/saltmarcher/tests';mkdirSync(root,{recursive:true});const dir=mkdtempSync(root+'/terrain-kind-'),store=new CampaignStore(dir+'/world.sqlite'),campaign=store.create('Sparse terrain kinds'),token=store.activate(campaign.id).token,db=store.db;
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 const insert=db.prepare('INSERT INTO atlas_landscape(rowid,campaign_id,id,revision,min_x,max_x,min_y,max_y,payload) VALUES(?,?,?,?,?,?,?,?,?)');let row=9007199254740993n;
 const put=r=>{const b=bounds(r);insert.run((row++).toString(),campaign.id,r.id,1,b.x,b.x+b.width,b.y,b.y+b.height,JSON.stringify(r));};
 db.transaction(()=>{for(let i=0;i<10000;i++)put(record('base',`base:${i}`));for(let i=0;i<133;i++)for(const kind of kinds)put(record(kind,`${kind}:${i}`,i));})();
 const reader=new AtlasLandscapeReader(db);let source=store.atlasRegionSource(token);reader.sync(source);
 const plans=[],sql=reader.sql.bind(reader);
 reader.sql=text=>{const statement=sql(text);return text.startsWith('SELECT CAST(m.source_row')?{iterate(...args){plans.push(db.prepare('EXPLAIN QUERY PLAN '+text).all(...args).map(r=>r.detail).join('\n'));return statement.iterate(...args);}}:statement;};
 const box={x:-300,y:-300,width:1000,height:1000};
 function check(){
  for(const kind of kinds){
   for(const samples of [undefined,{columns:31,rows:27}]){
    const actual=[...reader.terrainStream(source)(kind,box,samples)],plan=plans.at(-1);
    assert.match(plan,new RegExp('USING INDEX landscape_'+kind+'_order'));
    assert.doesNotMatch(plan,/USE TEMP B-TREE/,'canonical order should stream directly from the sparse index');
    const definition=db.prepare('SELECT sql FROM temp.sqlite_master WHERE name=?').get('landscape_'+kind+'_order').sql;
    db.exec('DROP INDEX temp.landscape_'+kind+'_order');
    const expected=[...reader.terrainStream(source)(kind,box,samples)];db.exec(definition);
    assert.deepEqual(actual,expected,`${kind} order, payloads and sample support`);
   }
  }
 }
 check();
 const changed=record('lake','height:0',5),b=bounds(changed);
 db.prepare('UPDATE atlas_landscape SET payload=?,min_x=?,max_x=?,min_y=?,max_y=? WHERE id=?').run(JSON.stringify(changed),b.x,b.x+b.width,b.y,b.y+b.height,changed.id);
 db.prepare('DELETE FROM atlas_landscape WHERE id=?').run('route:0');put(record('height','new-height',7));
 source={...source,reset:false,revision:source.revision+1,changes:[changed.id,'route:0','new-height'].map(id=>({table:'atlas_landscape',id}))};reader.sync(source);check();
 assert([...reader.terrainStream(source)('lake',box)].some(r=>r.id==='height:0'));
 assert(![...reader.terrainStream(source)('height',box)].some(r=>r.id==='height:0'));
 assert(![...reader.terrainStream(source)('route',box)].some(r=>r.id==='route:0'));
 assert([...reader.terrainStream(source)('height',box)].some(r=>r.id==='new-height'));
});
