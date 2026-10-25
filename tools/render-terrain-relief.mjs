import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {sculptRelief,RELIEF_VIEWS} from './terrain-relief-scene.mjs';
const require=createRequire(import.meta.url);
require('esbuild').buildSync({stdin:{contents:"export * from './src/app/atlas/terrain-brush';export * from './src/app/atlas/terrain-height';export * from './src/app/atlas/landscape-raster';export * from './src/app/atlas/terrain-relief';",resolveDir:process.cwd()},outfile:'.build/r4-render.cjs',bundle:true,platform:'node',format:'cjs'});
const {applyTerrainBrush,settingsRecord,DEFAULT_TERRAIN_STYLE,LandscapeRasterizer}=require('../.build/r4-render.cjs'),{PNG}=require('pngjs');
const records=sculptRelief(applyTerrainBrush),out=process.env.QA_EVIDENCE_DIR??'.build/r4-visual';mkdirSync(out,{recursive:true});
const timings=[];
for(const [name,box]of Object.entries(RELIEF_VIEWS))for(const mode of ['shaded','drawn','height']){
 const start=performance.now(),width=960,height=Math.round(width*box.height/box.width),image=new LandscapeRasterizer(box,width,height),settings=settingsRecord(0);settings.terrainSettings.style={...DEFAULT_TERRAIN_STYLE,mode};
 for(const r of [...records,settings])image.paint(r);
 image.paintLine([{x:-2600,y:1000},{x:-1000,y:1400},{x:500,y:700},{x:2300,y:400}],38,'#629ebc');
 image.paintLine([{x:-800,y:-1500},{x:-700,y:-700},{x:-500,y:100},{x:-100,y:900}],24,'#a37e51');
 writeFileSync(out+'/'+name+'-'+mode+'.png',PNG.sync.write({width,height,data:Buffer.from(image.finish())}));timings.push({name,mode,milliseconds:performance.now()-start});
}
writeFileSync(out+'/renders.json',JSON.stringify({records:records.length,timings},null,2));
writeFileSync(out+'/comparison.html','<!doctype html><meta charset="utf-8"><title>Relief R4</title><style>body{background:#e5e0d4;color:#283535;font:16px system-ui;margin:24px}section{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}img{width:100%}h1,h2{font-weight:500}figure{margin:0}figcaption{padding:8px}</style><h1>Relief aus denselben Landpinselzügen</h1>'+Object.keys(RELIEF_VIEWS).map(name=>'<h2>'+name+'</h2><section>'+['shaded','drawn','height'].map(mode=>'<figure><img src="'+name+'-'+mode+'.png"><figcaption>'+mode+'</figcaption></figure>').join('')+'</section>').join(''));
console.log(JSON.stringify({out,records:records.length,timings},null,2));
