import {ATLAS_CAMERA_FOV,atlasCameraEye,atlasPlanePoint} from './atlas-camera';
import type {LandscapeBox} from './atlas-landscape';
import {routeMeshes} from './terrain-route-view';
import * as THREE from 'three';
import {gridHeight,projectTerrain,terrainVisible,type TerrainGrid} from './terrain-spatial-model';
import type {SpatialReply} from './terrain-spatial-worker';
import type {Point} from './contracts';
import {terrainContourMaterial,terrainContourUniforms} from './terrain-contours';

/** Derived GPU surface only. Every position is relative to the shared camera centre. */
export class TerrainSpatialView {
  readonly renderer:THREE.WebGLRenderer;
  readonly camera=new THREE.PerspectiveCamera(ATLAS_CAMERA_FOV);
  readonly scene=new THREE.Scene();
  private mesh:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>|null=null;
  private picker:THREE.Mesh|null=null;
  private grid:TerrainGrid|null=null;
  private base:TerrainGrid|null=null;
  private cursor:THREE.Line|null=null;
  private selection:THREE.Line|null=null;
  private routes:THREE.Mesh[]=[];
  private origin={x:0,y:0};
  private renderWidth=0;private renderHeight=0;private heightRange=0;
  private contours=terrainContourUniforms();
  constructor(readonly canvas:HTMLCanvasElement){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(1.5,window.devicePixelRatio));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor('#7fa8bd');
  }
  setData(data:SpatialReply){
    this.removeLine(this.cursor);this.cursor=null;
    const {grid:g}=data,v=g.view,b=v.box;this.grid=g;this.heightRange=g.heights.reduce((n,z)=>Math.max(n,Math.abs(z-v.focusM)),1);this.origin={x:v.frame.x+v.frame.width/2,y:v.frame.y+v.frame.height/2};
    const positions=new Float32Array(v.columns*v.rows*3),uv=new Float32Array(v.columns*v.rows*2),indices:number[]=[];
    for(let y=0;y<v.rows;y++)for(let x=0;x<v.columns;x++){
      const i=y*v.columns+x;positions.set([b.x+x*b.width/(v.columns-1)-this.origin.x,this.origin.y-b.y-y*b.height/(v.rows-1),(g.heights[i]!-v.focusM)*v.exaggeration],i*3);uv.set([x/(v.columns-1),y/(v.rows-1)],i*2);
      if(x<v.columns-1&&y<v.rows-1)indices.push(i,i+v.columns,i+1,i+1,i+v.columns,i+v.columns+1);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeBoundingSphere();
    const texture=new THREE.DataTexture(data.pixels,data.width,data.height,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
    if(this.mesh){this.scene.remove(this.mesh);this.mesh.geometry.dispose();this.mesh.material.map?.dispose();this.mesh.material.dispose();}
    geometry.setAttribute('terrainElevation',new THREE.BufferAttribute(g.heights,1));
    this.contours??=terrainContourUniforms();
    this.contours.terrainContourSea.value=g.seaLevelM;
    this.contours.terrainContourInk.value.set(data.contourInk??'#685639');
    const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.FrontSide});terrainContourMaterial(material,this.contours);
    this.mesh=new THREE.Mesh(geometry,material);this.scene.add(this.mesh);
    if(!data.draft){this.base=g;if(this.picker){this.picker.geometry.dispose();(this.picker.material as THREE.Material).dispose();}this.picker=new THREE.Mesh(geometry.clone(),new THREE.MeshBasicMaterial({side:THREE.FrontSide}));this.picker.updateMatrixWorld(true);}
    this.clearRoutes();
    for(const r of data.routes??[])for(const mesh of routeMeshes(r,p=>gridHeight(g,p),{...this.origin,z:v.focusM},v.exaggeration,Math.min(b.width/(v.columns-1),b.height/(v.rows-1))/2,data.protectedLimit!==undefined&&!!r.route?.protected)){
      this.routes.push(mesh);this.scene.add(mesh);
    }
    this.render();
  }
  private clearRoutes(){for(const mesh of this.routes){this.scene.remove(mesh);mesh.geometry.dispose();for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material.dispose();}this.routes=[];}
  setContours(interval:number){
    if(this.contours.terrainContourInterval.value===interval)return;
    this.contours.terrainContourInterval.value=interval;this.render();
  }
  /** Retain GPU geometry and textures while the camera moves or details load. */
  reframe(frame:LandscapeBox,tilt:number,rotation:number){
    const old=this.grid?.view;
    if(old&&old.frame.x===frame.x&&old.frame.y===frame.y&&old.frame.width===frame.width&&old.frame.height===frame.height&&old.tilt===tilt&&old.rotation===rotation)return;
    for(const grid of new Set([this.grid,this.base]))if(grid)grid.view={...grid.view,frame:{...frame},tilt,rotation,projection:'perspective'};
    this.render();
  }
  planePoint(clientX:number,clientY:number){
    if(!this.grid)return null;const r=this.canvas.getBoundingClientRect();
    return atlasPlanePoint(this.grid.view,{x:(clientX-r.left)/r.width,y:(clientY-r.top)/r.height});
  }
  render(){
    if(!this.grid)return;const v=this.grid.view,w=Math.max(1,this.canvas.clientWidth),h=Math.max(1,this.canvas.clientHeight);if(w!==this.renderWidth||h!==this.renderHeight){this.renderer.setSize(w,h,false);this.renderWidth=w;this.renderHeight=h;}
    this.camera.aspect=v.frame.width/v.frame.height;
    const eye=atlasCameraEye(v),target=new THREE.Vector3(v.frame.x+v.frame.width/2-this.origin.x,this.origin.y-v.frame.y-v.frame.height/2,0);
    const distance=Math.hypot(eye.x,eye.y,eye.z),extent=Math.max(v.box.width,v.box.height,this.heightRange*v.exaggeration);
    this.camera.near=Math.max(1e-6,distance*1e-6);this.camera.far=Math.max(distance*8,extent*3);this.camera.up.set(0,0,1);
    this.camera.position.copy(target).add(new THREE.Vector3(eye.x,-eye.y,eye.z));
    if(v.tilt===0){const a=v.rotation*Math.PI/180;this.camera.up.set(-Math.sin(a),Math.cos(a),0);}
    this.camera.lookAt(target);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);this.renderer.render(this.scene,this.camera);
  }
  hit(clientX:number,clientY:number,includeRoutes=false):Point|null{
    if(!this.picker)return null;const r=this.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,1-(clientY-r.top)/r.height*2),this.camera);
    const hit=ray.intersectObjects(includeRoutes?[this.picker,...this.routes]:[this.picker],false)[0];if(!hit||!this.base)return null;const point={x:hit.point.x+this.origin.x,y:this.origin.y-hit.point.y};return hit.object!==this.picker||terrainVisible(this.base,point)?point:null;
  }
  project(p:Point){return this.base?projectTerrain(this.base.view,p,gridHeight(this.base,p)):null;}
  private removeLine(line:THREE.Line|null){if(line){this.scene.remove(line);line.geometry.dispose();(line.material as THREE.Material).dispose();}}
  private ring(p:Point|null,radius:number,color:string){
    if(!p||!this.grid||radius<=0)return null;const g=this.grid,positions:number[]=[];
    for(let i=0;i<=64;i++){const a=i*Math.PI/32,q={x:p.x+Math.cos(a)*radius,y:p.y+Math.sin(a)*radius};positions.push(q.x-this.origin.x,this.origin.y-q.y,(gridHeight(g,q)-g.view.focusM)*g.view.exaggeration+g.view.frame.width*.00015);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,depthTest:true}));this.scene.add(line);return line;
  }
  showCursor(p:Point|null,radius:number){this.removeLine(this.cursor);this.cursor=this.ring(p,radius,'#a65f30');this.render();}
  showSelection(p:Point|null){this.removeLine(this.selection);this.selection=this.ring(p,(this.grid?.view.frame.width??0)*.008,'#e68a28');this.render();}
  dispose(){
    this.clearRoutes();
    this.removeLine(this.cursor);this.removeLine(this.selection);this.cursor=null;this.selection=null;if(this.mesh){this.mesh.geometry.dispose();this.mesh.material.map?.dispose();this.mesh.material.dispose();}if(this.picker){this.picker.geometry.dispose();(this.picker.material as THREE.Material).dispose();}
    this.renderer.dispose();this.renderer.forceContextLoss();this.mesh=null;this.picker=null;this.grid=null;this.base=null;
  }
}
