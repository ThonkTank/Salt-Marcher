import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/terrain-relief';export * from './src/app/terrain-height';export * from './src/app/terrain-brush';export * from './src/app/landscape-raster';export * from './src/app/atlas-brush-worker';export * from './src/app/storage/store';export * from './src/app/storage/atlas-landscape-region';",resolveDir:process.cwd()},outfile:'.build/terrain-relief-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {DEFAULT_TERRAIN_STYLE,validateTerrainStyle,reliefMarks,LandscapeRasterizer,heightRecord,settingsRecord,CampaignStore,AtlasLandscapeReader,renderBrushPreview}=require('../.build/terrain-relief-test.cjs');
const plane=fn=>{const rs=[];for(let y=-2;y<2;y++)for(let x=-2;x<2;x++)rs.push(heightRecord(x*64,y*64,1,Float32Array.from({length:4096},(_,i)=>fn(x*64+i%64,y*64+Math.floor(i/64)))));return rs;};
const box={x:-32,y:-32,width:64,height:64};
function pixels(rs,b=box,w=64,h=64,mpp=b.width/w){const image=new LandscapeRasterizer(b,w,h,0,mpp);rs.forEach(r=>image.paint(r));return image.finish();}
function setting(mode='drawn',extra={}){const r=settingsRecord(0);r.terrainSettings.style={...DEFAULT_TERRAIN_STYLE,mode,...extra};return r;}
test('flat high ground stays quiet; steep low ground gets ink; no height-driven snow',()=>{
 const flat=plane(()=>2800),low=plane((x,y)=>100+x*.3+y*.3);
 assert.deepEqual(pixels([...flat,setting()]),pixels([...flat,setting('shaded')]));
 assert.notDeepEqual(pixels([...low,setting()]),pixels([...low,setting('shaded')]));
 assert.deepEqual([...pixels([...flat,setting()]).slice(0,3)],[238,229,207]);
 assert.notDeepEqual(pixels([...flat,setting('height')]),pixels([...flat,setting()]));
});
test('hachures and ridges match across negative-coordinate raster boundaries and camera crops',()=>{
 const rs=[...plane((x,y)=>400+x*.7+Math.sin(y/15)*30),setting()];
 const whole=pixels(rs),left=pixels(rs,{...box,width:32},32),right=pixels(rs,{...box,x:0,width:32},32);
 for(let y=0;y<64;y++){assert.deepEqual(whole.slice(y*256,y*256+128),left.slice(y*128,(y+1)*128));assert.deepEqual(whole.slice(y*256+128,(y+1)*256),right.slice(y*128,(y+1)*128));}
 const crop=pixels(rs,{x:-16,y:-16,width:32,height:32},32,32);
 for(let y=0;y<32;y++)assert.deepEqual(crop.slice(y*128,(y+1)*128),whole.slice(((y+16)*64+16)*4,((y+16)*64+48)*4));
});
test('world anchored marks crossfade at LOD thresholds instead of being regenerated on zoom',()=>{
 const sample=p=>({heightM:p.x,water:false,sx:.4,sy:.3}),b={x:-200,y:-200,width:400,height:400};
 const a=reliefMarks(b,64/11*(1-1e-5),sample,.65),c=reliefMarks(b,64/11*(1+1e-5),sample,.65);
 assert.equal(a.length,c.length);for(let i=0;i<a.length;i++){assert.deepEqual(a[i].points,c[i].points);assert(Math.abs(a[i].opacity-c[i].opacity)<.0001);}
});
test('style changes preserve metres, sea level, pigment and exact preview pixels',()=>{
 const rs=[...plane((x,y)=>250+x*.3+y*.6),setting('drawn',{lightDegrees:80,ink:'#273849'})],before=JSON.stringify(rs);
 assert.deepEqual(renderBrushPreview({generation:1,records:rs,box,width:64,height:64}),pixels(rs));
 assert.equal(JSON.stringify(rs),before);
 assert.notDeepEqual(pixels(rs),pixels([...rs.filter(r=>!r.terrainSettings),setting('drawn',{lightDegrees:260})]));
 for(const bad of [{strength:NaN},{lightDegrees:360},{mode:'snow'},{ink:'red'},{extra:true}])assert.throws(()=>validateTerrainStyle({...DEFAULT_TERRAIN_STYLE,...bad}),/Reliefstil/);
});
test('style persists, undoes atomically, invalidates distant cached tiles, and survives sea-level edits',t=>{
 const root=homedir()+'/.cache/saltmarcher/test-workspaces';mkdirSync(root,{recursive:true});const dir=mkdtempSync(root+'/r4-');let store=new CampaignStore(dir+'/world.sqlite'),cam=store.create('R4'),active=store.activate(cam.id);
 const write=action=>store.executeAtlasCommit({commandId:randomUUID(),campaignId:cam.id,token:active.token,action});
 write({kind:'landscape-height-stroke',stroke:{mode:'raise',radius:64,strength:600,feather:1,samples:[{x:1000,y:1000,t:0},{x:1000,y:1000,t:1000}]}});
 const before=store.atlasHeight(active.token,{x:1000,y:1000}),Database=require('better-sqlite3'),db=new Database(dir+'/world.sqlite',{readonly:true}),reader=new AtlasLandscapeReader(db);
 t.after(()=>{db.close();store.close();rmSync(dir,{recursive:true,force:true});});
 const q={box:{x:970,y:970,width:60,height:60},width:128,height:128,scopeId:null,floorId:'ground',slice:null,roofs:true};
 const read=()=>{const source=store.atlasRegionSource(active.token);reader.sync(source);return reader.read(source,q,2*1024*1024);};
 const original=read(),style={...DEFAULT_TERRAIN_STYLE,mode:'height',land:'#ceceae',lightDegrees:90};
 write({kind:'landscape-terrain-style',style});const changed=read();assert.notDeepEqual(original.tiles,changed.tiles);assert.deepEqual(changed.terrainStyle,style);assert.equal(store.atlasHeight(active.token,{x:1000,y:1000}).heightM,before.heightM);
 write({kind:'undo'});assert.equal(read().terrainStyle,undefined);write({kind:'redo'});assert.deepEqual(read().terrainStyle,style);
 write({kind:'landscape-sea-level',seaLevelM:20});assert.deepEqual(read().terrainStyle,style);assert.equal(read().seaLevelM,20);
 store.close();store=new CampaignStore(dir+'/world.sqlite');active=store.activate(cam.id);assert.deepEqual(store.atlasMaskRegion(active.token,q.box).records.find(r=>r.terrainSettings).terrainSettings,{version:1,seaLevelM:20,style});
});
