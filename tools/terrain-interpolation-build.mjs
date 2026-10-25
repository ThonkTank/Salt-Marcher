// Historical bilinear kernels and the rejected naive cubic experiment.
// Production cubic needs no plugin; old comparisons remain pinned and reproducible.
import {execFileSync} from 'node:child_process';
export const INTERPOLATION_BASELINE='ba32afaed086977fdb8ba8db7dd491b3b4e12679';
export const LATTICE_BASELINE='06e8dd03f85567ac8dead4c5c147b99d5737337f';
export function interpolationStreamPlugin(mode='monotone'){return {name:'monotone-stream-experiment',setup(build){
 build.onLoad({filter:/(terrain-field-stream|terrain-height-lattice)\.ts$/},async({path})=>{
  if(mode==='lattice'){
   if(!path.endsWith('terrain-height-lattice.ts'))return;
   return {contents:execFileSync('git',['show',LATTICE_BASELINE+':src/app/atlas/terrain-height-lattice.ts'],{encoding:'utf8'}),loader:'ts'};
  }
  if(!path.endsWith('terrain-field-stream.ts'))return;
  let source=execFileSync('git',['show',INTERPOLATION_BASELINE+':src/app/atlas/terrain-field-stream.ts'],{encoding:'utf8'});
  if(mode==='baseline')return {contents:source,loader:'ts'};
  const replace=(from,to)=>{if(source.split(from).length!==2)throw Error('Interpolation experiment no longer matches '+from);source=source.replace(from,to);};
  source="import {reconstruct} from '../../tools/terrain-interpolation-probe.mjs';\n"+source;
  replace('new Float32Array(n*8),mask=new Uint8Array(n)','new Float32Array(n*32).fill(NaN),mask=new Uint8Array(n)');
  const start=source.indexOf('        let weight=0,total=0,delta=0;'),end=source.indexOf('\n      }\n      used=0;',start);
  if(start<0||end<start)throw Error('Interpolation flush not found');
  source=source.slice(0,start)+`        if(mask[i]!&1)ground[i]=reconstruct(nodes,fx,fy,ground[i]!,undefined,i*32);
        if(mask[i]!&2)additions[i]=additions[i]!+reconstruct(nodes,fx,fy,0,undefined,i*32+16);
        mask[i]=0;`+source.slice(end);
  replace('      used=0;','      used=0;nodes.fill(NaN);');
  replace("    for(const r of records('height',query)){", "    const addresses=new Set<string>();\n    for(const r of records('height',query)){");
  replace('      const data=decodeHeights(t),tx=t.x/pixel,ty=t.y/pixel;', "      const address=t.version+':'+t.pixel+':'+t.x+':'+t.y;if(addresses.has(address))throw Error('Doppelte Höhenkachel.');addresses.add(address);\n      const data=decodeHeights(t),tx=t.x/pixel,ty=t.y/pixel;");
  replace('each({x:t.x-pixel,y:t.y-pixel,width:65*pixel,height:65*pixel}', 'each({x:t.x-2*pixel,y:t.y-2*pixel,width:67*pixel,height:67*pixel}');
  replace('for(let oy=0;oy<2;oy++)for(let ox=0;ox<2;ox++){','for(let oy=0;oy<4;oy++)for(let ox=0;ox<4;ox++){');
  replace('const col=gx+ox-tx,row=gy+oy-ty;','const col=gx+ox-1-tx,row=gy+oy-1-ty;');
  replace("const corner=oy*2+ox+(t.version===2?4:0),bit=1<<corner;if(mask[i]!&bit)throw Error('Doppelte Höhenkachel.');", 'const corner=oy*4+ox+(t.version===2?16:0),bit=t.version===2?2:1;');
  replace('nodes[i*8+corner]=v','nodes[i*32+corner]=v');
  return {contents:source,loader:'ts'};
 });
}};}
