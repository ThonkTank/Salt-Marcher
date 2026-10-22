import {test} from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
const require=createRequire(import.meta.url);
buildSync({stdin:{resolveDir:process.cwd(),contents:"export * from './src/app/storage/store';export * from './src/app/storage/atlas-landscape-region';export * from './src/app/storage/landscape-record-stream';export * from './src/app/landscape-raster';export * from './src/app/terrain-height';export * from './src/app/vegetation';"},outfile:'.build/terrain-pigment-stream-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,AtlasLandscapeReader,LANDSCAPE_COLOR_INDEX,LANDSCAPE_COVER_INDEX,vegetationSpec,LandscapeRasterizer,heightRecord,settingsRecord}=require('../.build/terrain-pigment-stream-test.cjs');
const polygon=[{outer:[{x:-64,y:-64},{x:128,y:-64},{x:128,y:128},{x:-64,y:128}],holes:[]}];
const pigment=(i,extra={})=>({id:'paint'+i,revision:1,kind:'patch',name:'',width:0,resolution:2**(i%4),order:i%2?i*13%19:undefined,points:[{x:0,y:0},{x:40,y:20}],polygons:polygon,values:{},paint:{version:2,operation:'paint',target:'ground',color:i%2?'#967755':'#778866',opacity:.3,flow:.7,tip:'soft',radius:30,seed:i,...extra}});

for(const kind of ['color','cover'])test(`paged ${kind} reads preserve canonical order and exact rowids, without an open SQL statement between records`,t=>{
 const base=homedir()+'/.cache/saltmarcher/tests';mkdirSync(base,{recursive:true});const dir=mkdtempSync(base+'/pigment-stream-'),store=new CampaignStore(dir+'/world.sqlite'),campaign=store.create('Pigment'),token=store.activate(campaign.id).token;
 const insert=store.db.prepare('INSERT INTO atlas_landscape(rowid,campaign_id,id,revision,min_x,max_x,min_y,max_y,payload) VALUES(?,?,?,?,?,?,?,?,?)');
 store.db.transaction(()=>{for(let i=0;i<301;i++){const r=pigment(i,{version:i%3?2:1});if(kind==='cover'){delete r.paint;r.kind='vegetation';r.vegetation=vegetationSpec('deciduous',i);r.values={terrain:'forest'};}insert.run((9007199254740993n+BigInt(i)).toString(),campaign.id,r.id,1,-64,128,-64,128,JSON.stringify(r));}})();
 const db=new(require('better-sqlite3'))(store.filename,{readonly:true}),reader=new AtlasLandscapeReader(db),source=store.atlasRegionSource(token);reader.sync(source);
 t.after(()=>{db.close();store.close();rmSync(dir,{recursive:true,force:true});});
 // Enough missing orders cross a page boundary within the Infinity sentinel.
 const expected=db.prepare("SELECT id FROM temp.landscape_shape_bounds ORDER BY "+(kind==='color'?"CASE WHEN paint_version=1 THEN 0 ELSE 1 END,CASE WHEN paint_version=1 THEN resolution ELSE 0 END DESC,coalesce(paint_order,1e999),resolution DESC,source_row":"resolution DESC,coalesce(paint_order,0),source_row")).all().map(r=>r.id);
 db.exec('BEGIN');const iterator=reader.rows(source,{x:0,y:0,width:64,height:64},true,0,0,kind),first=iterator.next();db.exec('COMMIT');
 // Dropping the index of an active SELECT would fail with SQLITE_LOCKED.
 db.exec('DROP INDEX temp.landscape_'+kind+'_order');db.exec(kind==='color'?LANDSCAPE_COLOR_INDEX:LANDSCAPE_COVER_INDEX);
 assert.deepEqual([first.value.id,...Array.from(iterator,r=>r.id)],expected);assert.equal(new Set(expected).size,301);
});

test('interruptible pigment composition retains textured dabs, legacy paint, erase and cropped output',()=>{
 const records=[pigment(1,{tip:'textured'}),pigment(2,{fill:true}),pigment(3,{version:1,tip:'round'}),pigment(4,{operation:'erase',tip:'soft'})],box={x:0,y:0,width:64,height:64};
 // This oracle isolates pigment composition under its historical relief profile.
 const style=settingsRecord(0);style.terrainSettings.style={version:1,mode:'drawn',land:'#eee5cf',ink:'#685639',lightDegrees:315,strength:.65};
 const create=()=>{const image=new LandscapeRasterizer(box,128,128);image.paint(style);image.paint(heightRecord(0,0,2,new Float32Array(4096).fill(100)));return image;};
 const sync=create(),stepped=create();for(const r of records)sync.paintColor(r);
 let checkpoints=0;function* checkpoint(){checkpoints++;yield;}
 for(const r of records){const steps=stepped.paintColorSteps(r,checkpoint);while(!steps.next().done){}}
 assert(checkpoints>100,'pigment work is divided into row and pixel batches');assert.deepEqual(stepped.finish(),sync.finish());
 // Pixel oracle captured from the pre-change rasterizer at 9842ac876.
 assert.equal(createHash('sha256').update(stepped.finish()).digest('hex'),'09d93c296c946bacc3f58a98af609607822900e899c1caa28dbd0bfb9659be89');
});
