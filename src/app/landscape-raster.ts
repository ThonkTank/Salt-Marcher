import {mapRecordVisible,mapLineWidth} from './atlas-scale-policy';
import {paintTerrainCoast} from './terrain-coast';
import {terrainContourInk} from './terrain-contour-style';
import type {TerrainField,TerrainLattice} from './terrain-field-stream';
import {DEFAULT_TERRAIN_STYLE,reliefRgb,reliefLighting,reliefMarks,elevationColor,type TerrainStyle} from './terrain-relief';
import {TerrainSampler,DEFAULT_HEIGHT_M} from './terrain-height';
import {maskAt,MASK_SEA_LEVEL} from './land-mask';
import {lineParts} from "./landscape-line";
import {colorParts} from "./landscape-brush";
import {bounds,type LandscapeBox,type LandscapeRecord} from './atlas-landscape';
import type { Polygon } from './contracts';
import { terrainColors } from './world-model';

export const UNPAINTED_LAND = [238, 229, 207] as const;
// Read a halo as well as the visible tile: a tile edge is never a coastline.
export const LANDSCAPE_RASTER_PAD = 16;
export function landscapeRasterBounds(box:LandscapeBox,width:number,height:number):LandscapeBox {
  const dx=box.width/width*LANDSCAPE_RASTER_PAD,dy=box.height/height*LANDSCAPE_RASTER_PAD;
  return {x:box.x-dx,y:box.y-dy,width:box.width+2*dx,height:box.height+2*dy};
}

/** Keep the source pixel lattice, but omit unseen parts of a large world tile.
 * Block-aligned edges retain reuse for small pans and the raster's own halo
 * supplies shading/coast neighbours. This changes coverage, never resolution. */
export function landscapeRasterSlice(tile:LandscapeBox,pixels:number,view:LandscapeBox){
  const block=Math.min(128,pixels),dx=tile.width/pixels,dy=tile.height/pixels;
  const left=Math.max(0,Math.floor((view.x-tile.x)/dx/block)*block),top=Math.max(0,Math.floor((view.y-tile.y)/dy/block)*block);
  const right=Math.min(pixels,Math.ceil((view.x+view.width-tile.x)/dx/block)*block),bottom=Math.min(pixels,Math.ceil((view.y+view.height-tile.y)/dy/block)*block);
  if(right<=left||bottom<=top)throw Error('Landschaftsausschnitt ohne Rasterüberdeckung.');
  return {box:{x:tile.x+left*dx,y:tile.y+top*dy,width:(right-left)*dx,height:(bottom-top)*dy},width:right-left,height:bottom-top};
}

/** Display-only supersampled raster. Exact queries always use author geometry. */
export class LandscapeRasterizer {
  readonly pixels: Uint8Array;
  private readonly samples: Uint8Array;
  private readonly water: Uint8Array;
  private readonly w: number;
  private readonly h: number;
  private colorBase:Uint8Array|null=null;
  private colorLayer:Uint8Array|null=null;
  private covers:LandscapeRecord[]=[];
  private coverPending=false;
  private masks:LandscapeRecord[]=[];
  private heights:LandscapeRecord[]=[];
  private fresh:LandscapeRecord[]=[];
  private maskPending=false;
  private coastPending=false;
  private elevations:Float32Array|null=null;
  private field:Pick<TerrainField,'heights'|'water'>|null=null;
  private terrainStyle:Readonly<TerrainStyle>=DEFAULT_TERRAIN_STYLE;
  private seaLevelM=0;
  readonly sampleBox:LandscapeBox;
  constructor(readonly box: LandscapeBox, readonly width: number, readonly height: number,readonly contours=0,readonly displayMpp=box.width/width) {
    if(!box||![box.x,box.y,box.width,box.height].every(Number.isFinite)||box.width<=0||box.height<=0||
       !Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>1024||height>1024)
      throw new Error('Landschaftsübersicht prüfen.');
    this.sampleBox=landscapeRasterBounds(box,width,height);
    this.w=(width+2*LANDSCAPE_RASTER_PAD)*2;this.h=(height+2*LANDSCAPE_RASTER_PAD)*2;
    this.samples=new Uint8Array(this.w*this.h*4);
    this.water=new Uint8Array(this.w*this.h).fill(1);
    this.pixels=new Uint8Array(width*height*4);
  }
  sampleLattice():TerrainLattice {
    const dx=this.sampleBox.width/this.w,dy=this.sampleBox.height/this.h;
    return {x:this.sampleBox.x+dx/2,y:this.sampleBox.y+dy/2,dx,dy,columns:this.w,rows:this.h};
  }
  setTerrainField(field:TerrainField){
    if(field.heights.length!==this.w*this.h||field.water.length!==this.w*this.h)throw Error('Geländerastergröße prüfen.');
    this.field={heights:field.heights,water:field.water};this.maskPending=true;this.coastPending=true;
  }
  /** Reader supplies covers in display order after all base polygons, without retaining them. */
  paintCover(record:LandscapeRecord){
    this.applyMasks();if(!record.vegetation)return;
    const rgb=[1,3,5].map(i=>parseInt(record.vegetation!.preset.ground.slice(i,i+2),16));
    for(const polygon of record.polygons)this.polygon(polygon,rgb,.78,'ground');
  }
  paint(record: LandscapeRecord) {
    if(record.terrainSettings){this.terrainStyle=record.terrainSettings.style??DEFAULT_TERRAIN_STYLE;this.seaLevelM=record.terrainSettings.seaLevelM;}
    if(record.vegetation){this.covers.push(record);this.coverPending=true;return;}
    if(record.height||record.terrainSettings||record.route){this.heights.push(record);this.maskPending=true;this.coastPending=true;return;}
    if(record.propertyOnly)return;
    if(record.mask){this.masks.push(record);this.maskPending=true;this.coastPending=true;return;}
    if(record.surface==='freshwater'){this.fresh.push(record);this.maskPending=true;this.coastPending=true;return;}
    if(record.kind!=='patch'||!record.values.terrain)return;
    this.coastPending=true;
    if(record.maskManaged)this.maskPending=true;
    const color=terrainColors[record.values.terrain];if(!color)throw new Error('Geländefarbe fehlt.');
    const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
    for(const polygon of record.polygons)this.polygon(polygon,rgb,1,undefined,record.maskManaged?undefined:record.values.terrain==='water');
  }
  private applyVegetation(){
    this.applyMasks();if(!this.coverPending)return;this.coverPending=false;
    for(const r of this.covers.sort((a,b)=>b.resolution-a.resolution||(a.order??0)-(b.order??0))){
      const rgb=[1,3,5].map(i=>parseInt(r.vegetation!.preset.ground.slice(i,i+2),16));
      for(const polygon of r.polygons)this.polygon(polygon,rgb,.78,'ground');
    }
  }
  private applyMasks(){
    if(!this.maskPending)return;this.maskPending=false;
    const land=reliefRgb(this.terrainStyle.land),sea=[127,168,189];
    for(const r of this.masks.sort((a,b)=>b.resolution-a.resolution)){
      const m=r.mask!,size=256*m.pixel,x0=Math.max(0,Math.floor((m.x-this.sampleBox.x)/this.sampleBox.width*this.w)),x1=Math.min(this.w,Math.ceil((m.x+size-this.sampleBox.x)/this.sampleBox.width*this.w)),y0=Math.max(0,Math.floor((m.y-this.sampleBox.y)/this.sampleBox.height*this.h)),y1=Math.min(this.h,Math.ceil((m.y+size-this.sampleBox.y)/this.sampleBox.height*this.h));
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const v=maskAt(m,{x:this.sampleBox.x+(x+.5)/this.w*this.sampleBox.width,y:this.sampleBox.y+(y+.5)/this.h*this.sampleBox.height});if(v!==undefined)this.water[y*this.w+x]=v<MASK_SEA_LEVEL?1:0;}
    }
    if(this.field){this.water.set(this.field.water);this.elevations=this.field.heights;}
    else if(this.heights.length){const sampler=new TerrainSampler([...this.heights,...this.fresh]);
      this.water.fill(DEFAULT_HEIGHT_M<=sampler.seaLevelM?1:0);
      this.elevations=new Float32Array(this.w*this.h).fill(DEFAULT_HEIGHT_M);
      // Only the union of authored supports needs sampling. Distant ocean stays implicit.
      const spans=new Int32Array(this.h*2);for(let y=0;y<this.h;y++){spans[y*2]=this.w;spans[y*2+1]=0;}
      for(const r of [...this.heights.filter(r=>r.height||r.route),...this.fresh]){
        const b=bounds(r),left=b.x,top=b.y,right=b.x+b.width,bottom=b.y+b.height;
        const x0=Math.max(0,Math.floor((left-this.sampleBox.x)/this.sampleBox.width*this.w)),x1=Math.min(this.w,Math.ceil((right-this.sampleBox.x)/this.sampleBox.width*this.w)),y0=Math.max(0,Math.floor((top-this.sampleBox.y)/this.sampleBox.height*this.h)),y1=Math.min(this.h,Math.ceil((bottom-this.sampleBox.y)/this.sampleBox.height*this.h));
        for(let y=y0;y<y1;y++){spans[y*2]=Math.min(spans[y*2]!,x0);spans[y*2+1]=Math.max(spans[y*2+1]!,x1);}
      }
      for(let y=0;y<this.h;y++)for(let x=spans[y*2]!;x<spans[y*2+1]!;x++){
        const p={x:this.sampleBox.x+(x+.5)/this.w*this.sampleBox.width,y:this.sampleBox.y+(y+.5)/this.h*this.sampleBox.height},z=sampler.sample(p).heightM;
        this.elevations[y*this.w+x]=z;this.water[y*this.w+x]=sampler.water(p,z)?1:0;
      }
    }
    for(let i=0;i<this.water.length;i++){
      const at=i*4;if(this.water[i]||!this.samples[at+3]||(this.samples[at]===127&&this.samples[at+1]===168&&this.samples[at+2]===189)){const rgb=this.water[i]?sea:land;for(let c=0;c<3;c++)this.samples[at+c]=rgb[c]!;this.samples[at+3]=255;}
    }
    if(!this.field&&!this.heights.length)for(const r of this.fresh)for(const p of r.polygons)this.polygon(p,sea,1,undefined,true);
  }
  paintColor(record:LandscapeRecord){
    for(const _ of this.paintColorSteps(record,function*(){})){}
  }
  /** Same pigment composition for synchronous previews and interruptible tiles. */
  *paintColorSteps(record:LandscapeRecord,checkpoint:()=>Generator<void>):Generator<void>{
    this.applyVegetation();yield* checkpoint();
    const p=record.paint;if(!p)return;
    this.colorBase??=this.samples.slice();this.colorLayer??=new Uint8Array(this.samples.length);
    const pigment=new LandscapeRasterizer(this.box,this.width,this.height);
    let coverage:Float32Array|undefined,color:number[]|undefined;
    if(p.version===1){for(const part of colorParts(record))yield* pigment.paintPolygonsSteps(part.polygons,part.color,part.opacity,checkpoint);}
    else {
      // A bounded raster coverage mask avoids polygon clipping for every soft dab.
      yield* pigment.paintPolygonsSteps(record.polygons,'#ffffff',1,checkpoint);
      color=[1,3,5].map(i=>parseInt(p.color.slice(i,i+2),16));
      if(!p.fill){
        coverage=new Float32Array(this.water.length);
        const stamps:{x:number;y:number}[]=[];
        for(const stroke of p.strokes??[record.points]){
          if(!stroke.length)continue;stamps.push(stroke[0]!);
          for(let n=1;n<stroke.length;n++){
            const a=stroke[n-1]!,b=stroke[n]!,steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/(p.radius*.5)));
            for(let j=1;j<=steps;j++){stamps.push({x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps});if(j%1024===0)yield* checkpoint();}
          }
        }
        for(const c of stamps){
          const x0=Math.max(0,Math.floor((c.x-p.radius-this.sampleBox.x)/this.sampleBox.width*this.w)),x1=Math.min(this.w-1,Math.ceil((c.x+p.radius-this.sampleBox.x)/this.sampleBox.width*this.w));
          const y0=Math.max(0,Math.floor((c.y-p.radius-this.sampleBox.y)/this.sampleBox.height*this.h)),y1=Math.min(this.h-1,Math.ceil((c.y+p.radius-this.sampleBox.y)/this.sampleBox.height*this.h));
          for(let y=y0;y<=y1;y++){
          if((y-y0)%16===0)yield* checkpoint();
          for(let x=x0;x<=x1;x++){
            const i=y*this.w+x;if(!pigment.samples[i*4+3])continue;
            const px=this.sampleBox.x+(x+.5)/this.w*this.sampleBox.width,py=this.sampleBox.y+(y+.5)/this.h*this.sampleBox.height;
            const r2=((px-c.x)**2+(py-c.y)**2)/p.radius**2;if(r2>1)continue;
            let strength=p.tip==='round'?1:(1-r2)**2;
            if(p.tip==='textured'){
              const nx=Math.floor(px/p.radius*24),ny=Math.floor(py/p.radius*24);
              let n=Math.imul(nx,374761393)^Math.imul(ny,668265263)^p.seed;n=Math.imul(n^(n>>>13),1274126177);
              strength*=.15+.85*((n^(n>>>16))>>>0)/4294967295;
            }
            coverage[i]=1-(1-coverage[i]!)*(1-p.flow*strength);
          }}
        }
      }
      // Keep constant pigment RGB outside the mask. Filled areas need neither
      // dab coverage nor an extra full-pixel colour conversion pass.
    }
    const layer=this.colorLayer,base=this.colorBase;
    for(let i=0;i<this.water.length;i++){
      if(i%8192===0)yield* checkpoint();
      if((p.target==='water')!==!!this.water[i])continue;
      const at=i*4,mask=pigment.samples[at+3]!,alpha=(coverage?Math.round(mask*coverage[i]!):mask)/255*p.opacity;if(!alpha)continue;
      const old=layer[at+3]!/255;
      if(p.version===2&&p.operation==='erase')layer[at+3]=Math.round(old*(1-alpha)*255);
      else {
        const combined=alpha+old*(1-alpha);
        for(let c=0;c<3;c++)layer[at+c]=Math.round(((color?color[c]!:pigment.samples[at+c]!)*alpha+layer[at+c]!*old*(1-alpha))/(combined||1));
        layer[at+3]=Math.round(combined*255);
      }
      const paintAlpha=layer[at+3]!/255,baseAlpha=base[at+3]!/255,total=paintAlpha+baseAlpha*(1-paintAlpha);
      for(let c=0;c<3;c++)this.samples[at+c]=Math.round((layer[at+c]!*paintAlpha+base[at+c]!*baseAlpha*(1-paintAlpha))/(total||1));
      this.samples[at+3]=Math.round(total*255);
    }
  }
  private applyCoast(){
    for(const _ of this.prepareSurfaceSteps(function*(){})){}
  }
  /** Complete ground shading before lines; yield only with owned in-memory data. */
  *prepareSurfaceSteps(checkpoint:()=>Generator<void>):Generator<void>{
    this.applyVegetation();
    if(!this.coastPending)return;
    this.coastPending=false;
    yield* this.applyReliefSteps(checkpoint);
    yield* paintTerrainCoast(this.samples,this.water,this.w,this.h,LANDSCAPE_RASTER_PAD*2,checkpoint);
  }

  private *applyReliefSteps(checkpoint:()=>Generator<void>):Generator<void>{
    const z=this.elevations;if(!z)return;
    const dx=this.sampleBox.width/this.w,dy=this.sampleBox.height/this.h,style=this.terrainStyle,inkRgb=reliefRgb(style.ink),lighting=reliefLighting(style);
    // A small symmetric footprint limits high-frequency shading without changing heights or coasts.
    const step=4,stride=step*this.w;
    // The halo supplies height derivatives, shore distances and mark anchors;
    // its own shaded colours are never read by a neighbouring output pixel.
    const pad=LANDSCAPE_RASTER_PAD*2;
    for(let y=pad;y<this.h-pad;y++){
      for(let x=pad;x<this.w-pad;x++){
        const i=y*this.w+x;if(this.water[i])continue;
        // Uniform terrain has unit lighting, no ridge and no contour ink.
        // Keep its existing pigment untouched instead of shading every sample.
        const height=z[i]!;
        if(style.mode!=='height'&&height===z[i-1]&&height===z[i+1]&&height===z[i-this.w]&&height===z[i+this.w]&&height===z[i-step]&&height===z[i+step]&&height===z[i-stride]&&height===z[i+stride])continue;
        const zx=(z[i+1]!-z[i-1]!)/2,zy=(z[i+this.w]!-z[i-this.w]!)/2,sx=(z[i+step]!-z[i-step]!)/(2*dx*step),sy=(z[i+stride]!-z[i-stride]!)/(2*dy*step);
        const light=lighting(sx,sy);
        const convex=Math.max(0,(z[i]!*4-z[i-step]!-z[i+step]!-z[i-stride]!-z[i+stride]!)/(step*(dx+dy)));
        const ridge=style.mode==='drawn'?Math.min(.14,convex*.24)*style.strength:0;
        // Height derivatives use the 2x sample grid; contour spacing is in output pixels.
        const contour=this.contours===0?0:terrainContourInk(z[i]!,Math.hypot(zx,zy),this.contours,this.seaLevelM,2);
        const ink=Math.max(ridge,contour),analysis=style.mode==='height'?elevationColor(z[i]!,this.seaLevelM):null;
        for(let c=0;c<3;c++){const at=i*4+c,value=analysis?.[c]??this.samples[at]!;this.samples[at]=Math.round(Math.max(0,Math.min(255,value*light))*(1-ink)+inkRgb[c]!*ink);}
      }
      if((y-pad+1)%16===0)yield* checkpoint();
    }
    if(style.mode!=='drawn'||!style.strength)return;
    const sample=(p:{x:number;y:number})=>{
      const x=Math.round((p.x-this.sampleBox.x)/dx-.5),y=Math.round((p.y-this.sampleBox.y)/dy-.5);
      if(x<step||y<step||x>=this.w-step||y>=this.h-step)return {heightM:0,sx:0,sy:0,water:true};
      const i=y*this.w+x;return {heightM:z[i]!,sx:(z[i+step]!-z[i-step]!)/(2*dx*step),sy:(z[i+stride]!-z[i-stride]!)/(2*dy*step),water:!!this.water[i]};
    };
    const mpp=Math.max(this.box.width/this.width,Math.min(this.displayMpp,this.box.width/this.width*2));
    // Marks affect only relief pixels; symbols, labels and roads are drawn later.
    for(const mark of reliefMarks(this.box,mpp,sample,style.strength)){
      const points=mark.points.map(p=>({x:(p.x-this.sampleBox.x)/dx-.5,y:(p.y-this.sampleBox.y)/dy-.5}));
      const radius=mark.width/Math.max(dx,dy)/2;
      const left=Math.max(0,Math.floor(Math.min(...points.map(p=>p.x))-radius-1)),right=Math.min(this.w-1,Math.ceil(Math.max(...points.map(p=>p.x))+radius+1));
      const top=Math.max(0,Math.floor(Math.min(...points.map(p=>p.y))-radius-1)),bottom=Math.min(this.h-1,Math.ceil(Math.max(...points.map(p=>p.y))+radius+1));
      for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
        const i=y*this.w+x;if(this.water[i])continue;
        let distance=Infinity;
        for(let j=1;j<points.length;j++){const a=points[j-1]!,b=points[j]!,vx=b.x-a.x,vy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*vx+(y-a.y)*vy)/(vx*vx+vy*vy||1)));distance=Math.min(distance,Math.hypot(x-a.x-vx*t,y-a.y-vy*t));}
        const alpha=mark.opacity*Math.max(0,Math.min(1,radius+.5-distance));
        if(alpha)for(let c=0;c<3;c++){const at=i*4+c;this.samples[at]=Math.round(this.samples[at]!*(1-alpha)+inkRgb[c]!*alpha);}
      }
    }
  }
  paintRecordLine(record:LandscapeRecord,mpp=0){
    if(!mapRecordVisible(record,mpp))return;
    this.applyCoast();
    if(!record.line){this.paintLine(record.points,mapLineWidth(record.width,mpp),record.kind==="river"?"#629ebc":"#a37e51");return;}
    for(const part of lineParts(record)){if(part.polygons)this.paintPolygons(part.polygons,part.color,part.opacity);else this.paintStyledLine(part.points,mapLineWidth(part.width,mpp),part.color,part.opacity,part.dash,part.dashOffset);}
  }
  private paintStyledLine(points:{x:number;y:number}[],width:number,color:string,opacity:number,dash?:number[],dashOffset=0){
    // Rasterize the bounded visible sample lattice, not one object per dash across the world.
    const pixel=this.sampleBox.width/this.w,radius=Math.max(width/2,pixel/2),period=dash?.reduce((a,b)=>a+b,0)??0;
    const coverage=new Uint8Array(this.w*this.h);let travel=dashOffset;
    for(let i=1;i<points.length;i++){
      const a=points[i-1]!,b=points[i]!,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(!len)continue;
      const fromX=Math.max(0,Math.floor((Math.min(a.x,b.x)-radius-this.sampleBox.x)/this.sampleBox.width*this.w)),toX=Math.min(this.w-1,Math.ceil((Math.max(a.x,b.x)+radius-this.sampleBox.x)/this.sampleBox.width*this.w));
      const fromY=Math.max(0,Math.floor((Math.min(a.y,b.y)-radius-this.sampleBox.y)/this.sampleBox.height*this.h)),toY=Math.min(this.h-1,Math.ceil((Math.max(a.y,b.y)+radius-this.sampleBox.y)/this.sampleBox.height*this.h));
      for(let y=fromY;y<=toY;y++)for(let x=fromX;x<=toX;x++){
        const px=this.sampleBox.x+(x+.5)/this.w*this.sampleBox.width,py=this.sampleBox.y+(y+.5)/this.h*this.sampleBox.height,t=Math.max(0,Math.min(1,((px-a.x)*dx+(py-a.y)*dy)/(len*len)));
        if(Math.hypot(px-a.x-dx*t,py-a.y-dy*t)>radius)continue;
        let strength=1;
        if(dash&&period){
          if(period<pixel)strength=dash.reduce((v,n,j)=>v+(j%2?0:n),0)/period;
          else {let phase=(travel+t*len)%period,j=0;while(j<dash.length-1&&phase>dash[j]!){phase-=dash[j]!;j++;}if(j%2&&Math.min(phase,dash[j]!-phase)>radius)continue;}
        }
        coverage[y*this.w+x]=Math.max(coverage[y*this.w+x]!,Math.round(strength*255));
      }
      travel+=len;
    }
    const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
    for(let i=0;i<coverage.length;i++)if(coverage[i]){const at=i*4,alpha=opacity*coverage[i]!/255,old=this.samples[at+3]!/255,combined=alpha+old*(1-alpha);for(let c=0;c<3;c++)this.samples[at+c]=Math.round((rgb[c]!*alpha+this.samples[at+c]!*old*(1-alpha))/combined);this.samples[at+3]=Math.round(combined*255);}
  }
  paintPolygons(polygons:Polygon[],color:string,opacity=1){
    for(const _ of this.paintPolygonsSteps(polygons,color,opacity,function*(){})){}
  }
  private *paintPolygonsSteps(polygons:Polygon[],color:string,opacity:number,checkpoint:()=>Generator<void>):Generator<void>{
    if(!/^#[a-f0-9]{6}$/i.test(color))throw new Error('Darstellungsfarbe fehlt.');
    const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));for(const p of polygons)yield* this.polygonSteps(p,rgb,opacity,undefined,undefined,checkpoint);
  }
  paintLine(points:{x:number;y:number}[],width:number,color:string,opacity=1){
    this.applyCoast();
    const radius=Math.max(width/2,this.sampleBox.width/this.w);
    for(let i=0;i<points.length;i++){
      const p=points[i]!,a=points[i-1];
      if(a){const d=Math.hypot(p.x-a.x,p.y-a.y)||1,x=-(p.y-a.y)/d*radius,y=(p.x-a.x)/d*radius;this.paintPolygons([{outer:[{x:a.x+x,y:a.y+y},{x:p.x+x,y:p.y+y},{x:p.x-x,y:p.y-y},{x:a.x-x,y:a.y-y}],holes:[]}],color,opacity);}
      this.paintPolygons([{outer:Array.from({length:12},(_,i)=>({x:p.x+Math.cos(i*Math.PI/6)*radius,y:p.y+Math.sin(i*Math.PI/6)*radius})),holes:[]}],color,opacity);
    }
  }
  private polygon(p: Polygon, rgb: number[], alpha=1, target?:'ground'|'water', water?:boolean) {
    for(const _ of this.polygonSteps(p,rgb,alpha,target,water,function*(){})){}
  }
  private *polygonSteps(p:Polygon,rgb:number[],alpha:number,target:'ground'|'water'|undefined,water:boolean|undefined,checkpoint:()=>Generator<void>):Generator<void>{
    const rings=[p.outer,...p.holes].map(r=>r.map(v=>({x:(v.x-this.sampleBox.x)/this.sampleBox.width*this.w,y:(v.y-this.sampleBox.y)/this.sampleBox.height*this.h})));
    let minY=this.h,maxY=-1;
    for(const ring of rings)for(const v of ring){minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);}
    for(let y=Math.max(0,Math.ceil(minY-.5));y<=Math.min(this.h-1,Math.floor(maxY-.5));y++){
      if(y%16===0)yield* checkpoint();
      const intersections:number[]=[],scan=y+.5;
      for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){
        const a=ring[j]!,b=ring[i]!;
        if((a.y>scan)!==(b.y>scan))intersections.push(a.x+(scan-a.y)*(b.x-a.x)/(b.y-a.y));
      }
      intersections.sort((a,b)=>a-b);
      for(let i=0;i+1<intersections.length;i+=2){
        const from=Math.max(0,Math.ceil(intersections[i]!-.5)),to=Math.min(this.w-1,Math.floor(intersections[i+1]!-.5));
        for(let x=from;x<=to;x++){
          const pixel=y*this.w+x,at=pixel*4;
          if(target&&(target==='water')!==!!this.water[pixel])continue;
          if(water!==undefined)this.water[pixel]=water?1:0;
          const old=this.samples[at+3]!/255,combined=alpha+old*(1-alpha);
          for(let c=0;c<3;c++)this.samples[at+c]=Math.round((rgb[c]!*alpha+this.samples[at+c]!*old*(1-alpha))/(combined||1));
          this.samples[at+3]=Math.round(combined*255);
        }
      }
    }
  }
  finish(): Uint8Array {
    this.applyCoast();
    for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++){
      const out=(y*this.width+x)*4,at=((y+LANDSCAPE_RASTER_PAD)*2*this.w+(x+LANDSCAPE_RASTER_PAD)*2)*4,below=at+this.w*4,s=this.samples;
      const a=s[at+3]!,b=s[at+7]!,c=s[below+3]!,d=s[below+7]!,alpha=a+b+c+d;
      if(alpha){
        for(let channel=0;channel<3;channel++)this.pixels[out+channel]=Math.round((s[at+channel]!*a+s[at+4+channel]!*b+s[below+channel]!*c+s[below+4+channel]!*d)/alpha);
        this.pixels[out+3]=Math.round(alpha/4);
      }
    }
    return this.pixels;
  }
}
export interface LandscapeRaster {
  /** Transparent aggregate drawn above a separately projected terrain surface. */
  content?: 'objects';
  campaignId: string; revision: number; box: LandscapeBox;
  width: number; height: number; data: string;
}
// Worker/PNG/database code belongs to desktop, not this browser-safe module.
