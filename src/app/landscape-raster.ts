import type { LandscapeBox, LandscapeRecord } from './atlas-landscape';
import type { Polygon } from './contracts';
import { terrainColors } from './world-model';

/** Display-only supersampled raster. Exact queries always use author geometry. */
export class LandscapeRasterizer {
  readonly pixels: Uint8Array;
  private readonly samples: Uint8Array;
  private readonly w: number;
  private readonly h: number;
  constructor(readonly box: LandscapeBox, readonly width: number, readonly height: number) {
    if(!box||![box.x,box.y,box.width,box.height].every(Number.isFinite)||box.width<=0||box.height<=0||
       !Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>1024||height>1024)
      throw new Error('Landschaftsübersicht prüfen.');
    this.w=width*2;this.h=height*2;
    this.samples=new Uint8Array(this.w*this.h*4);
    this.pixels=new Uint8Array(width*height*4);
  }
  paint(record: LandscapeRecord) {
    if(record.kind!=='patch'||!record.values.terrain)return;
    const color=terrainColors[record.values.terrain];if(!color)throw new Error('Geländefarbe fehlt.');
    const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
    for(const polygon of record.polygons)this.polygon(polygon,rgb);
  }
  private polygon(p: Polygon, rgb: number[]) {
    const rings=[p.outer,...p.holes].map(r=>r.map(v=>({x:(v.x-this.box.x)/this.box.width*this.w,y:(v.y-this.box.y)/this.box.height*this.h})));
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
        for(let x=from;x<=to;x++){const at=(y*this.w+x)*4;this.samples[at]=rgb[0]!;this.samples[at+1]=rgb[1]!;this.samples[at+2]=rgb[2]!;this.samples[at+3]=255;}
      }
    }
  }
  finish(): Uint8Array {
    for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++){
      const out=(y*this.width+x)*4, totals=[0,0,0];let alpha=0;
      for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
        const at=((y*2+dy)*this.w+x*2+dx)*4,a=this.samples[at+3]!;alpha+=a;
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
