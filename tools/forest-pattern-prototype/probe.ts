import {TerrainSpatialView} from '../../src/app/terrain-spatial-view';
import {LandscapeRasterizer} from '../../src/app/landscape-raster';
import {vegetationSpec} from '../../src/app/vegetation';

export async function run(){
  const width=960,height=640,edge=512,span=8e6;
  const canvas=document.createElement('canvas');canvas.style.cssText=`position:fixed;left:-10000px;width:${width}px;height:${height}px`;document.body.append(canvas);
  const view=new TerrainSpatialView(canvas,1);
  const box={x:-span/2,y:-span/2,width:span,height:span},frame={x:-span/2,y:-span/3,width:span,height:span*2/3};
  const raster=new LandscapeRasterizer(box,edge,edge,0,span/width,true),lattice=raster.sampleLattice();
  const water=Uint8Array.from({length:lattice.columns*lattice.rows},(_,i)=>{
    const x=(lattice.x+i%lattice.columns*lattice.dx)/span,y=(lattice.y+Math.floor(i/lattice.columns)*lattice.dy)/span;
    return x<-.4+.03*Math.sin(y*25)?1:0;
  });
  raster.setTerrainField({heights:new Float32Array(water.length).fill(100),water});
  const ellipse=(x:number,y:number,rx:number,ry:number)=>Array.from({length:96},(_,i)=>{const a=i/96*Math.PI*2;return {x:(x+Math.cos(a)*rx)*span,y:(y+Math.sin(a)*ry)*span};});
  const vegetation=vegetationSpec();vegetation.preset.edge=10000;
  vegetation.edits=[{mode:'clear',polygons:[{outer:ellipse(-.29,-.1,.035,.07),holes:[]}]},
    {mode:'thin',polygons:[{outer:ellipse(.23,.11,.06,.09),holes:[]}]}];
  raster.paint({id:'forest',kind:'vegetation',points:[],polygons:[{outer:ellipse(-.15,-.02,.27,.29),holes:[ellipse(-.04,.05,.13,.16)]},{outer:ellipse(.24,.14,.16,.23),holes:[]}],vegetation,values:{terrain:'forest'},resolution:1});
  const pixels=raster.finish(),mask=raster.forest!;
  const data={generation:1,source:'forest-pattern-experiment',draft:false,width:edge,height:edge,pixels,forest:mask,
    grid:{view:{projection:'perspective' as const,box,frame,columns:3,rows:3,focusM:0,tilt:0,rotation:0,exaggeration:1},heights:new Float32Array(9),seaLevelM:-100}};
  const empty=new Uint8Array(mask.length);
  const images:{name:string;image:string}[]=[];
  try{
    view.setData(data);
    const draw=(name:string,scale:number,enabled:boolean,tilt=0,rotation=0,dpr=1,cx=0,cy=0)=>{
      view.renderer.setPixelRatio(dpr);const b={x:cx-span*scale/2,y:cy-span*scale/3,width:span*scale,height:span*scale*2/3};
      const texture=(view as any).detail.forestTextures.get('base');texture.image.data=enabled?mask:empty;texture.needsUpdate=true;view.reframe(b,tilt,rotation);view.renderTile(width,height,0,0,width,height);
      images.push({name,image:canvas.toDataURL()});
    };
    const readPixels=()=>{const gl=view.renderer.getContext(),out=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,out);return out;};
    const difference=(a:Uint8Array,b:Uint8Array)=>{let sum=0,max=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]!-b[i]!);sum+=d;max=Math.max(max,d);}return {mean:sum/a.length,max};};
    const require=(ok:boolean,message:string)=>{if(!ok)throw Error(message);};
    draw('before-world',1,false);draw('after-world',1,true);draw('after-continent',.5,true);draw('after-tilted',1,true,45,18);draw('after-dpr2',1,true,0,0,2);
    draw('reference',1,true);const reference=readPixels();
    view.setData({...data,grid:{...data.grid,view:{...data.grid.view,frame:{...frame,x:frame.x+span/3}}}});
    draw('rebased',1,true);const rebased=difference(reference,readPixels());
    require(rebased.mean<.03,'Pattern moved when the terrain origin changed.');
    // Adjacent export tiles use the full output scale and the same world phase.
    const combined=new Uint8Array(reference.length),half=width/2,gl=view.renderer.getContext();
    for(let x=0;x<width;x+=half){
      view.renderTile(width,height,x,0,half,height);const part=new Uint8Array(half*height*4);gl.readPixels(0,0,half,height,gl.RGBA,gl.UNSIGNED_BYTE,part);
      for(let y=0;y<height;y++)combined.set(part.subarray(y*half*4,(y+1)*half*4),(y*width+x)*4);
    }
    const tiled=difference(reference,combined);require(tiled.mean<.03,'Pattern shifted across export tiles.');
    const boundary=65536/8/(span/width);
    draw('lod-below',boundary*(1-1e-7),true);const below=readPixels();
    draw('lod-above',boundary*(1+1e-7),true);const lod=difference(below,readPixels());
    require(lod.mean<.03,'Forest level transition is discontinuous.');
    const near=1/(span/width);draw('near-disabled',near,false,0,0,1,-span*.15,-span*.25);const nearBefore=readPixels();draw('near-enabled',near,true,0,0,1,-span*.15,-span*.25);
    require(mask[Math.floor(edge*.25)*edge+Math.floor(edge*.35)]!>200,'Near-view fade fixture must contain forest.');
    const hidden=difference(nearBefore,readPixels());require(hidden.max===0,'Overview forest must disappear at village scale.');
    view.setData(data);draw('detail-flat-reference',.5,false);const flat=readPixels();
    const detail={box,width:edge,height:edge,pixels,forest:new Uint8Array(mask.length)};
    view.setDetail(detail);draw('detail-cleared',.5,true);const detailClear=difference(flat,readPixels());
    require(detailClear.mean<.03,'Fine forest clearing did not replace the base pattern.');
    detail.forest=mask.slice();view.setDetail(detail);draw('detail-filled',1,true);const filled=readPixels();
    const rect={x:70,y:180,width:100,height:120};let affected=0;
    for(let y=rect.y;y<rect.y+rect.height;y++)for(let x=rect.x;x<rect.x+rect.width;x++){affected+=detail.forest[y*edge+x]!>0?1:0;detail.forest[y*edge+x]=0;}
    require(affected>500,'Partial update fixture must contain forest.');
    view.setDetail(detail,[rect]);draw('detail-partial',1,true);const partialPixels=readPixels(),partialChange=difference(filled,partialPixels);
    require(partialChange.mean>.01,'Partial forest upload did not change the rendered forest.');
    view.setDetail({...detail,forest:detail.forest.slice()});draw('detail-full-oracle',1,true);const partial=difference(partialPixels,readPixels());
    require(partial.max===0,'Single-channel GPU patch differs from a full mask upload.');
    // Exercise the same provisional-water material used by the live sculpt view.
    const landGrid={...data.grid,seaLevelM:0,heights:new Float32Array(9).fill(100),editing:{ground:new Float32Array(9).fill(100),water:new Float32Array(9)}};
    view.setData({...data,grid:landGrid});const wet={...landGrid,heights:new Float32Array(9),editing:{ground:new Float32Array(9).fill(-100),water:new Float32Array(9)}};
    (view as any).draftMaterial.update((view as any).mesh,wet,wet.editing.ground,{x:0,y:0,width:3,height:3});(view as any).grid=wet;
    draw('draft-water-pattern',1,true);const waterPattern=readPixels();draw('draft-water-flat',1,false);const draftWater=difference(waterPattern,readPixels());
    require(draftWater.max===0,'Forest pattern leaked onto provisional sculpt water.');
    view.setData(data);
    const intervals:number[]=[],costs:number[]=[];let previous=performance.now();
    view.renderer.setPixelRatio(1);
    for(let i=0;i<90;i++){
      await new Promise<void>(r=>requestAnimationFrame(()=>r()));const now=performance.now();if(i>10)intervals.push(now-previous);previous=now;
      const scale=1-.4*i/90,b={x:-span*scale/2,y:-span*scale/3,width:span*scale,height:span*scale*2/3};
      const start=performance.now();view.reframe(b,0,0);costs.push(performance.now()-start);
    }
    intervals.sort((a,b)=>a-b);costs.sort((a,b)=>a-b);
    return {images,checks:{rebased,tiled,lod,hidden,detailClear,partial,partialChange,draftWater},frames:intervals.length,frameP95Ms:intervals[Math.floor(intervals.length*.95)],renderP95Ms:costs[Math.floor(costs.length*.95)],calls:view.renderer.info.render.calls,textures:view.renderer.info.memory.textures,geometry:view.renderer.info.memory.geometries};
  }finally{view.dispose();canvas.remove();}
}
