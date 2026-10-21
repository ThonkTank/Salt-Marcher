import * as THREE from 'three';
import type {Point} from './contracts';
import type {LandscapeRecord,LandscapeBox} from './atlas-landscape';
import {lineParts,linePoints} from './landscape-line';
import {nearestRoute} from './terrain-route';
import {routeDisplayMaterial,routeOverview} from './terrain-route-display';
import {routeSegmentRange,routeSampleSections} from './terrain-route-clip';

export function routeMeshes(r:LandscapeRecord,height:(p:Point)=>number,origin:{x:number;y:number;z:number},exaggeration:number,step:number,selected=false,coverage?:LandscapeBox,layout?:import('./terrain-grid-layout').TerrainRouteLayout):THREE.Mesh[]{
  const meshes:THREE.Mesh[]=[],curve=linePoints(r),nodes=r.route?.nodes;
  const box=coverage?{x:coverage.x-r.width*2,y:coverage.y-r.width*2,width:coverage.width+r.width*4,height:coverage.height+r.width*4}:undefined;
  const position=(p:Point,z:number)=>[p.x-origin.x,origin.y-p.y,(z-origin.z)*exaggeration+.025];
  const add=(vertices:number[],color:string,opacity=1)=>{
    if(!vertices.length)return;
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,opacity,transparent:opacity<1,depthWrite:opacity>=1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
    mesh.userData.landscapeId=r.id;routeDisplayMaterial(mesh,r,false,selected||!!r.route?.conflict);meshes.push(mesh);
  };
  const parts=lineParts(r);
  // Taper polygons use the same centreline, with a varying cross section.
  for(const part of parts){
    const points=part.polygons?curve:part.points,vertices:number[]=[];
    let travel=r.line?.continuity?.distanceOffset??0;
    for(let i=1;i<points.length;i++){
      const a=points[i-1]!,b=points[i]!,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(!length)continue;
      for(const sample of routeSampleSections(a,b,box,step,layout)){
        const {range}=sample,spacing=sample.step>step*1.01?sample.step:Math.min(step,r.width||step);
        const subdivisions=Math.max(1,Math.ceil(length*(range[1]-range[0])/Math.max(.1,spacing)));
        if(subdivisions>10000)continue;
        for(let j=0;j<subdivisions;j++){
          const t0=range[0]+(range[1]-range[0])*j/subdivisions,t1=range[0]+(range[1]-range[0])*(j+1)/subdivisions;
          const centre={x:a.x+dx*(t0+t1)/2,y:a.y+dy*(t0+t1)/2};
          const hit=nodes?.length?nearestRoute(nodes,centre):undefined;
          if(hit?.structure==='tunnel'&&!r.route?.conflict)continue;
          if(part.dash){
            const sum=part.dash.reduce((v,d)=>v+d,0);let at=(travel+length*(t0+t1)/2+(part.dashOffset??0))%sum,index=0;
            while(at>part.dash[index]!&&index<part.dash.length-1){at-=part.dash[index]!;index++;}
            if(index%2)continue;
          }
          const section=(t:number,side:number)=>{
            const p={x:a.x+dx*t,y:a.y+dy*t};
            const fade=r.kind==='river'&&r.line?.fadeIn?Math.min(1,(travel+length*t)/(r.width*8)):1;
            const worn=r.kind==='road'&&r.line?.style==='worn'?.84+.24*Math.sin((travel+length*t)/(r.width*2)+r.line.seed):1;
            const radius=part.width/2*fade*worn;
            const before=points[Math.max(0,i-2)]!,after=points[Math.min(points.length-1,i+1)]!;
            const miter=(ux:number,uy:number)=>{const n=Math.hypot(ux,uy);if(!n)return {x:-dy/length,y:dx/length};ux/=n;uy/=n;const divisor=Math.max(.5,1+ux*dx/length+uy*dy/length);return{x:(-uy-dy/length)/divisor,y:(ux+dx/length)/divisor};};
            const start=miter(a.x-before.x,a.y-before.y),end=miter(after.x-b.x,after.y-b.y);
            const edge={x:p.x+(start.x+(end.x-start.x)*t)*radius*side,y:p.y+(start.y+(end.y-start.y)*t)*radius*side};
            const profile=nodes?.length?nearestRoute(nodes,p):undefined;
            const z=profile&&!r.route?.conflict&&(r.kind==='river'||profile.structure==='bridge')?profile.z:height(edge);
            return position(edge,z);
          };
          const aa=section(t0,-1),ab=section(t0,1),ba=section(t1,-1),bb=section(t1,1);
          vertices.push(...aa,...ba,...ab,...ab,...ba,...bb);
          // A visible deck edge makes bridges read as structures from a tilted view.
          if(hit?.structure==='bridge'){
            const lower=(p:number[])=>[p[0]!,p[1]!,p[2]!-.5*exaggeration];
            vertices.push(...aa,...lower(aa),...ba,...ba,...lower(aa),...lower(ba),...ab,...bb,...lower(ab),...bb,...lower(bb),...lower(ab));
          }
        }
      }
      travel+=length;
    }
    add(vertices,r.route?.conflict?'#bf503d':selected?'#dc9a2d':part.color,part.opacity);
  }
  // Portals are explicit geometry; hidden tunnel segments do not paint the mountain.
  if(nodes)for(let i=1;i<nodes.length;i++){
    const a=nodes[i-1]!,b=nodes[i]!;
    if((a.structure==='tunnel')===(b.structure==='tunnel'))continue;
    const p=a.structure==='tunnel'?b:a;if(!routeSegmentRange(p,p,box))continue;const angle=Math.atan2(-(b.y-a.y),b.x-a.x);
    const g=new THREE.TorusGeometry(Math.max(1,r.width/2),Math.max(.2,r.width*.08),5,16,Math.PI);
    g.rotateX(Math.PI/2);g.rotateZ(angle+Math.PI/2);g.translate(p.x-origin.x,origin.y-p.y,(p.z-origin.z)*exaggeration);
    const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:'#7c7567',side:THREE.DoubleSide}));mesh.userData.landscapeId=r.id;meshes.push(mesh);
  }
  const overview=routeOverview(r,height,origin,exaggeration,step,selected||!!r.route?.conflict,box,layout);if(overview)meshes.push(overview);
  return meshes;
}
