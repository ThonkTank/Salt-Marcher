import {heightBrushDabs,heightBrushAmount,type HeightStroke} from './terrain-brush';
import {gridHeight,terrainVisibility,type TerrainGrid} from './terrain-spatial-model';
import {terrainGridLayout,terrainGridCoordinate} from './terrain-grid-layout';

/** Bounded display approximation, anchored to the gesture's loaded ground.
 * Consumes each input segment once. No author records, storage or source mutation.
 * Main still owns precise sampling, protected routes and the committed result. */
export class TerrainBrushDraft {
  readonly grid:TerrainGrid;
  readonly ground:Float32Array;
  private dose:Float64Array;
  private visible:Uint8Array;
  private consumed=1;
  changedRect={x:0,y:0,width:0,height:0};
  maximumHeight=0;
  private source:(p:{x:number;y:number})=>number;
  private visibility:(p:{x:number;y:number})=>boolean;
  constructor(readonly base:TerrainGrid){
    if(!base.editing)throw Error('Bearbeitbares Höhenraster fehlt.');
    this.ground=base.editing.ground.slice();
    this.grid={...base,heights:base.heights.slice()};
    this.dose=new Float64Array(this.ground.length);this.visible=new Uint8Array(this.ground.length);
    const raw={...base,heights:base.editing.ground};this.source=p=>gridHeight(raw,p);
    this.visibility=terrainVisibility(base);
  }
  update(stroke:HeightStroke){
    if(stroke.samples.length<=this.consumed)return false;
    const samples=stroke.samples.slice(this.consumed-1);this.consumed=stroke.samples.length;
    const layout=terrainGridLayout(this.base.view),v=this.base.view,water=this.base.editing!.water;
    let changed=false,minX=v.columns,minY=v.rows,maxX=-1,maxY=-1;
    for(const dab of heightBrushDabs({...stroke,samples})){
      if(dab.seconds<=0)continue;
      const left=Math.ceil(terrainGridCoordinate(layout.x,dab.x-stroke.radius)),right=Math.floor(terrainGridCoordinate(layout.x,dab.x+stroke.radius));
      const top=Math.ceil(terrainGridCoordinate(layout.y,dab.y-stroke.radius)),bottom=Math.floor(terrainGridCoordinate(layout.y,dab.y+stroke.radius));
      for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
        const p={x:layout.x.values[x]!,y:layout.y.values[y]!},r=Math.hypot(p.x-dab.x,p.y-dab.y)/stroke.radius;
        if(r>=1)continue;
        const i=y*v.columns+x;
        if(!this.visible[i])this.visible[i]=this.visibility(p)?1:2;
        if(this.visible[i]===2)continue;
        const t=stroke.feather===0?1:Math.min(1,(1-r)/stroke.feather);
        this.dose[i]=this.dose[i]!+dab.seconds*t*t*(3-2*t);
        this.ground[i]=this.base.editing!.ground[i]!+heightBrushAmount(stroke,p,this.dose[i]!,stroke.mode==='smooth'||stroke.targetM!==undefined?this.source:undefined);
        this.grid.heights[i]=Math.max(this.ground[i]!,water[i]!);changed=true;
        minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
        this.maximumHeight=Math.max(this.maximumHeight,Math.abs(this.grid.heights[i]!-v.focusM));
      }
    }
    this.changedRect={x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1};return changed;
  }
}
