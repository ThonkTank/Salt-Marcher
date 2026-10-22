import {constants} from 'node:fs';
import {build} from 'esbuild';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
const label=process.argv[2];if(!/^[a-z-]+$/.test(label??''))throw Error('Pass a unique before/after label');
await copyFile('.build/desktop/ui/renderer.js',`.build/brush-renderer-${label}.js`,constants.COPYFILE_EXCL);
await build({stdin:{resolveDir:process.cwd(),loader:'ts',contents:`
 import './src/app/renderer';
 import {LandscapeWorkbench} from './src/app/atlas-landscape-ui';
 import {TerrainSpatialView} from './src/app/terrain-spatial-view';
 import {TerrainBrushDraft} from './src/app/terrain-brush-draft';
 import {TerrainDraftMaterial} from './src/app/terrain-draft-material';
 const w=window as any;w.__brushPhases=[];w.__brushFrame=null;w.__brushStack=[];
 const raf=window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame=callback=>raf(time=>{const old=w.__brushFrame;w.__brushFrame=time;try{callback(time);}finally{w.__brushFrame=old;}});
 function wrap(owner:any,name:string,label:string){const fn=owner.prototype[name];if(!fn)throw Error('Missing phase '+label);owner.prototype[name]=function(...args:any[]){
  const start=performance.now(),frame=w.__brushFrame,parent=w.__brushStack.join('/');w.__brushStack.push(label);
  try{return fn.apply(this,args);}finally{w.__brushStack.pop();if(w.__brushPhases.length<20000)w.__brushPhases.push({name:label,parent,frame,start,duration:performance.now()-start});}
 };}
 for(const name of ['startLive','sampleLive','sampleHeight','tickLive'])wrap(LandscapeWorkbench,name,'Landscape.'+name);
 for(const name of ['previewHeight','render'])wrap(TerrainSpatialView,name,'View.'+name);
 wrap(TerrainBrushDraft,'update','Draft.update');wrap(TerrainDraftMaterial,'update','Material.update');
`},outfile:'.build/desktop/ui/renderer.js',bundle:true,platform:'browser',format:'iife',plugins:[{name:'lazy-generator-settings',setup(b){b.onResolve({filter:/^\.\/preset-settings-ui$/},()=>({path:'./preset-settings.js',external:true}));}}]});
let script=await readFile('tools/test-desktop-world-navigation.mjs','utf8');
script=script.replace(/^(import .*from )'\.\//gm,"$1'../tools/");
script=script.replace('window.__worldReset=now=>{','window.__worldReset=now=>{window.__brushPhases=[];window.__brushDraws=[];');
script=script.replace('window.__worldDraws.push(performance.now());','window.__worldDraws.push(performance.now());(window.__brushDraws??=[]).push({time:performance.now(),frame:window.__brushFrame,parent:window.__brushStack.join(\'/\')});');
script=script.replace('const data=await page.evaluate(()=>({frames:','const data=await page.evaluate(()=>({brushPhases:window.__brushPhases,brushDraws:window.__brushDraws,frames:');
await writeFile('.build/world-brush-phases.mjs',script);
