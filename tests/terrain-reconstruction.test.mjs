import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {buildSync} from 'esbuild';
const require=createRequire(import.meta.url),Database=require('better-sqlite3');
buildSync({stdin:{resolveDir:process.cwd(),contents:"export * from './src/app/storage/store';export * from './src/app/storage/terrain-reconstruction';export * from './src/app/storage/atlas-landscape-region';export * from './src/app/terrain-height';export * from './src/app/terrain-interpolation';export * from './src/app/terrain-field-stream';export * from './src/app/terrain-projection-cache';export * from './src/app/storage/terrain-invalidation';"},bundle:true,platform:'node',format:'cjs',external:['better-sqlite3'],outfile:'.build/terrain-reconstruction-test.cjs'});
const {CampaignStore,installTerrainReconstruction,AtlasLandscapeReader,heightRecord,TerrainSampler,interpolateHeight,heightPatch,streamTerrainField,TerrainProjectionCache,changedHeightBounds,decodeHeights}=require('../.build/terrain-reconstruction-test.cjs');
const field=(pixel,fn)=>[-1,0].flatMap(y=>[-1,0].map(x=>heightRecord(x*64*pixel,y*64*pixel,pixel,Float32Array.from({length:4096},(_,i)=>fn((x*64+i%64)*pixel,(y*64+Math.floor(i/64))*pixel)))));
const plane=()=>field(1,(x,y)=>40+2*x+.25*y),point={x:.5,y:7.125};
test('bounded reconstruction keeps exact nodes, affine slopes and plateau extrema without Catmull overshoot',()=>{
 let seed=29;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32;};
 for(let n=0;n<2000;n++){
  const nodes=Float64Array.from({length:16},()=>rand()*200-100),x=rand(),y=rand(),corners=[nodes[5],nodes[6],nodes[9],nodes[10]],z=heightPatch(nodes,x,y,0);
  assert(z>=Math.min(...corners)-1e-10&&z<=Math.max(...corners)+1e-10);
  assert.equal(heightPatch(nodes,0,0,0),nodes[5]);assert.equal(heightPatch(nodes,1,1,0),nodes[10]);
 }
 const sampler=new TerrainSampler(plane(),false);
 for(const x of [-31.25,-.125,0,.5,31.75])for(const y of [-29.5,-.25,0,7.125])assert.equal(sampler.sample({x,y}).heightM,40+2*x+.25*y);
 for(let t=0;t<=1;t+=.002){assert.equal(interpolateHeight(-20,-20,-20,100,t),-20);assert.equal(interpolateHeight(-20,100,100,100,t),100);const z=interpolateHeight(-20,-20,100,100,t);assert(z>=-20&&z<=100);}
});
test('analytic hill error improves and derivatives remain continuous at interior tile seams',()=>{
 const fn=(x,y)=>20+90*Math.exp(-(x*x+y*y)/40000),sampler=new TerrainSampler(field(16,fn),false);let square=0,n=0;
 for(let y=-80;y<=80;y+=1.25)for(let x=-80;x<=80;x+=1.25){square+=(sampler.sample({x,y}).heightM-fn(x,y))**2;n++;}
 assert(Math.sqrt(square/n)<.022); // Bilinear baseline: 0.1634428 m.
 for(const x of [-16,0,16]){
  const h=1e-4,z=sampler.sample({x,y:7.125}).heightM,left=(z-sampler.sample({x:x-h,y:7.125}).heightM)/h,right=(sampler.sample({x:x+h,y:7.125}).heightM-z)/h;
  assert(Math.abs(left-right)<1e-5,{x,left,right});
 }
});
const fp=row=>createHash('sha256').update(JSON.stringify(row)).digest('hex');
const oldRow=row=>{
 if(!row)return row;const t=JSON.parse(row.payload).height;if(!t)return row;
 return{...row,min_x:t.x-t.pixel,max_x:t.x+64*t.pixel,min_y:t.y-t.pixel,max_y:t.y+64*t.pixel};
};
// Reconstruct schema-53 derived metadata, including the exact historical guards.
// The payloads and authored heights are deliberately unchanged.
function downgrade(db){
 const rows=db.prepare('SELECT * FROM atlas_landscape').all(),commands=db.prepare('SELECT * FROM atlas_command').all();
 db.transaction(()=>{
  for(const command of commands){const changes=JSON.parse(command.payload);for(const d of changes){if(d.table!=='atlas_landscape')continue;const live=rows.find(r=>r.campaign_id===d.key.campaign_id&&r.id===d.key.id)??null;for(const old of [d.before,d.after,live])if(fp(old)===d.guard){d.guard=fp(oldRow(old));break;}d.before=oldRow(d.before);d.after=oldRow(d.after);}db.prepare('UPDATE atlas_command SET payload=? WHERE campaign_id=? AND ordinal=?').run(JSON.stringify(changes),command.campaign_id,command.ordinal);}
  for(const r of rows){const old=oldRow(r);db.prepare('UPDATE atlas_landscape SET min_x=?,max_x=?,min_y=?,max_y=? WHERE campaign_id=? AND id=?').run(old.min_x,old.max_x,old.min_y,old.max_y,r.campaign_id,r.id);}
  db.pragma('user_version=53');
 })();
}
function fixture(t){
 const root=homedir()+'/.cache/saltmarcher/tests';mkdirSync(root,{recursive:true});const dir=mkdtempSync(root+'/reconstruction-'),file=dir+'/world.sqlite';
 const f={dir,file,store:new CampaignStore(file)};f.cam=f.store.create('Reconstruction');f.token=f.store.activateShell(f.cam.id).token;
 f.write=action=>f.store.executeAtlasCommit({commandId:randomUUID(),campaignId:f.cam.id,token:f.token,action});
 f.write({kind:'landscape-batch',records:plane().map(record=>({record,expectedRevision:null}))});
 f.reopen=()=>{f.store.close();f.store=new CampaignStore(file);f.token=f.store.activateShell(f.cam.id).token;};
 t.after(()=>{f.store.close();rmSync(dir,{recursive:true,force:true});});return f;
}
const payloads=db=>db.prepare('SELECT id,revision,payload FROM atlas_landscape ORDER BY id').all();
function checkBounds(db){for(const r of db.prepare('SELECT * FROM atlas_landscape').all()){const t=JSON.parse(r.payload).height;if(!t)continue;assert.deepEqual([r.min_x,r.max_x,r.min_y,r.max_y],[t.x-2*t.pixel,t.x+65*t.pixel,t.y-2*t.pixel,t.y+65*t.pixel]);}}
function readPoint(f){
 const db=new Database(f.file,{readonly:true});try{const reader=new AtlasLandscapeReader(db),source=f.store.atlasRegionSource(f.token);reader.sync(source);return streamTerrainField({x:point.x,y:point.y,dx:.1,dy:.1,columns:1,rows:1},0,(kind,box)=>reader.rows(source,box,true,0,0,kind),false).heights[0];}finally{db.close();}
}
test('schema 53 expands SQL reads without changing author bytes; undo/redo keeps the expanded footprint',t=>{
 const f=fixture(t),before=payloads(f.store.db);downgrade(f.store.db);
 assert(Math.abs(readPoint(f)-42.78125)>.001,'old footprints omit the outer neighbour');
 f.reopen();assert.equal(f.store.db.pragma('user_version',{simple:true}),54);assert.deepEqual(payloads(f.store.db),before);checkBounds(f.store.db);assert.equal(readPoint(f),42.78125);assert.equal(f.store.atlasHeight(f.token,point).heightM,42.78125);
 f.write({kind:'undo'});assert.equal(payloads(f.store.db).length,0);f.write({kind:'redo'});checkBounds(f.store.db);assert.equal(readPoint(f),42.78125);f.reopen();assert.equal(readPoint(f),42.78125);
});
test('schema 53 migrates a redo cursor whose guard was rebased by an earlier undo',t=>{
 const f=fixture(t),record=plane().at(-1);record.height=heightRecord(0,0,1,new Float32Array(4096).fill(300)).height;
 f.write({kind:'landscape-put',record,expectedRevision:1});f.write({kind:'undo'});const before=payloads(f.store.db);downgrade(f.store.db);f.reopen();assert.deepEqual(payloads(f.store.db),before);
 f.write({kind:'redo'});assert.equal(f.store.atlasHeight(f.token,{x:10,y:10}).heightM,300);checkBounds(f.store.db);
 f.write({kind:'undo'});assert.equal(readPoint(f),42.78125);f.write({kind:'undo'});assert.equal(payloads(f.store.db).length,0);f.write({kind:'redo'});checkBounds(f.store.db);
});
test('migration never repairs an unknown conflicting history guard',t=>{
 const f=fixture(t);downgrade(f.store.db);const row=f.store.db.prepare('SELECT * FROM atlas_command').get(),changes=JSON.parse(row.payload);changes[0].guard='conflicting external change';f.store.db.prepare('UPDATE atlas_command SET payload=?').run(JSON.stringify(changes));f.reopen();
 assert.equal(JSON.parse(f.store.db.prepare('SELECT payload FROM atlas_command').get().payload)[0].guard,'conflicting external change');const before=payloads(f.store.db);assert.throws(()=>f.write({kind:'undo'}),/Spätere Änderung/);assert.deepEqual(payloads(f.store.db),before);
});
test('failed metadata migration rolls history, heights and schema back together',t=>{
 const f=fixture(t);downgrade(f.store.db);const before=f.store.db.prepare('SELECT * FROM atlas_landscape ORDER BY id').all(),history=f.store.db.prepare('SELECT * FROM atlas_command').all();
 f.store.db.exec("CREATE TEMP TRIGGER reject_reconstruction BEFORE UPDATE ON atlas_landscape BEGIN SELECT RAISE(ABORT,'migration failure'); END");
 assert.throws(()=>f.store.db.transaction(()=>{installTerrainReconstruction(f.store.db);f.store.db.pragma('user_version=54');})(),/migration failure/);
 assert.deepEqual(f.store.db.prepare('SELECT * FROM atlas_landscape ORDER BY id').all(),before);assert.deepEqual(f.store.db.prepare('SELECT * FROM atlas_command').all(),history);assert.equal(f.store.db.pragma('user_version',{simple:true}),53);
});
test('schema 53 archive preview stays read-only and imported heights receive full support',async t=>{
 const f=fixture(t),file=f.dir+'/old-archive.sqlite';await f.store.campaignSnapshot(f.token,file);const db=new Database(file);downgrade(db);db.close();const bytes=readFileSync(file);
 assert.equal(f.store.campaignPreview(file).schema,53);assert.deepEqual(readFileSync(file),bytes);
 const copy=f.store.acceptCampaignSnapshot(file,'Copied',{});assert.deepEqual(readFileSync(file),bytes);checkBounds(f.store.db);
 f.cam=copy;f.token=f.store.activateShell(copy.id).token;assert.equal(readPoint(f),42.78125);f.reopen();assert.equal(readPoint(f),42.78125);
});

test('a changed outer tangent invalidates warm field, mesh and colour caches beyond the former one-cell support',()=>{
 let records=plane();const cache=new TerrainProjectionCache(),read=kind=>kind==='height'?records:[],lattice={x:.25,y:7.125,dx:.05,dy:.05,columns:7,rows:7},box={x:.2,y:7.1,width:.4,height:.4};
 const oldField=cache.field(lattice,0,read,true),oldGrid=cache.grid(lattice,0,read);cache.rememberPixels('outer-neighbour',box,new Uint8Array([1,2,3,4]));
 const previous=records.find(r=>r.height.x===-64&&r.height.y===0),values=decodeHeights(previous.height).slice();values[7*64+63]-=30;
 const next=heightRecord(-64,0,1,values),changed=changedHeightBounds(previous,next);assert.deepEqual(changed,{x:-3,y:5,width:4,height:4});records=records.map(r=>r===previous?next:r);
 cache.invalidate([changed]);const cold=streamTerrainField(lattice,0,read),warm=cache.field(lattice,0,read,true);
 assert.notDeepEqual(warm.heights,oldField.heights);assert.notDeepEqual(cold.surface,oldGrid);assert.deepEqual(warm,cold);assert.deepEqual(cache.grid(lattice,0,read),cold.surface);assert.equal(cache.cachedPixels('outer-neighbour'),undefined);
});
