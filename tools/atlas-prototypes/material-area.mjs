// Experimental reference, deliberately not connected to the production raster.
// Partition each cell by source geometry, compose per face, then area-average.
import polygonClipping from 'polygon-clipping';
import {ShapeUtils, Vector2} from 'three';

export const rectangle = (x,y,width,height) => [[[[x,y],[x+width,y],[x+width,y+height],[x,y+height],[x,y]]]];
function ringArea(ring) {
  const [ox,oy]=ring[0];let area=0;
  for(let i=1;i+1<ring.length;i++)area+=(ring[i][0]-ox)*(ring[i+1][1]-oy)-(ring[i+1][0]-ox)*(ring[i][1]-oy);
  return Math.abs(area)/2;
}
export function area(polygons) {return polygons.reduce((sum,p)=>sum+ringArea(p[0])-p.slice(1).reduce((n,r)=>n+ringArea(r),0),0);}
const vertices = geometry => geometry.reduce((sum,p)=>sum+p.reduce((n,r)=>n+r.length,0),0);
function bounds(geometry) {
  let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
  for(const p of geometry)for(const r of p)for(const v of r){x=Math.min(x,v[0]);y=Math.min(y,v[1]);right=Math.max(right,v[0]);bottom=Math.max(bottom,v[1]);}
  return {x,y,right,bottom};
}
const overlap=(a,b)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;
const triangleArea=(a,b,c)=>Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;
const midpoint=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
export class AreaBudgetExceeded extends Error {}

// Center classification is used only where NO source boundary touches the cell.
// Boundary cells still use exact face clipping, including subpixel holes/islands.
function classifyCells(geometry,width,height,tick){
  const cells=new Uint8Array(width*height);
  for(const polygon of geometry){
    for(let y=0;y<height;y++){
      tick();const scan=y+.5,crossings=[];
      for(const ring of polygon)for(let i=0,j=ring.length-1;i<ring.length;j=i++){
        tick();const a=ring[j],b=ring[i];
        if((a[1]>scan)!==(b[1]>scan))crossings.push(a[0]+(scan-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      crossings.sort((a,b)=>a-b);
      for(let i=0;i+1<crossings.length;i+=2){
        const from=Math.max(0,Math.ceil(crossings[i]-.5)),to=Math.min(width-1,Math.floor(crossings[i+1]-.5));
        for(let x=from;x<=to;x++){tick();cells[y*width+x]|=1;}
      }
    }
    for(const ring of polygon)for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const a=ring[j],b=ring[i],minY=Math.min(a[1],b[1]),maxY=Math.max(a[1],b[1]);
      for(let y=Math.max(0,Math.ceil(minY)-1);y<=Math.min(height-1,Math.floor(maxY));y++){
        tick();let left,right;
        if(a[1]===b[1]){left=Math.min(a[0],b[0]);right=Math.max(a[0],b[0]);}
        else{
          const at=v=>a[0]+(v-a[1])*(b[0]-a[0])/(b[1]-a[1]);
          const p=at(Math.max(y,minY)),q=at(Math.min(y+1,maxY));left=Math.min(p,q);right=Math.max(p,q);
        }
        for(let x=Math.max(0,Math.ceil(left)-1);x<=Math.min(width-1,Math.floor(right));x++){tick();cells[y*width+x]|=2;}
      }
    }
  }
  return cells;
}

/** Each layer mutates a fresh channel vector, only inside its source geometry.
 * Layers are in author order. A nonconstant layer must set varying:true and the
 * caller must supply a conservative Lipschitz bound for FINAL composed channels.
 * Geometry is pixel-local to avoid cancellation at large world coordinates.
 * No approximate fallback: an exceeded work/face/vertex budget rejects the tile.
 */
export function integrateMaterialArea({box,width,height,background,layers,limits={},tolerance=1/255,lipschitz=0,interiorFastPath=true,localClipping=true}) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>1024||height>1024||
    ![box.x,box.y,box.width,box.height,...background,tolerance,lipschitz].every(Number.isFinite)||box.width<=0||box.height<=0||tolerance<=0||lipschitz<0)
    throw Error('Invalid area prototype input');
  const budget={inputVertices:65536,cellVertices:16384,cachedVertices:65536,cachedPieces:4096,faces:256,work:2000000,depth:16,classifierBytes:16*1024*1024,...limits};
  for(const value of Object.values(budget))if(!Number.isSafeInteger(value)||value<1)throw Error('Invalid area budget');
  const stats={inputVertices:0,clipCalls:0,localClipCalls:0,cachedVertices:0,cachedPieces:0,peakClipSourceVertices:0,peakFaces:1,peakCellVertices:0,evaluations:0,subdivisions:0,work:0,classifierBytes:0};
  const tick=()=>{if(++stats.work>budget.work)throw new AreaBudgetExceeded('Area work budget exceeded');};
  const dx=box.width/width,dy=box.height/height,scale=Math.max(dx,dy);
  const prepared=layers.map(layer=>{
    stats.inputVertices+=vertices(layer.geometry);if(stats.inputVertices>budget.inputVertices)throw new AreaBudgetExceeded('Area input vertex budget exceeded');
    const local=layer.geometry.map(p=>p.map(r=>r.map(([x,y])=>{
      if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Nonfinite source coordinate');
      return [(x-box.x)/dx,(y-box.y)/dy];
    })));
    if(layer.varying&&lipschitz===0)throw Error('Varying material needs a final-channel Lipschitz bound');
    let cells;
    if(interiorFastPath){
      stats.classifierBytes+=width*height;
      if(stats.classifierBytes>budget.classifierBytes)throw new AreaBudgetExceeded('Area classifier byte budget exceeded');
      cells=classifyCells(local,width,height,tick);
    }
    return {...layer,geometry:local,bounds:bounds(local),cells,pieces:new Map()};
  });
  const rootSize=2**Math.ceil(Math.log2(Math.max(width,height)));
  // Cache a hierarchy of clipped source pieces down to 16-pixel blocks.
  // A detailed world boundary must not be rescanned for every boundary pixel.
  const localGeometry=(layer,x,y,size=16)=>{
    if(!localClipping||size>=rootSize)return layer.geometry;
    const bx=Math.floor(x/size),by=Math.floor(y/size),key=`${size}/${bx}/${by}`;
    if(layer.pieces.has(key))return layer.pieces.get(key);
    const parent=localGeometry(layer,x,y,size*2);tick();stats.localClipCalls++;
    if(++stats.cachedPieces>budget.cachedPieces)throw new AreaBudgetExceeded('Area clipped source piece budget exceeded');
    const clipped=polygonClipping.intersection(parent,rectangle(bx*size,by*size,size,size));
    stats.cachedVertices+=vertices(clipped);
    if(stats.cachedVertices>budget.cachedVertices)throw new AreaBudgetExceeded('Area clipped source vertex budget exceeded');
    layer.pieces.set(key,clipped);return clipped;
  };
  const channels=background.length,pixels=new Float64Array(width*height*channels),errorBounds=new Float64Array(width*height);
  for(let y=0;y<height;y++){
   const rowLayers=prepared.map((layer,index)=>({layer,index})).filter(({layer})=>{tick();return layer.bounds.y<y+1&&layer.bounds.bottom>y;});
   for(let x=0;x<width;x++){
    const cell={x,y,right:x+1,bottom:y+1};
    const activeLayers=rowLayers.filter(({layer})=>{tick();return overlap(cell,layer.bounds);});
    if(!activeLayers.length){pixels.set(background,(y*width+x)*channels);continue;}
    let faces=[{geometry:rectangle(x,y,1,1),active:[]}];
    for(const {layer,index} of activeLayers){
      const classification=layer.cells?.[y*width+x];
      if(classification!==undefined&&!(classification&2)){
        if(classification&1)for(const face of faces)face.active=[...face.active,index];
        continue;
      }
      const sourceGeometry=localGeometry(layer,x,y);
      stats.peakClipSourceVertices=Math.max(stats.peakClipSourceVertices,vertices(sourceGeometry));
      const next=[];
      for(const face of faces){
        tick();stats.clipCalls++;const inside=polygonClipping.intersection(face.geometry,sourceGeometry);
        if(!inside.length){next.push(face);continue;}
        stats.clipCalls++;const outside=polygonClipping.difference(face.geometry,sourceGeometry);
        if(outside.length)next.push({geometry:outside,active:face.active});
        next.push({geometry:inside,active:[...face.active,index]});
        if(next.length>budget.faces)throw new AreaBudgetExceeded('Area face budget exceeded');
      }
      faces=next;const count=faces.reduce((n,f)=>n+vertices(f.geometry),0);
      stats.peakFaces=Math.max(stats.peakFaces,faces.length);stats.peakCellVertices=Math.max(stats.peakCellVertices,count);
      if(count>budget.cellVertices)throw new AreaBudgetExceeded('Area cell vertex budget exceeded');
    }
    const out=(y*width+x)*channels;
    for(const face of faces){
      const evaluate=point=>{
        tick();stats.evaluations++;const value=[...background],world={x:box.x+point[0]*dx,y:box.y+point[1]*dy};
        for(const index of face.active)prepared[index].paint(value,world);
        if(value.length!==channels||!value.every(Number.isFinite))throw Error('Invalid material result');
        return value;
      };
      if(!face.active.some(index=>prepared[index].varying)){
        const value=evaluate(face.geometry[0][0][0]),weight=area(face.geometry);
        for(let c=0;c<channels;c++)pixels[out+c]+=value[c]*weight;
        continue;
      }
      for(const polygon of face.geometry){
        const rings=polygon.map(r=>r.slice(0,-1).map(p=>new Vector2(...p))),flat=rings.flat();
        const triangles=ShapeUtils.triangulateShape(rings[0],rings.slice(1));
        const stack=triangles.map(t=>({points:t.map(i=>[flat[i].x,flat[i].y]),depth:0}));
        while(stack.length){
          tick();const {points:[a,b,c],depth}=stack.pop(),weight=triangleArea(a,b,c);
          if(!weight)continue;
          const center=[(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3];
          const radius=Math.max(...[a,b,c].map(p=>Math.hypot((p[0]-center[0])*dx,(p[1]-center[1])*dy)));
          const error=lipschitz*radius;
          if(error<=tolerance){
            const value=evaluate(center);for(let k=0;k<channels;k++)pixels[out+k]+=value[k]*weight;
            errorBounds[y*width+x]+=error*weight;
          }else{
            if(depth>=budget.depth)throw new AreaBudgetExceeded('Area integration depth exceeded');
            stats.subdivisions++;
            const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
            for(const points of [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]])stack.push({points,depth:depth+1});
          }
        }
      }
    }
   }
  }
  return {pixels,errorBounds,stats,pixelArea:dx*dy,scale};
}
