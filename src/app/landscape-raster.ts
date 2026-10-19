import {maskAt,MASK_SEA_LEVEL} from './land-mask';
import {lineParts} from "./landscape-line";
import {colorParts} from "./landscape-brush";
import type { LandscapeBox, LandscapeRecord } from './atlas-landscape';
import type { Polygon } from './contracts';
import { terrainColors } from './world-model';

export const UNPAINTED_LAND = [238, 229, 207] as const;
const COAST_INK = [104, 86, 57] as const;
// Read a halo as well as the visible tile: a tile edge is never a coastline.
export const LANDSCAPE_RASTER_PAD = 4;
export function landscapeRasterBounds(box:LandscapeBox,width:number,height:number):LandscapeBox {
  const dx=box.width/width*LANDSCAPE_RASTER_PAD,dy=box.height/height*LANDSCAPE_RASTER_PAD;
  return {x:box.x-dx,y:box.y-dy,width:box.width+2*dx,height:box.height+2*dy};
}

/** Display-only supersampled raster. Exact queries always use author geometry. */
export class LandscapeRasterizer {
  readonly pixels: Uint8Array;
  private readonly samples: Uint8Array;
  private readonly water: Uint8Array;
  private readonly w: number;
  private readonly h: number;
  private masks:LandscapeRecord[]=[];
  private fresh:LandscapeRecord[]=[];
  private maskPending=false;
  private coastPending=false;
  readonly sampleBox:LandscapeBox;
  constructor(readonly box: LandscapeBox, readonly width: number, readonly height: number) {
    if(!box||![box.x,box.y,box.width,box.height].every(Number.isFinite)||box.width<=0||box.height<=0||
       !Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>1024||height>1024)
      throw new Error('Landschaftsübersicht prüfen.');
    this.sampleBox=landscapeRasterBounds(box,width,height);
    this.w=(width+2*LANDSCAPE_RASTER_PAD)*2;this.h=(height+2*LANDSCAPE_RASTER_PAD)*2;
    this.samples=new Uint8Array(this.w*this.h*4);
    this.water=new Uint8Array(this.w*this.h).fill(1);
    this.pixels=new Uint8Array(width*height*4);
  }
  paint(record: LandscapeRecord) {
    if(record.mask){this.masks.push(record);this.maskPending=true;this.coastPending=true;return;}
    if(record.surface==='freshwater'){this.fresh.push(record);this.maskPending=true;this.coastPending=true;return;}
    if(record.kind!=='patch'||!record.values.terrain)return;
    this.coastPending=true;
    if(record.maskManaged)this.maskPending=true;
    const color=terrainColors[record.values.terrain];if(!color)throw new Error('Geländefarbe fehlt.');
    const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
    for(const polygon of record.polygons)this.polygon(polygon,rgb,1,undefined,record.maskManaged?undefined:record.values.terrain==='water');
  }
  private applyMasks(){
    if(!this.maskPending)return;this.maskPending=false;
    const land=UNPAINTED_LAND,sea=[127,168,189];
    for(const r of this.masks.sort((a,b)=>b.resolution-a.resolution)){
      const m=r.mask!,size=256*m.pixel,x0=Math.max(0,Math.floor((m.x-this.sampleBox.x)/this.sampleBox.width*this.w)),x1=Math.min(this.w,Math.ceil((m.x+size-this.sampleBox.x)/this.sampleBox.width*this.w)),y0=Math.max(0,Math.floor((m.y-this.sampleBox.y)/this.sampleBox.height*this.h)),y1=Math.min(this.h,Math.ceil((m.y+size-this.sampleBox.y)/this.sampleBox.height*this.h));
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const v=maskAt(m,{x:this.sampleBox.x+(x+.5)/this.w*this.sampleBox.width,y:this.sampleBox.y+(y+.5)/this.h*this.sampleBox.height});if(v!==undefined)this.water[y*this.w+x]=v<MASK_SEA_LEVEL?1:0;}
    }
    for(let i=0;i<this.water.length;i++){
      const at=i*4;if(this.water[i]||!this.samples[at+3]||(this.samples[at]===127&&this.samples[at+1]===168&&this.samples[at+2]===189)){const rgb=this.water[i]?sea:land;for(let c=0;c<3;c++)this.samples[at+c]=rgb[c]!;this.samples[at+3]=255;}
    }
    for(const r of this.fresh)for(const p of r.polygons)this.polygon(p,sea,1,undefined,true);
  }
  paintColor(record:LandscapeRecord){
    this.applyMasks();
    if(!record.paint)return;
    // Accumulate flow within one stroke, then apply its maximum opacity once.
    // Allocation is limited to the visible tile, never the authored world extent.
    const pigment=new LandscapeRasterizer(this.box,this.width,this.height);
    for(const part of colorParts(record))pigment.paintPolygons(part.polygons,part.color,part.opacity);
    for(let i=0;i<this.water.length;i++){
      if((record.paint.target==='water')!==!!this.water[i])continue;
      const at=i*4,alpha=pigment.samples[at+3]!/255*record.paint.opacity;if(!alpha)continue;
      const old=this.samples[at+3]!/255,combined=alpha+old*(1-alpha);
      for(let c=0;c<3;c++)this.samples[at+c]=Math.round((pigment.samples[at+c]!*alpha+this.samples[at+c]!*old*(1-alpha))/combined);
      this.samples[at+3]=Math.round(combined*255);
    }
  }
  private applyCoast(){
    this.applyMasks();
    if(!this.coastPending)return;
    this.coastPending=false;
    const w=this.w,h=this.h,water=this.water,distance=new Uint8Array(w*h).fill(24);
    // Chamfer distance in half-sample units; bounded to a three-pixel shore band.
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=y*w+x,v=water[i];
      if(v!==water[i-1]||v!==water[i+1]||v!==water[i-w]||v!==water[i+w])distance[i]=1;
    }
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=y*w+x;distance[i]=Math.min(distance[i]!,distance[i-1]!+2,distance[i-w]!+2,distance[i-w-1]!+3,distance[i-w+1]!+3);
    }
    for(let y=h-2;y>0;y--)for(let x=w-2;x>0;x--){
      const i=y*w+x;distance[i]=Math.min(distance[i]!,distance[i+1]!+2,distance[i+w]!+2,distance[i+w-1]!+3,distance[i+w+1]!+3);
    }
    for(let i=0;i<distance.length;i++){
      const d=distance[i]!/2,ink=Math.max(0,Math.min(1,1.95-d)),shore=water[i]?0:Math.max(0,1-d/7)*.18,alpha=Math.max(ink,shore);
      if(!alpha)continue;
      const at=i*4,old=this.samples[at+3]!/255,total=alpha+old*(1-alpha);
      for(let c=0;c<3;c++)this.samples[at+c]=Math.round((COAST_INK[c]!*alpha+this.samples[at+c]!*old*(1-alpha))/total);
      this.samples[at+3]=Math.round(total*255);
    }
  }
  paintRecordLine(record:LandscapeRecord,mpp=0){
    this.applyCoast();
    for(const part of lineParts(record,mpp)){if(part.polygons)this.paintPolygons(part.polygons,part.color,part.opacity);else this.paintStyledLine(part.points,part.width,part.color,part.opacity,part.dash,part.dashOffset);}
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
    if(!/^#[a-f0-9]{6}$/i.test(color))throw new Error('Darstellungsfarbe fehlt.');
    const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));for(const p of polygons)this.polygon(p,rgb,opacity);
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
    const rings=[p.outer,...p.holes].map(r=>r.map(v=>({x:(v.x-this.sampleBox.x)/this.sampleBox.width*this.w,y:(v.y-this.sampleBox.y)/this.sampleBox.height*this.h})));
    let minY=this.h,maxY=-1;
    for(const ring of rings)for(const v of ring){minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);}
    for(let y=Math.max(0,Math.ceil(minY-.5));y<=Math.min(this.h-1,Math.floor(maxY-.5));y++){
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
      const out=(y*this.width+x)*4, totals=[0,0,0];let alpha=0;
      for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
        const at=(((y+LANDSCAPE_RASTER_PAD)*2+dy)*this.w+(x+LANDSCAPE_RASTER_PAD)*2+dx)*4,a=this.samples[at+3]!;alpha+=a;
        for(let c=0;c<3;c++)totals[c]!+=this.samples[at+c]!*a;
      }
      if(alpha){for(let c=0;c<3;c++)this.pixels[out+c]=Math.round(totals[c]!/alpha);this.pixels[out+3]=Math.round(alpha/4);}
    }
    return this.pixels;
  }
}
export interface LandscapeRaster {
  campaignId: string; revision: number; box: LandscapeBox;
  width: number; height: number; data: string;
}
// Worker/PNG/database code belongs to desktop, not this browser-safe module.
