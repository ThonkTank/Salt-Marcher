import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url),Database=require('better-sqlite3');
buildSync({stdin:{contents:`export * from './src/app/storage/store';export * from './src/app/storage/atlas-region';export * from './src/app/storage/atlas-material-tiles';export * from './src/app/terrain-material';export * from './src/app/atlas-material-tile';export * from './src/app/terrain-height';export * from './src/app/terrain-relief';export * from './src/app/atlas-landscape';export * from './src/app/vegetation';`,resolveDir:process.cwd()},outfile:'.build/atlas-material-tiles-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,AtlasRegionReader,AtlasMaterialTiles,heightRecord,DEFAULT_TERRAIN_STYLE,emptyRecord,vegetationSpec,CHANNEL_NAMES,atlasMaterialTileQuery}=require('../.build/atlas-material-tiles-test.cjs');
const near={lod:0,x:0,y:0},far={lod:0,x:8,y:0},parent={lod:2,x:0,y:0};
const polygon=(x,y,w,h)=>({outer:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],holes:[]});
function fixture(t){
 const base=homedir()+'/.cache/saltmarcher/tests';mkdirSync(base,{recursive:true});const dir=mkdtempSync(base+'/atlas-material-');
 const store=new CampaignStore(dir+'/world.sqlite'),campaign=store.create('Raw materials'),token=store.activateShell(campaign.id).token;
 const write=action=>store.executeAtlasCommit({commandId:randomUUID(),campaignId:campaign.id,token,action});
 let db,reader,tiles,cursor,calls=[];
 const reopen=()=>{tiles?.close();db?.close();db=new Database(store.filename,{readonly:true});reader=new AtlasRegionReader(db);tiles=new AtlasMaterialTiles(db,dir+'/cache');cursor=undefined;
  const raster=reader.materialSteps.bind(reader);reader.materialSteps=(...args)=>{calls.push([...args[2]]);return raster(...args);};};reopen();
 t.after(()=>{tiles.close();db.close();store.close();rmSync(dir,{recursive:true,force:true});});
 const read=async(tile=near,overrides={})=>{cursor=store.atlasRegionSource(token,cursor);db.exec('BEGIN');try{await reader.sync(cursor,false);const steps=tiles.read({...cursor,...overrides},{tile,revision:cursor.revision},reader);for(;;){const step=steps.next();if(step.done){db.exec('COMMIT');return step.value;}}}catch(e){db.exec('ROLLBACK');throw e;}};
 const put=record=>write({kind:'landscape-put',record,expectedRevision:db.prepare('SELECT revision FROM atlas_landscape WHERE campaign_id=? AND id=?').get(campaign.id,record.id)?.revision??null});
 return {dir,store,write,read,reopen,put,calls,style:style=>write({kind:'landscape-terrain-style',style:{...DEFAULT_TERRAIN_STYLE,...style}})};
}
const assertStates=(result,expected)=>{for(const c of CHANNEL_NAMES)assert.equal(result.cache[c],expected[c]??'hit',c);};

test('raw channels persist across restart; lighting, analysis mode, contours and names cannot invalidate them',async t=>{
 const f=fixture(t);f.put(heightRecord(0,0,4,new Float32Array(4096).fill(2800)));f.style({snowlineM:2500});
 const named={...emptyRecord('patch'),id:'named-biome',order:1,name:'Before',polygons:[polygon(8,8,16,16)],values:{terrain:'forest'}};f.put(named);
 const first=await f.read();assertStates(first,Object.fromEntries(CHANNEL_NAMES.map(c=>[c,'built'])));assert.equal(f.calls.length,1,'one shared cold raster');
 f.reopen();const warm=await f.read();assertStates(warm,{});assert.deepEqual(warm.channels,first.channels);assert.equal(f.calls.length,1);
 f.put({...named,name:'After'});const renamed=await f.read();assertStates(renamed,{});assert.deepEqual(renamed.channels,first.channels);assert.equal(f.calls.length,1);
 f.style({snowlineM:2500,lightDegrees:45,strength:0,ink:'#ff0000',mode:'height'});f.reopen();
 const light=await f.read();assertStates(light,{});assert.deepEqual(light.channels,first.channels);assert.equal(f.calls.length,1);
 assert.throws(()=>atlasMaterialTileQuery({tile:near,revision:0,contours:100}),/Materialkachel/);
 assert(!('waterTopology' in light.channels),'internal dependency metadata is not a display channel');
});

test('snowline rebuilds only snow, pigment only base colour, vegetation density only forest',async t=>{
 const f=fixture(t);f.put(heightRecord(0,0,4,new Float32Array(4096).fill(2800)));f.style({snowlineM:2500});
 const woods={...emptyRecord('vegetation'),id:'woods',order:1,vegetation:vegetationSpec(),values:{terrain:'forest'},polygons:[polygon(4,4,240,240)]};f.put(woods);
 const first=await f.read();f.style({snowlineM:3000});const snow=await f.read();assertStates(snow,{snow:'built'});assert.notDeepEqual(snow.channels.snow,first.channels.snow);assert.deepEqual(f.calls.at(-1),['snow']);
 const paint={...emptyRecord('patch'),id:'pigment',polygons:[polygon(8,8,32,32)],paint:{version:2,operation:'paint',color:'#ff0000',opacity:1,target:'ground',flow:1,tip:'round',radius:4,seed:7,fill:true}};f.put(paint);
 const painted=await f.read();assertStates(painted,{baseColor:'built'});assert.notDeepEqual(painted.channels.baseColor,snow.channels.baseColor);assert.deepEqual(f.calls.at(-1),['baseColor']);
 f.put({...woods,vegetation:{...woods.vegetation,preset:{...woods.vegetation.preset,density:.1}}});const thin=await f.read();assertStates(thin,{forest:'built'});assert.notDeepEqual(thin.channels.forest,painted.channels.forest);assert.deepEqual(f.calls.at(-1),['forest']);
});

test('dry height changes preserve ground colour and forest; local parents update while distant tiles reuse; Undo restores',async t=>{
 const f=fixture(t);f.write({kind:'landscape-sea-level',seaLevelM:-10000});f.put(heightRecord(0,0,4,new Float32Array(4096).fill(100)));f.style({snowlineM:120});
 const original=await f.read();await f.read(far);await f.read(parent);
 f.put(heightRecord(0,0,4,new Float32Array(4096).fill(400)));f.reopen();
 const changed=await f.read();assertStates(changed,{water:'built',rock:'built',snow:'built'});assert.deepEqual(changed.channels.baseColor,original.channels.baseColor);assert.deepEqual(changed.channels.forest,original.channels.forest);
 assertStates(await f.read(far),{});const coarse=await f.read(parent);assert.equal(coarse.cache.snow,'built');
 f.write({kind:'undo'});const undone=await f.read();assert.deepEqual(undone.channels,original.channels);
});

test('equal water coverage with different subpixel topology cannot reuse the old painted colour',async t=>{
 const f=fixture(t);f.put(heightRecord(0,0,4,new Float32Array(4096).fill(100)));
 const lake={...emptyRecord('patch'),id:'lake',surface:'freshwater',waterLevelM:150,polygons:[polygon(8,8,.5,8)]};f.put(lake);
 f.put({...emptyRecord('patch'),id:'water-pigment',polygons:[polygon(8,8,.5,8)],paint:{version:2,operation:'paint',color:'#ff0000',opacity:1,target:'water',flow:1,tip:'round',radius:4,seed:7,fill:true}});
 const left=await f.read();f.put({...lake,polygons:[polygon(8.5,8,.5,8)]});f.reopen();const right=await f.read();
 assert.deepEqual(left.channels.water,right.channels.water,'same half-covered output pixels');
 assert.equal(right.cache.baseColor,'built');assert.notDeepEqual(left.channels.baseColor,right.channels.baseColor,'subpixel pigment/water intersection changed');
});

test('one missing cache channel rebuilds only that product and never publishes an incomplete tile',async t=>{
 const f=fixture(t);const original=await f.read();f.reopen();const db=new Database(f.dir+'/cache/tiles-v2/atlas-tiles.sqlite');
 db.prepare('DELETE FROM atlas_tile_cache WHERE key=?').run(JSON.stringify(['material',0,0,0,'snow']));db.close();
 const result=await f.read();assertStates(result,{snow:'built'});assert.deepEqual(result.channels,original.channels);assert.deepEqual(f.calls.at(-1),['snow']);
});

test('shadow and untracked material sources stay ephemeral; stale revisions reject',async t=>{
 const f=fixture(t);assertStates(await f.read(near,{shapeVersion:undefined}),Object.fromEntries(CHANNEL_NAMES.map(c=>[c,'disabled'])));
 assertStates(await f.read(near,{shadow:{filename:'preview',scopeId:'local',epoch:'preview',sequence:0}}),Object.fromEntries(CHANNEL_NAMES.map(c=>[c,'disabled'])));
 await assert.rejects(f.read(near,{revision:-1}),/inzwischen geändert/);
});


test('material fingerprints preserve adjacent SQLite rowids beyond JavaScript integer precision',async t=>{
 const f=fixture(t);f.put(heightRecord(0,0,4,new Float32Array(4096).fill(100)));
 const a={...emptyRecord('patch'),id:'huge-a',order:1,polygons:[polygon(4,4,16,16)],values:{terrain:'forest'}},b={...a,id:'huge-b',order:2,polygons:[polygon(32,4,16,16)]};f.put(a);f.put(b);
 f.store.db.prepare('UPDATE atlas_landscape SET rowid=CAST(? AS INTEGER) WHERE id=?').run('9007199254740992',a.id);
 f.store.db.prepare('UPDATE atlas_landscape SET rowid=CAST(? AS INTEGER) WHERE id=?').run('9007199254740993',b.id);
 const first=await f.read();f.put({...b,values:{terrain:'desert'}});f.reopen();const next=await f.read();
 assert.equal(next.cache.baseColor,'built');assert.notDeepEqual(next.channels.baseColor,first.channels.baseColor);
});
