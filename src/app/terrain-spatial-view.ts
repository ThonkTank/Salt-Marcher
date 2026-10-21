import {TerrainObjectLayer} from './terrain-object-view';
import {bounds} from './atlas-landscape';
import {terrainBoxesOverlap} from './terrain-cache';
import {updateTerrainMesh} from './terrain-surface-mesh';
import {TerrainDetailMaterial} from './terrain-detail-material';
import {sameTerrainIdentity,type TerrainFrameIdentity} from './terrain-frame';
import type {LandscapeRecord} from './atlas-landscape';
import {AtlasSpatialVegetation} from './atlas-spatial-vegetation';
import {ATLAS_CAMERA_FOV,atlasCameraEye,atlasPlanePoint} from './atlas-camera';
import type {LandscapeBox} from './atlas-landscape';
import {routeMeshes} from './terrain-route-view';
import * as THREE from 'three';
import {gridHeight,projectTerrain,terrainVisible,type TerrainGrid} from './terrain-spatial-model';
import type {SpatialReply} from './terrain-spatial-worker';
import type {Point} from './contracts';
import {AtlasSpatialScene} from './atlas-spatial-scene';
import type {AtlasCanvasScene,PaintHit} from './atlas-canvas-scene';
import {terrainContourUniforms} from './terrain-contours';
import {terrainGridLayout,terrainGridRect} from './terrain-grid-layout';
import {terrainRaycast} from './terrain-ray';

/** Derived GPU surface only. Every position is relative to the shared camera centre. */
export class TerrainSpatialView {
  readonly renderer:THREE.WebGLRenderer;
  readonly camera=new THREE.PerspectiveCamera(ATLAS_CAMERA_FOV);
  readonly scene=new THREE.Scene();
  private mesh:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>|null=null;
  private picker:THREE.Mesh|null=null;
  private frozenPick:{camera:THREE.PerspectiveCamera;origin:Point}|null=null;
  freezePicking(active:boolean){this.frozenPick=active?{camera:this.camera.clone(),origin:{...this.origin}}:null;}
  private grid:TerrainGrid|null=null;
  private identity:TerrainFrameIdentity|undefined;
  private detail=new TerrainDetailMaterial();
  private base:TerrainGrid|null=null;
  private cursor:THREE.Line|null=null;
  private selection:THREE.Line|null=null;
  private routes:THREE.Mesh[]=[];
  private routeState=new Map<string,{key:string;meshes:THREE.Mesh[]}>();
  private cursorState:{point:Point;radius:number}|null=null;
  private origin={x:0,y:0};
  private renderWidth=0;private renderHeight=0;private heightRange=0;
  private contours=terrainContourUniforms();
  private atlas:AtlasSpatialScene|null=null;
  private overlayScene:AtlasSpatialScene|null=null;
  private publication:{scene:AtlasCanvasScene;origin:Point;images:ReadonlyMap<string,CanvasImageSource>}|null=null;
  private routeIds=new Set<string>();
  private objectLayer:TerrainObjectLayer|null=null;
  private vegetation:AtlasSpatialVegetation|null=null;
  private vegetationRecords:LandscapeRecord[]|null=null;
  setVegetation(records:LandscapeRecord[]){
    if(this.vegetationRecords===records)return;this.vegetationRecords=records;
    if(this.grid){this.rebuildVegetation(records);this.render();}
  }
  private rebuildVegetation(records:LandscapeRecord[]){
    if(this.vegetation){this.scene.remove(this.vegetation.group);this.vegetation.dispose();}
    this.vegetation=new AtlasSpatialVegetation(records,this.surface(),this.grid!.view.frame.width/Math.max(1,this.canvas.clientWidth));this.scene.add(this.vegetation.group);
  }
  private surface(){
    const g=this.grid!;
    return {origin:this.origin,focusM:g.view.focusM,exaggeration:g.view.exaggeration,height:(p:Point)=>gridHeight(g,p),segment:terrainGridLayout(g.view).minimumStep,routeIds:this.routeIds,closedObjectIds:this.objectLayer?.closedIds,objectHeights:this.objectLayer?.heights,scopeBases:this.objectLayer?.scopeBases};
  }
  publish(scene:AtlasCanvasScene,origin:Point,images:ReadonlyMap<string,CanvasImageSource>){
    if(this.publication?.scene===scene)return;
    this.publication={scene,origin:{...origin},images};this.rebuildAtlas();this.render();
  }
  private rebuildAtlas(){
    if(!this.publication||!this.grid)return;
    const p=this.publication,next=new AtlasSpatialScene(p.scene,p.origin,p.images,this.surface());
    if(this.atlas){this.scene.remove(this.atlas.group);this.atlas.dispose();}
    this.atlas=next;this.scene.add(next.group);
  }
  overlay(scene:AtlasCanvasScene,origin:Point){
    if(!this.grid)return;
    const next=new AtlasSpatialScene(scene,origin,new Map(),this.surface());
    next.group.renderOrder=100000;
    if(this.overlayScene){this.scene.remove(this.overlayScene.group);this.overlayScene.dispose();}
    this.overlayScene=next;this.scene.add(next.group);this.render();
  }
  hitAt(clientX:number,clientY:number,keys:string[]):PaintHit|null{
    const ray=this.ray(clientX,clientY),terrainDistance=this.picker?ray.intersectObject(this.picker)[0]?.distance:undefined;
    const overlay=this.overlayScene?.hit(ray,keys,terrainDistance);if(overlay)return overlay;
    const foreground=Math.min(terrainDistance??Infinity,ray.intersectObjects(this.routes,false)[0]?.distance??Infinity);
    const object=this.objectLayer?.hit(ray,keys,foreground);if(object)return object;
    const plant=this.vegetation?.hit(ray,keys,terrainDistance);if(plant)return plant;
    if(keys.includes('landscapeId')){
      const route=ray.intersectObjects(this.routes,false).find(h=>terrainDistance===undefined||h.distance<=terrainDistance+.2);
      if(route)return {data:{landscapeId:route.object.userData.landscapeId}};
    }
    return this.atlas?.hit(ray,keys,terrainDistance)??null;
  }
  private ray(clientX:number,clientY:number){
    const r=this.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,1-(clientY-r.top)/r.height*2),this.camera);return ray;
  }
  constructor(readonly canvas:HTMLCanvasElement,pixelRatio=Math.min(1.5,window.devicePixelRatio)){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(pixelRatio);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor('#7fa8bd');
    this.scene.add(new THREE.HemisphereLight('#fff7df','#686e53',2.4));const sun=new THREE.DirectionalLight('#fff7de',2.1);sun.position.set(-.6,.8,1.4);this.scene.add(sun);
  }
  /** Colour progress must not rebuild terrain picking, routes or building meshes. */
  setDetail(detail:import('./terrain-detail').TerrainDetail,rects?:import('./terrain-frame').TerrainRect[]){
    if(!this.mesh||!this.grid)return;
    this.detail??=new TerrainDetailMaterial(this.renderer);this.detail.update(this.mesh.material,{grid:this.grid,detail},rects);this.render();
  }
  setData(data:SpatialReply){
    this.removeLine(this.cursor);this.cursor=null;
    const previous=this.grid,oldOrigin=this.origin;
    const g=this.frozenPick&&this.base?{...data.grid,view:{...data.grid.view,focusM:this.base.view.focusM}}:data.grid,v=g.view;
    this.grid=g;this.heightRange=g.heights.reduce((n,z)=>Math.max(n,Math.abs(z-v.focusM)),1);this.origin={x:v.frame.x+v.frame.width/2,y:v.frame.y+v.frame.height/2};
    this.contours??=terrainContourUniforms();
    const partial=data.update&&sameTerrainIdentity(this.identity,data.update.base)?data.update:undefined;
    const next=updateTerrainMesh(this.mesh,{...data,grid:g},previous,oldOrigin,this.origin,partial,this.contours,this.renderer);
    if(this.mesh!==next.mesh){
      if(this.mesh){this.scene.remove(this.mesh);this.mesh.geometry.dispose();this.mesh.material.map?.dispose();this.mesh.material.dispose();}
      this.mesh=next.mesh;this.scene.add(this.mesh);
    }
    this.detail??=new TerrainDetailMaterial(this.renderer);this.detail.update(this.mesh.material,{...data,grid:g},partial?.detail);
    const geometry=this.mesh.geometry;
    if(!data.draft&&!this.frozenPick){
      this.base=g;if(this.picker){this.picker.geometry.dispose();(this.picker.material as THREE.Material).dispose();}
      this.picker=new THREE.Mesh(geometry.clone(),new THREE.MeshBasicMaterial({side:THREE.FrontSide}));this.picker.updateMatrixWorld(true);
      const origin={...this.origin},picker=this.picker;
      picker.raycast=(raycaster,hits)=>{
        const r=raycaster.ray,distance=terrainRaycast(g,{x:r.origin.x+origin.x,y:origin.y-r.origin.y,z:g.view.focusM+r.origin.z/g.view.exaggeration},{x:r.direction.x,y:-r.direction.y,z:r.direction.z/g.view.exaggeration},raycaster.near,raycaster.far);
        if(distance!==null)hits.push({distance,point:r.at(distance,new THREE.Vector3()),object:picker});
      };
    }
    this.identity=data.identity;
    this.routeState??=new Map();this.routeIds=new Set((data.routes??[]).map(r=>r.id));
    const dispose=(meshes:THREE.Mesh[])=>{for(const mesh of meshes){this.scene.remove(mesh);mesh.geometry.dispose();for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])m.dispose();}};
    const step=terrainGridLayout(v).minimumStep,changed=next.rects.map(r=>terrainGridRect(v,r,1));
    const transform=JSON.stringify([this.origin,v.focusM,v.exaggeration,v.box,step]);
    for(const [id,state]of this.routeState)if(!this.routeIds.has(id)){dispose(state.meshes);this.routeState.delete(id);}
    for(const r of data.routes??[]){
      const key=JSON.stringify([r,transform,data.protectedLimit]),old=this.routeState.get(r.id);
      if(old?.key===key&&!changed.some(box=>terrainBoxesOverlap(box,bounds(r))))continue;
      if(old)dispose(old.meshes);
      const meshes=routeMeshes(r,p=>gridHeight(g,p),{...this.origin,z:v.focusM},v.exaggeration,step/2,data.protectedLimit!==undefined&&!!r.route?.protected,v.box);
      for(const mesh of meshes)this.scene.add(mesh);this.routeState.set(r.id,{key,meshes});
    }
    this.routes=[...this.routeState.values()].flatMap(s=>s.meshes);
    if(!this.objectLayer){this.objectLayer=new TerrainObjectLayer();this.scene.add(this.objectLayer.group);}
    const objectsChanged=this.objectLayer.update(data.objects??[],{...this.origin,z:v.focusM},v.exaggeration);
    if(objectsChanged&&!next.rects.length)this.rebuildAtlas();
    if(next.rects.length){this.rebuildVegetation(this.vegetationRecords??data.vegetation??[]);this.rebuildAtlas();}
    if(this.cursorState)this.cursor=this.ring(this.cursorState.point,this.cursorState.radius,'#a65f30');
    this.render();
  }

  private clearRoutes(){for(const mesh of this.routes){this.scene.remove(mesh);mesh.geometry.dispose();for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material.dispose();}this.routes=[];this.routeState?.clear();}
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
  private outputTile:{width:number;height:number;x:number;y:number;w:number;h:number}|null=null;
  /** Perspective sub-frusta retain the exact main-camera pose across bounded GPU tiles. */
  renderTile(width:number,height:number,x:number,y:number,w:number,h:number){
    this.outputTile={width,height,x,y,w,h};try{this.render();}finally{this.outputTile=null;this.camera.clearViewOffset();}
  }
  render(){
    if(!this.grid)return;const v=this.grid.view,w=this.outputTile?.w??Math.max(1,this.canvas.clientWidth),h=this.outputTile?.h??Math.max(1,this.canvas.clientHeight);if(w!==this.renderWidth||h!==this.renderHeight){this.renderer.setSize(w,h,false);this.renderWidth=w;this.renderHeight=h;}
    this.contours.terrainContourPixelRatio.value=this.renderer.getPixelRatio();
    this.camera.aspect=v.frame.width/v.frame.height;
    const eye=atlasCameraEye(v),target=new THREE.Vector3(v.frame.x+v.frame.width/2-this.origin.x,this.origin.y-v.frame.y-v.frame.height/2,0);
    const distance=Math.hypot(eye.x,eye.y,eye.z),extent=Math.max(v.box.width,v.box.height,this.heightRange*v.exaggeration);
    this.camera.near=Math.max(1e-6,distance*1e-6);this.camera.far=Math.max(distance*8,extent*3);this.camera.up.set(0,0,1);
    this.camera.position.copy(target).add(new THREE.Vector3(eye.x,-eye.y,eye.z));
    if(v.tilt===0){const a=v.rotation*Math.PI/180;this.camera.up.set(-Math.sin(a),Math.cos(a),0);}
    this.camera.lookAt(target);
    if(this.outputTile){const t=this.outputTile;this.camera.setViewOffset(t.width,t.height,t.x,t.y,t.w,t.h);}
    this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);this.renderer.render(this.scene,this.camera);
  }
  hit(clientX:number,clientY:number,includeRoutes=false,includeObjects=false):Point|null{
    if(!this.picker)return null;const r=this.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,1-(clientY-r.top)/r.height*2),(this.frozenPick?.camera??this.camera));
    const hit=ray.intersectObjects([this.picker,...(includeRoutes?this.routes:[]),...(includeObjects&&!this.frozenPick?this.objectLayer?.meshes??[]:[])],false)[0];if(!hit||!this.base)return null;const origin=this.frozenPick?.origin??this.origin,point={x:hit.point.x+origin.x,y:origin.y-hit.point.y};return hit.object!==this.picker||terrainVisible(this.base,point)?point:null;
  }
  project(p:Point){return this.grid?projectTerrain(this.grid.view,p,gridHeight(this.grid,p)):null;}
  private removeLine(line:THREE.Line|null){if(line){this.scene.remove(line);line.geometry.dispose();(line.material as THREE.Material).dispose();}}
  private ring(p:Point|null,radius:number,color:string){
    if(!p||!this.grid||radius<=0)return null;const g=this.grid,positions:number[]=[];
    for(let i=0;i<=64;i++){const a=i*Math.PI/32,q={x:p.x+Math.cos(a)*radius,y:p.y+Math.sin(a)*radius};positions.push(q.x-this.origin.x,this.origin.y-q.y,(gridHeight(g,q)-g.view.focusM)*g.view.exaggeration+g.view.frame.width*.00015);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,depthTest:true}));this.scene.add(line);return line;
  }
  showCursor(p:Point|null,radius:number){this.cursorState=p?{point:{...p},radius}:null;this.removeLine(this.cursor);this.cursor=this.ring(p,radius,'#a65f30');this.render();}
  showSelection(p:Point|null){this.removeLine(this.selection);this.selection=this.ring(p,(this.grid?.view.frame.width??0)*.008,'#e68a28');this.render();}
  dispose(){
    this.detail?.dispose();this.frozenPick=null;
    this.atlas?.dispose();this.overlayScene?.dispose();this.atlas=null;this.overlayScene=null;this.publication=null;
    this.objectLayer?.dispose();this.objectLayer=null;this.clearRoutes();this.vegetation?.dispose();this.vegetation=null;this.vegetationRecords=null;
    this.removeLine(this.cursor);this.removeLine(this.selection);this.cursor=null;this.selection=null;if(this.mesh){this.mesh.geometry.dispose();this.mesh.material.map?.dispose();this.mesh.material.dispose();}if(this.picker){this.picker.geometry.dispose();(this.picker.material as THREE.Material).dispose();}
    this.renderer.dispose();this.renderer.forceContextLoss();this.mesh=null;this.picker=null;this.grid=null;this.base=null;
  }
}
