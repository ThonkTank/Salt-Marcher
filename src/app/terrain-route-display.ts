import * as THREE from 'three';
import {LineSegments2} from 'three/examples/jsm/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/examples/jsm/lines/LineMaterial.js';
import {MAP_LINE_MIN_PIXELS,mapLineThreshold} from './atlas-scale-policy';
import type {LandscapeRecord,LandscapeBox} from './atlas-landscape';
import type {Point} from './contracts';
import {linePoints} from './landscape-line';
import {nearestRoute} from './terrain-route';
import {routeSampleSections} from './terrain-route-clip';

const smooth=(lo:number,hi:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-lo)/(hi-lo)));return t*t*(3-2*t);};
const visibilityCenter=new THREE.Vector3();
export function routeDisplayOpacity(pixels:number,threshold:number,overview:boolean,important=false){
 return (important?1:smooth(threshold*.5,threshold*1.5,pixels))*(overview?1-smooth(.75,1.75,pixels):1);
}

/** Scale is evaluated by the camera on every draw, including while reads wait.
 * The minimum-width overview fades into the unchanged physical ribbon. */
export function routeDisplayMaterial(mesh:THREE.Mesh,r:LandscapeRecord,overview=false,important=false){
 const material=mesh.material as THREE.Material,viewport={value:new THREE.Vector2(1,1)},
  threshold=mapLineThreshold(r.kind==='river'?'river':'road',r.style==='path'||r.style==='stream'),
  policy={value:new THREE.Vector4(r.width,threshold,Number(overview),Number(important))};
 material.transparent=true;material.depthWrite=false;
 material.onBeforeCompile=shader=>{
  shader.uniforms.routeViewport=viewport;shader.uniforms.routePolicy=policy;
  shader.vertexShader='uniform vec2 routeViewport; uniform vec4 routePolicy; varying vec2 routePerspective;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <fog_vertex>',`#include <fog_vertex>\nroutePerspective=vec2(-mvPosition.z,projectionMatrix[1][1]*routeViewport.y*.5);`);
  shader.fragmentShader='varying vec2 routePerspective; uniform vec4 routePolicy;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>',`
   float routePixels=routePolicy.x*routePerspective.y/max(.000001,routePerspective.x);
   gl_FragColor.a *= mix(smoothstep(routePolicy.y*.5,routePolicy.y*1.5,routePixels),1.0,routePolicy.w)*(1.0-routePolicy.z*smoothstep(.75,1.75,routePixels));
   if(gl_FragColor.a<.001)discard;
   #include <tonemapping_fragment>`);
 };
 material.customProgramCacheKey=()=> 'route-scale-v1';
 mesh.userData.routeDisplay={width:r.width,threshold,overview,important};
 mesh.onBeforeRender=renderer=>{
  renderer.getSize(viewport.value);
  if(material instanceof LineMaterial)material.resolution.copy(viewport.value);
 };
 // Screen-width geometry must pick its visible pixels, not an invisible old
 // world-width stripe. Hidden/faded routes cannot block terrain or other objects.
 const cast=mesh.raycast.bind(mesh),point=new THREE.Vector3();
 mesh.raycast=(ray,hits)=>{
  const camera=ray.camera;if(!camera)return;
  const candidates:THREE.Intersection[]=[];cast(ray,candidates);
  for(const hit of candidates){
   point.copy(hit.point).applyMatrix4(camera.matrixWorldInverse);
   const pixels=r.width*camera.projectionMatrix.elements[5]!*viewport.value.y*.5/Math.max(.000001,-point.z);
   if(routeDisplayOpacity(pixels,threshold,overview,important)>.05)hits.push(hit);
  }
 };
}

/** Skip draw submission when even the nearest point of the bounding sphere
 * has zero shader opacity. Retained geometry becomes visible immediately on
 * zoom-in; no worker round trip is needed. The shader still owns the fade. */
export function routeDisplayVisible(mesh:THREE.Mesh,camera:THREE.Camera,height:number){
 const policy=mesh.userData.routeDisplay as {width:number;threshold:number;overview:boolean;important:boolean}|undefined;
 if(!policy)return true;
 if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();
 const sphere=mesh.geometry.boundingSphere;if(!sphere)return true;
 const center=visibilityCenter.copy(sphere.center).applyMatrix4(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse),radius=sphere.radius*mesh.matrixWorld.getMaxScaleOnAxis();
 const scale=policy.width*camera.projectionMatrix.elements[5]!*height*.5,nearest=Math.max(1e-6,-center.z-radius),farthest=Math.max(1e-6,-center.z+radius);
 if(!policy.important&&scale/nearest<=policy.threshold*.5)return false;
 return !policy.overview||scale/farthest<1.75;
}

/** Conservative preflight for ordinary ground ribbons, before allocating their
 * geometry. The whole loaded terrain bounds every clipped segment. Planned
 * routes retain their bridges, tunnel portals and conflict indicators eagerly. */
export function routeMayDraw(r:LandscapeRecord,camera:THREE.Camera,height:number,box:LandscapeBox,
 origin:{x:number;y:number},heightRange:number,exaggeration:number){
 if(r.route)return true;
 const m=camera.matrixWorldInverse.elements,pad=r.width*8,
  x0=box.x-pad-origin.x,x1=x0+box.width+pad*2,
  y0=origin.y-box.y-box.height-pad,y1=y0+box.height+pad*2,
  z=heightRange*Math.abs(exaggeration)+.025;
 // Eye depth is affine; its minimum over this box occurs at a corner. The
 // padding covers clipped endpoints, wide styles and the ribbon's miters.
 const nearest=-m[14]!-Math.max(m[2]!*x0,m[2]!*x1)-Math.max(m[6]!*y0,m[6]!*y1)-Math.abs(m[10]!)*z;
 const pixels=r.width*camera.projectionMatrix.elements[5]!*height*.5/Math.max(1e-6,nearest);
 return pixels>mapLineThreshold(r.kind==='river'?'river':'road',r.style==='path'||r.style==='stream')*.5;
}

/** A simplified cartographic centreline at small scales. Tunnel gaps and bridge
 * elevations are preserved. Detailed dash/rail/worn styles remain in the ribbon. */
export function routeOverview(r:LandscapeRecord,height:(p:Point)=>number,origin:{x:number;y:number;z:number},exaggeration:number,step:number,important=false,box?:LandscapeBox,layout?:import('./terrain-grid-layout').TerrainRouteLayout){
 const points=linePoints(r),positions:number[]=[],nodes=r.route?.nodes;
 for(let i=1;i<points.length;i++){
  const a=points[i-1]!,b=points[i]!;
  for(const {range,step:spacing} of routeSampleSections(a,b,box,step,layout)){
    const length=Math.hypot(b.x-a.x,b.y-a.y),count=Math.max(1,Math.ceil(length*(range[1]-range[0])/Math.max(.1,spacing)));
    if(!length||count>10000)continue;
    for(let j=0;j<count;j++){
     const at=(f:number)=>{const t=range[0]+(range[1]-range[0])*f;return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};};
     const middle=nodes?.length?nearestRoute(nodes,at((j+.5)/count)):undefined;
     if(middle?.structure==='tunnel'&&!r.route?.conflict)continue;
     for(const t of [j/count,(j+1)/count]){
      const p=at(t),profile=nodes?.length?nearestRoute(nodes,p):undefined,
       z=profile&&!r.route?.conflict&&(r.kind==='river'||profile.structure==='bridge')?profile.z:height(p);
      positions.push(p.x-origin.x,origin.y-p.y,(z-origin.z)*exaggeration+.025);
     }
    }
 }
 }
 if(!positions.length)return;
 const geometry=new LineSegmentsGeometry();geometry.setPositions(positions);
 const material=new LineMaterial({color:r.route?.conflict?'#bf503d':important?'#dc9a2d':r.line?.color??(r.kind==='river'?'#629ebc':'#a37e51'),linewidth:MAP_LINE_MIN_PIXELS,worldUnits:false,depthTest:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 const mesh=new LineSegments2(geometry,material);mesh.userData.landscapeId=r.id;mesh.userData.routeOverview=true;
 routeDisplayMaterial(mesh,r,true,important);return mesh;
}
