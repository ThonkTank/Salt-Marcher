import type {LandscapeBox} from './atlas-landscape';
import type {TerrainView} from './terrain-spatial-model';
import type {TerrainLattice} from './terrain-field-stream';

interface Band {start:number;cells:number;origin:number;step:number}
export interface TerrainRouteLayout {x:TerrainAxis;y:TerrainAxis}
export interface TerrainAxis {values:Float64Array;bands:Band[];minimumStep:number}
const layouts=new WeakMap<TerrainView,ReturnType<typeof layout>>();
/** Wider context uses a few uniform bands with increasing spacing. This
 * preserves bounded stream lattices and avoids one huge cell beside the centre. */
function marginBands(origin:number,size:number,cells:number,start:number,nearStep:number,reverse:boolean):Band[]{
  if(size<=nearStep*cells*2||cells<4)return[{start,cells,origin,step:size/cells}];
  const count=Math.min(4,Math.ceil(Math.log2(size/(nearStep*cells)))+1),counts=Array.from({length:count},(_,i)=>Math.floor(cells/count)+(i<cells%count?1:0));
  let lo=1,hi=Math.max(2,(size/(nearStep*Math.min(...counts)))**(1/(count-1)));
  for(let n=0;n<40;n++){const ratio=(lo+hi)/2,total=counts.reduce((sum,c,i)=>sum+c*nearStep*ratio**i,0);if(total<size)lo=ratio;else hi=ratio;}
  const ratio=(lo+hi)/2,weights=counts.map((c,i)=>c*ratio**i),sum=weights.reduce((a,b)=>a+b,0),bands:Band[]=[];
  for(let j=0;j<count;j++){
    const i=reverse?count-1-j:j,c=counts[i]!,width=size*weights[i]!/sum;
    bands.push({start,cells:c,origin,step:width/c});start+=c;origin+=width;
  }
  return bands;
}
function axis(origin:number,size:number,count:number,focus?:{origin:number;size:number}):TerrainAxis{
  const margin=Math.max(1,Math.floor((count-1)/8)),inner=count-1-2*margin;
  const bands:Band[]=focus?[
    ...marginBands(origin,focus.origin-origin,margin,0,focus.size/inner*2,true),
    {start:margin,cells:inner,origin:focus.origin,step:focus.size/inner},
    ...marginBands(focus.origin+focus.size,origin+size-focus.origin-focus.size,margin,margin+inner,focus.size/inner*2,false),
  ]:[{start:0,cells:count-1,origin,step:size/(count-1)}];
  const values=new Float64Array(count);
  for(const b of bands)for(let i=0;i<=b.cells;i++)values[b.start+i]=b.origin+i*b.step;
  return {values,bands,minimumStep:Math.min(...bands.map(b=>b.step))};
}
function layout(v:TerrainView){
  const b=v.box,f=v.refinement,x=axis(b.x,b.width,v.columns,f&&{origin:f.x,size:f.width}),y=axis(b.y,b.height,v.rows,f&&{origin:f.y,size:f.height});
  const blocks:{x:number;y:number;lattice:TerrainLattice}[]=[];
  for(const row of y.bands)for(const column of x.bands)blocks.push({x:column.start,y:row.start,lattice:{x:column.origin,y:row.origin,dx:column.step,dy:row.step,columns:column.cells+1,rows:row.cells+1}});
  return {x,y,blocks,minimumStep:Math.min(x.minimumStep,y.minimumStep)};
}
/** One continuous rectangular mesh: fine centre and coarse margins share edge
 * vertices. The same layout owns sampling, rendering and canonical visibility. */
export function terrainGridLayout(v:TerrainView){let found=layouts.get(v);if(!found){found=layout(v);layouts.set(v,found);}return found;}
export function terrainGridCoordinate(axis:TerrainAxis,value:number){
  let band=axis.bands.at(-1)!;
  for(const candidate of axis.bands)if(value<candidate.origin+candidate.step*candidate.cells){band=candidate;break;}
  return Math.max(0,Math.min(axis.values.length-1,band.start+(value-band.origin)/band.step));
}
export function terrainGridRect(v:TerrainView,r:{x:number;y:number;width:number;height:number},pad=0):LandscapeBox{
  const {x,y}=terrainGridLayout(v),left=x.values[Math.max(0,r.x-pad)]!,top=y.values[Math.max(0,r.y-pad)]!,right=x.values[Math.min(v.columns-1,r.x+r.width-1+pad)]!,bottom=y.values[Math.min(v.rows-1,r.y+r.height-1+pad)]!;
  return {x:left,y:top,width:right-left,height:bottom-top};
}
