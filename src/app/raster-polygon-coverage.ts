import type {Point} from './contracts';

/** Clip in pixel-local coordinates. Signed ring areas retain holes and disconnected
 * pieces of a concave ring without recursively refining the material function. */
function clippedArea(ring:readonly Point[],x:number,y:number):number {
  let points=ring.map(p=>({x:p.x-x,y:p.y-y}));
  for(const [axis,edge,keepLow] of [['x',0,false],['x',1,true],['y',0,false],['y',1,true]] as const){
    const next:Point[]=[];
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const a=points[j]!,b=points[i]!,insideA=keepLow?a[axis]<=edge:a[axis]>=edge,insideB=keepLow?b[axis]<=edge:b[axis]>=edge;
      if(insideA!==insideB){const t=(edge-a[axis])/(b[axis]-a[axis]);next.push({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});}
      if(insideB)next.push(b);
    }
    points=next;if(!points.length)return 0;
  }
  let area=0;for(let i=0,j=points.length-1;i<points.length;j=i++)area+=points[j]!.x*points[i]!.y-points[i]!.x*points[j]!.y;
  return Math.abs(area)/2;
}

/** Scanline interiors cost one operation per covered sample. Only edge cells
 * need polygon clipping; subpixel strips and holes are never center-classified. */
export function* polygonCoverageRows(rings:readonly (readonly Point[])[],width:number,height:number):Generator<{y:number;values:Float32Array}> {
  let minY=height,maxY=0;
  for(const ring of rings)for(const p of ring){minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
  const clampX=(x:number)=>Math.max(0,Math.min(width,x));
  const values=new Float32Array(width),boundary=new Uint8Array(width);
  for(let y=Math.max(0,Math.floor(minY));y<Math.min(height,Math.ceil(maxY));y++){
    values.fill(0);boundary.fill(0);const crossings:number[]=[],scan=y+.5;
    for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const a=ring[j]!,b=ring[i]!;
      if((a.y>scan)!==(b.y>scan))crossings.push(a.x+(scan-a.y)*(b.x-a.x)/(b.y-a.y));
      if(Math.max(a.y,b.y)<y||Math.min(a.y,b.y)>y+1)continue;
      const at=(v:number)=>a.x+(v-a.y)*(b.x-a.x)/(b.y-a.y);
      const p=a.y===b.y?a.x:at(Math.max(y,Math.min(a.y,b.y))),q=a.y===b.y?b.x:at(Math.min(y+1,Math.max(a.y,b.y)));
      boundary.fill(1,clampX(Math.floor(Math.min(p,q))),clampX(Math.floor(Math.max(p,q))+1));
    }
    crossings.sort((a,b)=>a-b);
    for(let i=0;i+1<crossings.length;i+=2)values.fill(1,clampX(Math.ceil(crossings[i]!-.5)),clampX(Math.ceil(crossings[i+1]!-.5)));
    for(let x=0;x<width;x++)if(boundary[x]){
      let area=clippedArea(rings[0]!,x,y);for(let k=1;k<rings.length;k++)area-=clippedArea(rings[k]!,x,y);
      values[x]=Math.max(0,Math.min(1,area));
    }
    yield {y,values};
  }
}
