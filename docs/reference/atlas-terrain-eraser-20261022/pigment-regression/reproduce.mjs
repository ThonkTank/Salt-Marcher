// Run from the repository root; writes the three comparisons into .build.
import {build} from 'esbuild';import{readFileSync,writeFileSync}from'node:fs';import{createRequire}from'node:module';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';
const require=createRequire(process.cwd()+'/package.json'),{PNG}=require('pngjs'),results={};
const polygon=[{outer:[{x:-64,y:-64},{x:128,y:-64},{x:128,y:128},{x:-64,y:128}],holes:[]}];
const pigment=(i,extra={})=>({id:'paint'+i,revision:1,kind:'patch',name:'',width:0,resolution:2**(i%4),order:i%2?i*13%19:undefined,points:[{x:0,y:0},{x:40,y:20}],polygons:polygon,values:{},paint:{version:2,operation:'paint',target:'ground',color:i%2?'#967755':'#778866',opacity:.3,flow:.7,tip:'soft',radius:30,seed:i,...extra}});
const records=[pigment(1,{tip:'textured'}),pigment(2,{fill:true}),pigment(3,{version:1,tip:'round'}),pigment(4,{operation:'erase',tip:'soft'})];
const images=[];
for(const [name,revision]of[['baseline','02673afb2'],['candidate','72727d54'],['fixed',null]]){
 const source=revision?execFileSync('git',['show',revision+':src/app/landscape-brush.ts'],{encoding:'utf8'}):readFileSync('src/app/landscape-brush.ts','utf8');
 await build({stdin:{resolveDir:process.cwd(),contents:"export {LandscapeRasterizer} from './src/app/landscape-raster';export {heightRecord} from './src/app/terrain-height';"},outfile:'.build/pigment-'+name+'.cjs',bundle:true,platform:'node',format:'cjs',plugins:[{name:'brush-version',setup(b){b.onLoad({filter:/landscape-brush\.ts$/},()=>({contents:source,loader:'ts',resolveDir:process.cwd()+'/src/app'}));}}]});
 const {LandscapeRasterizer,heightRecord}=require(process.cwd()+'/.build/pigment-'+name+'.cjs'),r=new LandscapeRasterizer({x:0,y:0,width:64,height:64},128,128);r.paint(heightRecord(0,0,2,new Float32Array(4096).fill(100)));for(const record of records)r.paintColor(record);
 const pixels=r.finish(),png=new PNG({width:128,height:128});png.data=Buffer.from(pixels);writeFileSync('.build/pigment-'+name+'.png',PNG.sync.write(png));images.push(pixels);results[name]={sha256:createHash('sha256').update(pixels).digest('hex')};
}
for(const [i,name]of[[1,'candidate'],[2,'fixed']]){let count=0,max=0;for(let p=0;p<images[0].length;p+=4){let delta=0;for(let c=0;c<4;c++)delta=Math.max(delta,Math.abs(images[0][p+c]-images[i][p+c]));if(delta)count++;max=Math.max(max,delta);}Object.assign(results[name],{changedPixels:count,maxChannelDifference:max});}
writeFileSync('.build/pigment-comparison.json',JSON.stringify(results,null,2));console.log(results);
