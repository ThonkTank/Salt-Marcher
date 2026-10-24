// Exact polynomial pieces for a convex authored boundary. No screen-space radius.
// Nonconvex, holed and large inputs are rejected, never approximated as convex.
function clip(points,a,b,c){
 const result=[];
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const p=points[j],q=points[i],fp=a*p[0]+b*p[1]+c,fq=a*q[0]+b*q[1]+c;
  if((fp<=0)!==(fq<=0)){const t=fp/(fp-fq);result.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}
  if(fq<=0)result.push(q);
 }
 return result;
}
function signedArea(points){let sum=0;for(let i=0,j=points.length-1;i<points.length;j=i++)sum+=points[j][0]*points[i][1]-points[i][0]*points[j][1];return sum/2;}
export function convexFeatherRegions(polygon,radius,curve='linear'){
 if(!Number.isFinite(radius)||radius<0||!['linear','smoothstep'].includes(curve))throw Error('Invalid feather parameters');
 if(polygon.holes.length)throw Error('Convex feather prototype does not support holes');
 let ring=polygon.outer.map(p=>[p.x,p.y]);
 if(ring.length>1&&ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1])ring.pop();
 if(ring.length<3||ring.length>64||ring.some(p=>!p.every(Number.isFinite)))throw Error('Convex feather requires 3 to 64 finite vertices');
 const origin=ring[0];ring=ring.map(p=>[p[0]-origin[0],p[1]-origin[1]]);
 const scale=Math.max(...ring.flat().map(Math.abs));if(!scale)throw Error('Degenerate feather polygon');
 ring=ring.map(p=>[p[0]/scale,p[1]/scale]);const localRadius=radius/scale;
 const signed=signedArea(ring);if(!signed)throw Error('Degenerate feather polygon');
 const orientation=Math.sign(signed),planes=[];
 for(let i=0;i<ring.length;i++){
  const p=ring[i],q=ring[(i+1)%ring.length],dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);if(!length)continue;
  const a=-dy/length*orientation,b=dx/length*orientation,c=-(a*p[0]+b*p[1]);
  if(ring.some(v=>a*v[0]+b*v[1]+c < -1e-12))throw Error('Convex feather prototype does not support concave polygons');
  if(!planes.some(p=>Math.abs(p.a-a)<1e-12&&Math.abs(p.b-b)<1e-12&&Math.abs(p.c-c)<1e-12))planes.push({a,b,c});
 }
 const regions=[];
 const append=(points,plane,full)=>{
  if(points.length<3||Math.abs(signedArea(points))<1e-20)return;
  const world=points.map(p=>[p[0]*scale+origin[0],p[1]*scale+origin[1]]);world.push(world[0]);
  const fade=full?()=>1:point=>{
   const t=(plane.a*((point.x-origin[0])/scale)+plane.b*((point.y-origin[1])/scale)+plane.c)/localRadius;
   return curve==='linear'?t:t*t*(3-2*t);
  };
  regions.push({geometry:[[world]],fade,varying:!full,polynomialDegree:full?0:curve==='linear'?1:3});
 };
 if(radius===0){append(ring,undefined,true);return regions;}
 let interior=ring;
 for(const p of planes)interior=clip(interior,-p.a,-p.b,localRadius-p.c);
 append(interior,undefined,true);
 for(let i=0;i<planes.length;i++){
  const p=planes[i];let region=ring;
  // The nearest supporting line is the nearest boundary of a convex polygon.
  for(let j=0;j<planes.length&&region.length;j++)if(j!==i){const q=planes[j];region=clip(region,p.a-q.a,p.b-q.b,p.c-q.c);}
  append(clip(region,p.a,p.b,p.c-localRadius),p,false);
 }
 return regions;
}
