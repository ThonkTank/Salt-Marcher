import {BrushSizeControl,brushSizeControl} from './atlas-brush-size';
import {routeMeshes} from './terrain-route-view';
import * as THREE from 'three';
import type {Point,Polygon} from './contracts';
import {emptyRecord,contains,type LandscapeBox,type LandscapeAction} from './atlas-landscape';
import {vegetationSpec,type VegetationScene,type VegetationInstance,type PlantAsset} from './vegetation';
import {vegetationColors} from './vegetation-view';
import {vegetationControls} from './vegetation-controls';
import {brushFootprint} from './landscape-brush';
import type {SpatialTerrainDraft} from './spatial-terrain';
import type {LandscapeToolSettings} from './landscape-tool-settings';
import {atlasFieldValue} from './atlas-units';

/** Small terrain-bound renderer shared by the prototype and product view.
 * All GPU objects are disposable derived data. Z remains measured in metres. */
export class VegetationSpatialView {
  readonly renderer:THREE.WebGLRenderer;
  readonly camera=new THREE.OrthographicCamera();
  readonly scene=new THREE.Scene();
  private terrain:THREE.Mesh|undefined;
  private data:VegetationScene|undefined;
  private viewport:LandscapeBox|undefined;
  private preview:THREE.Line|undefined;
  private origin={x:0,y:0,z:0};
  private texture:THREE.DataTexture|undefined;
  private cameraHeight:number|undefined;
  exaggeration=1;selectedArea:string|undefined;
  private groups:THREE.Object3D[]=[];
  private pickers:THREE.InstancedMesh[]=[];
  private recordPickers:THREE.Mesh[]=[];
  tilt=45;rotation=0;
  constructor(readonly canvas:HTMLCanvasElement){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(2,window.devicePixelRatio));
    this.scene.background=new THREE.Color('#e7e2d2');
    this.scene.add(new THREE.HemisphereLight('#fff7df','#686e53',2.4));
    const sun=new THREE.DirectionalLight('#fff7de',2.1);sun.position.set(-.6,.8,1.4);this.scene.add(sun);
  }
  private release(){
    for(const g of this.groups){g.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});this.scene.remove(g);}
    this.groups=[];this.pickers=[];this.recordPickers=[];this.showDraft([]);this.texture?.dispose();this.texture=undefined;
  }
  private add(g:THREE.Object3D){this.groups.push(g);this.scene.add(g);}
  private height(p:Point){
    const d=this.data!,{columns,rows,heights}=d.grid,
      x=Math.max(0,Math.min(columns-1,(p.x-d.box.x)/d.box.width*(columns-1))),y=Math.max(0,Math.min(rows-1,(p.y-d.box.y)/d.box.height*(rows-1))),
      a=Math.floor(x),b=Math.floor(y),xx=Math.min(columns-1,a+1),yy=Math.min(rows-1,b+1),tx=x-a,ty=y-b;
    return tx+ty<=1?heights[b*columns+a]!*(1-tx-ty)+heights[b*columns+xx]!*tx+heights[yy*columns+a]!*ty:heights[yy*columns+xx]!*(tx+ty-1)+heights[b*columns+xx]!*(1-ty)+heights[yy*columns+a]!*(1-tx);
  }
  setData(data:VegetationScene){
    this.release();this.data=data;this.viewport=data.box;this.origin={x:data.box.x+data.box.width/2,y:data.box.y+data.box.height/2,z:data.grid.heights[Math.floor(data.grid.rows/2)*data.grid.columns+Math.floor(data.grid.columns/2)]!};
    const {columns,rows,heights,colors}=data.grid,position:number[]=[],color:number[]=[],uv:number[]=[],indices:number[]=[];
    for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
      const i=y*columns+x,c=new THREE.Color(colors[i]!);
      position.push(data.box.x+x/(columns-1)*data.box.width-this.origin.x,this.origin.y-data.box.y-y/(rows-1)*data.box.height,(heights[i]!-this.origin.z)*this.exaggeration);
      color.push(c.r,c.g,c.b);uv.push(x/(columns-1),y/(rows-1));
      if(x<columns-1&&y<rows-1)indices.push(i,i+columns,i+1,i+1,i+columns,i+columns+1);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(position,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(color,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    if(data.texture){this.texture=new THREE.DataTexture(new Uint8Array(data.texture.pixels),data.texture.width,data.texture.height,THREE.RGBAFormat);this.texture.colorSpace=THREE.SRGBColorSpace;this.texture.magFilter=THREE.LinearFilter;this.texture.minFilter=THREE.LinearFilter;this.texture.needsUpdate=true;}
    this.terrain=new THREE.Mesh(geometry,this.texture?new THREE.MeshBasicMaterial({map:this.texture,side:THREE.DoubleSide}):new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}));this.add(this.terrain);
    const make=(asset:PlantAsset,part:'crown'|'trunk')=>{
      let g:THREE.BufferGeometry;
      if(part==='trunk'){g=new THREE.CylinderGeometry(.035,.055,.5,5);g.rotateX(Math.PI/2);g.translate(0,0,.25);}
      else if(asset==='pine'){g=new THREE.ConeGeometry(.32,.85,7);g.rotateX(Math.PI/2);g.translate(0,0,.575);}
      else if(asset==='oak'){g=new THREE.IcosahedronGeometry(.36,1);g.scale(1,1,1.15);g.translate(0,0,.65);}
      else if(asset==='rock'){g=new THREE.DodecahedronGeometry(.55,0);g.scale(1,.8,.65);g.translate(0,0,.14);}
      else{g=new THREE.IcosahedronGeometry(.5,0);g.scale(1,1,asset==='grass'?.25:.7);g.translate(0,0,.25);}
      return g;
    };
    const canopyAreas=new Set(data.records.filter(r=>r.vegetationView?.mode==='canopy').map(r=>r.id)),
      canopyWidth=data.box.width/Math.max(1,this.canvas.getBoundingClientRect().width)*8;
    for(const asset of ['oak','pine','rock','shrub','grass'] as const){
      const instances=data.instances.filter(i=>i.asset===asset);if(!instances.length)continue;
      for(const part of asset==='oak'||asset==='pine'?['trunk','crown'] as const:['crown'] as const){
        const mesh=new THREE.InstancedMesh(make(asset,part),new THREE.MeshLambertMaterial({color:part==='trunk'?'#766044':vegetationColors[asset],flatShading:true}),instances.length);
        const obj=new THREE.Object3D(),color=new THREE.Color();
        instances.forEach((i,index)=>{
          obj.position.set(i.x-this.origin.x,this.origin.y-i.y,(i.z-this.origin.z)*this.exaggeration);
          obj.quaternion.identity();
          if(asset==='rock')obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(i.normal.x,-i.normal.y,i.normal.z));
          obj.rotateZ(i.angle);obj.scale.setScalar(i.size);
          const canopy=!i.protected&&canopyAreas.has(i.areaId)&&(asset==='oak'||asset==='pine');
          if(canopy&&part==='crown'){
            // A regional crown represents a group; its anchor is a real tree.
            // Keep vertical height and canonical size intact. Individual-scale
            // meshes and protected landmarks retain their physical dimensions.
            const width=Math.max(i.size,canopyWidth);
            obj.scale.set(width,width,i.size);
          }
          obj.updateMatrix();mesh.setMatrixAt(index,obj.matrix);
          color.set(i.conflict?'#cb7747':i.areaId===this.selectedArea?'#ffe8a2':'#ffffff');mesh.setColorAt(index,color);
        });
        mesh.instanceMatrix.needsUpdate=true;mesh.userData.instances=instances;mesh.computeBoundingSphere();this.add(mesh);this.pickers.push(mesh);
      }
    }
    for(const r of data.records.filter(r=>r.kind==='road'||r.kind==='river')){
      for(const mesh of routeMeshes(r,p=>this.height(p),this.origin,this.exaggeration,Math.min(data.box.width/(columns-1),data.box.height/(rows-1))/2,r.id===this.selectedArea)){
        this.add(mesh);this.recordPickers.push(mesh);
      }
    }
    for(const polygon of data.buildings){
      if(polygon.outer.length<3)continue;
      const shape=new THREE.Shape(polygon.outer.map(p=>new THREE.Vector2(p.x-this.origin.x,this.origin.y-p.y)));
      const g=new THREE.ExtrudeGeometry(shape,{depth:5,bevelEnabled:false});g.translate(0,0,(this.height(polygon.outer[0]!)-this.origin.z)*this.exaggeration);
      this.add(new THREE.Mesh(g,new THREE.MeshLambertMaterial({color:'#c5ad8e'})));
    }
    this.render();
  }
  render(){
    if(!this.data)return;
    const {width,height}=this.canvas.getBoundingClientRect();if(width<1||height<1)return;
    this.renderer.setSize(width,height,false);
    const b=this.viewport??this.data.box,span=Math.max(b.height,b.width/(width/height)),r=span*2,t=this.tilt*Math.PI/180,a=this.rotation*Math.PI/180,center=((this.cameraHeight??this.height({x:b.x+b.width/2,y:b.y+b.height/2}))-this.origin.z)*this.exaggeration,cx=b.x+b.width/2-this.origin.x,cy=this.origin.y-b.y-b.height/2;
    this.camera.left=-span*width/height/2;this.camera.right=-this.camera.left;this.camera.top=span/2;this.camera.bottom=-span/2;
    this.camera.near=Math.max(.01,span*.001);this.camera.far=span*10+100000;
    this.camera.position.set(cx+Math.sin(a)*Math.sin(t)*r,cy-Math.cos(a)*Math.sin(t)*r,center+Math.cos(t)*r);
    this.camera.up.set(-Math.sin(a)*Math.cos(t),Math.cos(a)*Math.cos(t),Math.sin(t));
    this.camera.lookAt(cx,cy,center);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();this.renderer.render(this.scene,this.camera);
  }
  setExaggeration(value:number){if(!Number.isFinite(value)||value<.25||value>8)throw Error('Höhenüberhöhung prüfen.');this.exaggeration=value;if(this.data){const box=this.viewport;this.setData(this.data);if(box)this.setViewport(box);}}
  lockSurfaceCamera(lock:boolean){const b=this.viewport;this.cameraHeight=lock&&b?this.height({x:b.x+b.width/2,y:b.y+b.height/2}):undefined;}
  setViewport(box:LandscapeBox){this.viewport=box;this.render();}
  showDraft(points:Point[],radius=0){
    if(this.preview){this.scene.remove(this.preview);this.preview.geometry.dispose();(this.preview.material as THREE.Material).dispose();this.preview=undefined;}
    if(!this.data||!points.length)return;
    const last=points.at(-1)!,ring=radius?Array.from({length:49},(_,i)=>({x:last.x+Math.cos(i*Math.PI/24)*radius,y:last.y+Math.sin(i*Math.PI/24)*radius})):[];
    const vertices=[...points,...ring].map(p=>new THREE.Vector3(p.x-this.origin.x,this.origin.y-p.y,(this.height(p)-this.origin.z)*this.exaggeration+.3));
    this.preview=new THREE.Line(new THREE.BufferGeometry().setFromPoints(vertices),new THREE.LineBasicMaterial({color:'#c77d32',depthTest:false}));this.preview.renderOrder=10;this.scene.add(this.preview);
  }
  project(p:Point){
    const v=new THREE.Vector3(p.x-this.origin.x,this.origin.y-p.y,(this.height(p)-this.origin.z)*this.exaggeration).project(this.camera),b=this.canvas.getBoundingClientRect();
    return {x:(v.x+1)*b.width/2,y:(1-v.y)*b.height/2};
  }
  hit(x:number,y:number){
    const b=this.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x/b.width*2-1,1-y/b.height*2),this.camera);
    const found=this.terrain?ray.intersectObject(this.terrain)[0]:undefined;
    if(!found)return null;
    return{x:found.point.x+this.origin.x,y:this.origin.y-found.point.y,z:found.point.z/this.exaggeration+this.origin.z};
  }
  pick(x:number,y:number,filter:'all'|'trees'|'rocks'|'undergrowth'='all'){
    const b=this.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x/b.width*2-1,1-y/b.height*2),this.camera);
    // A type filter makes low objects selectable below a canopy. Terrain still
    // occludes objects, so filtering never selects through a hillside.
    const plant=ray.intersectObjects(this.pickers,false).find(hit=>{
      if(hit.instanceId===undefined)return false;
      const i=hit.object.userData.instances[hit.instanceId] as VegetationInstance;
      return filter==='all'||filter==='trees'&&(i.asset==='oak'||i.asset==='pine')||
        filter==='rocks'&&i.asset==='rock'||filter==='undergrowth'&&(i.asset==='shrub'||i.asset==='grass');
    }),ground=this.terrain?ray.intersectObject(this.terrain)[0]:undefined;
    if(!plant||plant.instanceId===undefined||ground&&ground.distance+.1<plant.distance)return undefined;
    return plant.object.userData.instances[plant.instanceId] as VegetationScene['instances'][number];
  }
  pickRecord(x:number,y:number):string|undefined{
    const b=this.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x/b.width*2-1,1-y/b.height*2),this.camera);
    const object=ray.intersectObjects(this.recordPickers,false)[0],ground=this.terrain?ray.intersectObject(this.terrain)[0]:undefined;
    return object&&(!ground||object.distance<=ground.distance+.2)?object.object.userData.landscapeId:undefined;
  }
  dispose(){this.release();this.renderer.dispose();this.renderer.forceContextLoss();}
}

export async function openVegetationSpatial(host:{token:string;box:LandscapeBox;write:(a:LandscapeAction|{kind:'undo'|'redo'})=>Promise<unknown>;error:(e:unknown)=>void;navigate?:(b:LandscapeBox)=>void;select:(area:string,instance?:VegetationInstance)=>Promise<void>;terrain?:{settings:LandscapeToolSettings;radius:HTMLInputElement;tool:string;choose:(tool:string)=>void;selection?:string};viewState?:{tilt:number;rotation:number;exaggeration:number}}) {
  const dialog=document.createElement('dialog');dialog.className='vegetation-dialog';
  dialog.innerHTML='<div class="vegetation-top"><strong>Räumliche Landschaft</strong><button id="vegetation-top-view">Draufsicht</button><button id="vegetation-tilted-view">Kippen</button><button id="vegetation-spatial-undo">Rückgängig</button><button id="vegetation-spatial-redo">Wiederholen</button><button id="vegetation-spatial-export">PNG dieser Ansicht</button><button id="vegetation-spatial-close">Zur Karte</button></div><div class="vegetation-body"><aside><label>Werkzeug<select id="vegetation-spatial-tool"><option value="navigate">Verschieben / Zoomen</option><option value="select">Einzelobjekt auswählen</option><option value="paint">Landschaft malen</option><option value="area">Fläche umgrenzen</option><option value="line">Baumreihe</option><option value="clear">Freihalten</option><option value="thin">Ausdünnen</option><option value="dense">Verdichten</option></select></label><label>Pinselradius in m<input id="vegetation-spatial-radius" type="number" min="1" value="30"></label><label>Neigung<input id="vegetation-spatial-tilt" type="range" min="0" max="65" value="45"></label><label>Drehung<input id="vegetation-spatial-rotation" type="range" min="-180" max="180" value="0"></label><div id="vegetation-spatial-presets"></div><button id="vegetation-spatial-finish">Fläche / Linie abschließen</button><button id="vegetation-spatial-cancel">Entwurf verwerfen</button></aside><canvas id="vegetation-spatial-canvas" tabindex="0" aria-label="Räumliche Landschaft bearbeiten"></canvas></div><p id="vegetation-spatial-status" role="status">Landschaft wird geladen …</p>';
  document.body.append(dialog);dialog.showModal();
  const element=<T extends HTMLElement>(id:string)=>dialog.querySelector<T>('#vegetation-spatial-'+id)!;
  for(const [kind,label]of [['road','Straße planen'],['river','Fluss planen']] as const){
    const button=document.createElement('button');button.textContent=label;button.id='spatial-plan-'+kind;dialog.querySelector('.vegetation-top')!.append(button);
    button.onclick=()=>{if(busy||draftPending()){status.textContent='Zuerst Entwurf abschließen oder verwerfen.';return;}const currentBox={...box};close();void import('./terrain-route-ui').then(m=>m.openTerrainRoute({token:host.token,box:currentBox,kind,write:host.write})).catch(host.error);};
  }
  const canvas=element<HTMLCanvasElement>('canvas');let view:VegetationSpatialView;
  try{view=new VegetationSpatialView(canvas);}catch(e){dialog.close();dialog.remove();throw Error('Räumliche Darstellung nicht verfügbar. Die Draufsicht bleibt nutzbar. '+String(e));}
  let box={...host.box},data:VegetationScene|undefined,busy=false,writing=false,loading=false,reload=false,closed=false,request=0,points:Point[]=[],gesture:{start:Point;box:LandscapeBox;points:Point[];pan:boolean}|undefined,selectedTool='navigate';
  const spec=vegetationSpec(),status=element('status'),tool=element<HTMLSelectElement>('tool');
  const selectionLabel=document.createElement('label');selectionLabel.textContent='Einzelobjekte auswählen';
  const selectionFilter=document.createElement('select');selectionFilter.id='vegetation-spatial-selection-filter';
  for(const [value,label] of [['all','Alle sichtbaren Objekte'],['trees','Bäume'],['rocks','Felsen unter Baumkronen'],['undergrowth','Unterwuchs unter Baumkronen']])
    selectionFilter.add(new Option(label!,value));
  selectionLabel.append(selectionFilter);tool.closest('label')!.after(selectionLabel);
  if(host.viewState){view.tilt=host.viewState.tilt;view.rotation=host.viewState.rotation;view.exaggeration=host.viewState.exaggeration;element<HTMLInputElement>('tilt').value=String(view.tilt);element<HTMLInputElement>('rotation').value=String(view.rotation);}
  view.selectedArea=host.terrain?.selection;
  const exaggeration=document.createElement('label');exaggeration.textContent='Höhenüberhöhung (nur Ansicht)';
  const exaggerationInput=document.createElement('input');exaggerationInput.id='terrain-spatial-exaggeration';exaggerationInput.type='range';exaggerationInput.min='.25';exaggerationInput.max='8';exaggerationInput.step='.25';exaggerationInput.value=String(view.exaggeration);exaggeration.append(exaggerationInput);element('rotation').closest('label')!.after(exaggeration);
  const terrainPanel=document.createElement('fieldset');terrainPanel.id='terrain-spatial-controls';exaggeration.after(terrainPanel);
  const moved:{node:HTMLElement;mark:Comment}[]=[];
  if(host.terrain){
    for(const [id,label]of [['height','Land formen'],['color','Land bemalen'],['smooth','Glätten']])tool.add(new Option(label!,id));
    for(const node of [host.terrain.settings.brushRoot,host.terrain.radius.closest('label')! as HTMLElement]){const mark=document.createComment('spatial-controls');node.before(mark);moved.push({node,mark});terrainPanel.append(node);}
    if(['height','smooth','color'].includes(host.terrain.tool)){tool.value=selectedTool=host.terrain.tool;}
  }
  const terrainTool=()=>!!host.terrain&&['height','smooth','color'].includes(tool.value);
  let terrainDraft:Exclude<SpatialTerrainDraft,{kind:'landscape-route'}>|undefined,draftFence:string|undefined,held=false,started=0,lastTerrainPoint:Point|undefined,previewEpoch=0,previewBusy=false,previewTimer:ReturnType<typeof setTimeout>|undefined;
  const terrainRadius=()=>Number(atlasFieldValue(host.terrain!.radius));
  const syncTools=()=>{selectionLabel.hidden=tool.value!=='select';terrainPanel.hidden=!terrainTool();element('presets').hidden=terrainTool();element('radius').closest('label')!.hidden=terrainTool();if(terrainTool())host.terrain!.choose(tool.value);syncBrushSize();};
  const draftPending=()=>!!terrainDraft||!!gesture||points.length>0;
  const spatialSize=new BrushSizeControl(element<HTMLInputElement>('radius'),()=>view.render());
  const syncBrushSize=()=>{
    const r=canvas.getBoundingClientRect(),scale=Math.max(box.width/Math.max(1,r.width),box.height/Math.max(1,r.height));
    const key=({paint:'vegetation',clear:'vegetation-clear',thin:'vegetation-thin',dense:'vegetation-dense',line:'vegetation-line'} as Record<string,string>)[tool.value]??tool.value;
    spatialSize.sync('land-radius:'+key,scale,draftPending()||writing);
    if(host.terrain)brushSizeControl(host.terrain.radius)?.sync('land-radius:'+tool.value+(tool.value==='color'?':'+document.querySelector<HTMLSelectElement>('#land-color-target')!.value+':'+document.querySelector<HTMLSelectElement>('#land-color-operation')!.value:''),scale,draftPending()||writing);
  };
  for(const type of ['pointerdown','pointermove','pointerup','wheel'])canvas.addEventListener(type,syncBrushSize,true);
  dialog.addEventListener('input',syncBrushSize);dialog.addEventListener('change',syncBrushSize);
  const stopPreview=()=>{previewEpoch++;clearTimeout(previewTimer);previewBusy=false;};
  const clearTerrain=()=>{stopPreview();view.lockSurfaceCamera(false);terrainDraft=undefined;held=false;lastTerrainPoint=undefined;terrainPanel.disabled=false;syncBrushSize();delete canvas.dataset.terrainDraft;};
  const updateTerrain=(world:Point,t:number)=>{
    lastTerrainPoint=world;
    if(terrainDraft?.kind==='landscape-height-stroke'){
      const samples=terrainDraft.stroke.samples;if(samples.length<10000)samples.push({...world,t:Math.min(300000,Math.max(samples.at(-1)!.t,t-started))});
    }else if(terrainDraft&&!terrainDraft.record.paint!.fill){
      const r=terrainDraft.record,last=r.points.at(-1)!;
      if(r.points.length<1000&&Math.hypot(world.x-last.x,world.y-last.y)>r.paint!.radius/8)r.points.push(world);
      r.polygons=brushFootprint(r.points,r.paint!.radius);r.paint!.strokes=[r.points];
    }
  };
  const previewTerrain=async()=>{
    if(!terrainDraft||busy||closed||previewBusy)return;
    if(held&&lastTerrainPoint)updateTerrain(lastTerrainPoint,performance.now());
    const epoch=previewEpoch;previewBusy=true;
    try{const r=await window.campaign.atlasSpatialScene(host.token,box,box.width/Math.max(1,canvas.clientWidth),structuredClone(terrainDraft),draftFence);
      if(epoch!==previewEpoch||closed||!terrainDraft)return;if(!r.ok)throw Error(r.error);
      view.setData(r.value);view.showDraft(lastTerrainPoint?[lastTerrainPoint]:[],terrainRadius());view.render();
      canvas.dataset.terrainDraft='ready';status.textContent='Geländevorschau · Loslassen speichert einen Schritt; Escape verwirft.';
    }catch(e){if(epoch===previewEpoch)status.textContent=String(e);}
    finally{if(epoch===previewEpoch){previewBusy=false;if(held)previewTimer=setTimeout(()=>void previewTerrain(),150);}}
  };
  syncTools();
  vegetationControls(element('presets'),'spatial-vegetation',spec,()=>{});
  const load=async():Promise<void>=>{
    // Keep at most one read in flight and one latest camera request. Gestures
    // remain immediate; obsolete responses must never snap the camera back.
    if(loading){reload=true;return;}
    const generation=++request,queryBox={...box};loading=true;reload=false;busy=true;canvas.setAttribute('aria-busy','true');status.textContent='Ausschnitt wird geladen…';
    try{const r=await (host.terrain?window.campaign.atlasSpatialScene(host.token,queryBox,queryBox.width/Math.max(1,canvas.clientWidth)):window.campaign.atlasVegetationScene(host.token,queryBox,queryBox.width/Math.max(1,canvas.clientWidth)));if(closed||generation!==request||reload)return;
      if(!r.ok)throw Error(r.error);data=r.value;view.setData(data);status.textContent=`${data.instances.length} sichtbare Bestandsobjekte · ${Math.round(box.width)} m Ausschnitt · Änderungen werden im Atlas gespeichert.`;}
    catch(e){data=undefined;if(!closed){status.textContent=String(e);host.error(e);}}
    finally{loading=false;if(!closed&&generation===request){if(reload&&!gesture?.pan)void load();else{busy=false;syncBrushSize();canvas.setAttribute('aria-busy','false');}}}
  };
  const write=async(a:LandscapeAction|{kind:'undo'|'redo'})=>{
    if(busy)return;busy=true;writing=true;canvas.setAttribute('aria-busy','true');let failed=false,error:unknown;
    try{if(terrainDraft){const current=await window.campaign.atlasSpatialScene(host.token,box,box.width/Math.max(1,canvas.clientWidth),undefined,draftFence);if(!current.ok)throw Error(current.error);}const result=await host.write(a);if(!result)throw Error('Änderung nicht bestätigt.');points=[];clearTerrain();}
    catch(e){failed=true;error=e;host.error(e);}
    finally{writing=false;busy=false;syncBrushSize();await load();if(failed&&!closed){status.textContent=String(error)+(draftPending()?' Entwurf bleibt erhalten; erneut abschließen oder verwerfen.':'');view.showDraft(points);view.render();}}
  };
  const commit=async(samples:Point[],mode:string)=>{
    if(busy)return;
    const radius=Number(atlasFieldValue(element<HTMLInputElement>('radius')));if(!Number.isFinite(radius)||radius<=0){status.textContent='Positiven Pinselradius wählen.';return;}
    if(!samples.length){status.textContent='Zuerst auf der Landschaft zeichnen.';return;}
    points=[...samples];let polygons:Polygon[];
    if(mode==='area'){if(samples.length<3){status.textContent='Mindestens drei Eckpunkte setzen.';return;}polygons=[{outer:samples,holes:[]}];}
    else{if(mode==='line'&&samples.length<2){status.textContent='Mindestens zwei Linienpunkte setzen.';return;}polygons=brushFootprint(samples,radius);}
    if(['clear','thin','dense'].includes(mode))return write({kind:'landscape-vegetation-edit',polygons,mode:mode as 'clear'|'thin'|'dense'});
    const r=emptyRecord('vegetation');r.name=spec.preset.name;r.points=samples;r.polygons=polygons;r.width=radius*2;r.resolution=Math.max(1,radius/10);r.vegetation=structuredClone(spec);r.vegetation.seed=crypto.getRandomValues(new Uint32Array(1))[0]!;r.vegetation.layout=mode==='line'?'row':'natural';r.values={terrain:spec.preset.terrain};
    await write({kind:'landscape-put',record:r,expectedRevision:null});
  };
  const local=(e:MouseEvent)=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
  canvas.addEventListener('pointerdown',e=>{
    if(!terrainTool()||e.button!==0)return;e.stopImmediatePropagation();e.preventDefault();
    if(busy||!data||terrainDraft)return;const p=local(e),world=view.hit(p.x,p.y);if(!world)return;
    const radius=terrainRadius();if(!Number.isFinite(radius)||radius<=0){status.textContent='Pinselradius prüfen.';return;}
    if(host.terrain!.settings.eyedropper){
      view.showDraft([]);view.render();const pixels=new Uint8Array(4),gl=view.renderer.getContext();gl.readPixels(Math.floor(p.x*canvas.width/canvas.clientWidth),Math.floor((canvas.clientHeight-p.y)*canvas.height/canvas.clientHeight),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);host.terrain!.settings.sample('#'+[...pixels.slice(0,3)].map(v=>v.toString(16).padStart(2,'0')).join(''));return;
    }
    const seed=crypto.getRandomValues(new Uint32Array(1))[0]!;
    if(tool.value==='color'){const r=emptyRecord('patch');r.resolution=Math.max(1,radius/32);r.points=[world];r.paint=host.terrain!.settings.color(radius,seed);r.polygons=r.paint.fill?[{outer:[{x:box.x,y:box.y},{x:box.x+box.width,y:box.y},{x:box.x+box.width,y:box.y+box.height},{x:box.x,y:box.y+box.height}],holes:[]}]:brushFootprint(r.points,radius);terrainDraft={kind:'landscape-color-stroke',record:r};}
    else terrainDraft={kind:'landscape-height-stroke',stroke:{...host.terrain!.settings.height(),radius,seed,samples:[{...world,t:0}]}};
    started=e.timeStamp;lastTerrainPoint=world;held=true;draftFence=data.fence;view.lockSurfaceCamera(true);terrainPanel.disabled=true;syncBrushSize();canvas.focus();canvas.setPointerCapture(e.pointerId);canvas.dataset.terrainDraft='pending';void previewTerrain();
  },true);
  canvas.addEventListener('pointermove',e=>{
    if(!terrainTool())return;e.stopImmediatePropagation();const p=local(e),world=view.hit(p.x,p.y);if(!world)return;
    if(held){const samples=e.getCoalescedEvents?.()??[];for(const sample of samples.length?samples:[e]){const at=local(sample),hit=view.hit(at.x,at.y);if(hit)updateTerrain(hit,sample.timeStamp);}}
    if(!busy){view.showDraft([world],terrainRadius());view.render();if(!held&&!terrainDraft)status.textContent=`Oberfläche: ${world.z.toFixed(1)} m · Radius ${terrainRadius()} m`;}
  },true);
  canvas.addEventListener('pointerup',e=>{
    if(!terrainTool())return;e.stopImmediatePropagation();if(!held||!terrainDraft)return;
    if(lastTerrainPoint)updateTerrain(lastTerrainPoint,e.timeStamp);held=false;stopPreview();if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    void write(terrainDraft);
  },true);
  canvas.addEventListener('pointercancel',()=>{if(terrainDraft&&!busy){clearTerrain();if(data)view.setData(data);status.textContent='Entwurf verworfen.';}},true);
  canvas.onpointerdown=e=>{
    if((busy&&(tool.value!=='navigate'||writing))||!data||e.button!==0)return;const p=local(e),world=view.hit(p.x,p.y);if(!world)return;
    if(tool.value==='select'){
      const i=view.pick(p.x,p.y,selectionFilter.value as 'all'|'trees'|'rocks'|'undergrowth');
      if(!i&&selectionFilter.value!=='all'){status.textContent='Kein Objekt des gewählten Typs an dieser Stelle.';return;}
      const area=i?.areaId??view.pickRecord(p.x,p.y)??data?.records.filter(r=>r.vegetation&&contains(world,r.polygons)).at(-1)?.id;
      if(area){const record=data?.records.find(r=>r.id===area);close();if(record?.route)void import('./terrain-route-ui').then(m=>m.openTerrainRoute({token:host.token,box,record,kind:record.kind==='river'?'river':'road',write:host.write})).catch(host.error);else void host.select(area,i).catch(host.error);}return;
    }
    if(tool.value==='area'||tool.value==='line'){points.push(world);syncBrushSize();view.showDraft(points);view.render();status.textContent=points.length+' Punkte · Abschließen übernimmt; Escape verwirft.';return;}
    gesture={start:p,box:{...box},points:[world],pan:tool.value==='navigate'};syncBrushSize();if(!gesture.pan){view.showDraft(gesture.points,Number(atlasFieldValue(element<HTMLInputElement>('radius'))));view.render();}canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove=e=>{
    const p=local(e);if(!gesture){if(!busy&&data&&tool.value!=='navigate'&&tool.value!=='select'){const world=view.hit(p.x,p.y);if(world){view.showDraft(points.length?[...points,world]:[world],['area','line'].includes(tool.value)?0:Number(atlasFieldValue(element<HTMLInputElement>('radius'))));view.render();}}return;}
    if(gesture.pan){const step=box.width/canvas.clientWidth,a=view.rotation*Math.PI/180,dx=(p.x-gesture.start.x)*step,dy=(p.y-gesture.start.y)*step/Math.max(.4,Math.cos(view.tilt*Math.PI/180));
      box={...gesture.box,x:gesture.box.x-dx*Math.cos(a)-dy*Math.sin(a),y:gesture.box.y+dx*Math.sin(a)-dy*Math.cos(a)};if(loading)reload=true;view.setViewport(box);return;}
    const world=view.hit(p.x,p.y),last=gesture.points.at(-1)!;
    if(world&&Math.hypot(world.x-last.x,world.y-last.y)>Number(atlasFieldValue(element<HTMLInputElement>('radius')))/4&&gesture.points.length<500)gesture.points.push(world);
    view.showDraft(gesture.points,Number(atlasFieldValue(element<HTMLInputElement>('radius'))));view.render();
    status.textContent=gesture.points.length+' Pinselstützpunkte · Loslassen speichert.';
  };
  canvas.onpointerup=e=>{const g=gesture;gesture=undefined;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(!g)return;if(g.pan)void load();else void commit(g.points,tool.value).catch(host.error);};
  canvas.onpointercancel=()=>{gesture=undefined;syncBrushSize();view.showDraft([]);view.render();};
  canvas.onwheel=e=>{e.preventDefault();if(writing||!data||draftPending())return;const factor=Math.exp(Math.max(-.5,Math.min(.5,e.deltaY*.001))),w=Math.max(40,Math.min(1e7,box.width*factor)),h=w*box.height/box.width;box={x:box.x+(box.width-w)/2,y:box.y+(box.height-h)/2,width:w,height:h};syncBrushSize();view.setViewport(box);void load();};
  canvas.addEventListener('webglcontextlost',e=>{if(closed)return;e.preventDefault();close(true);host.error(Error('GPU-Kontext verloren. Landschaft ist in der Draufsicht verfügbar.'));});
  element('finish').onclick=()=>{if(terrainDraft){held=false;stopPreview();void write(terrainDraft);}else void commit([...points],tool.value).catch(host.error);};
  element('cancel').onclick=()=>{if(busy)return;clearTerrain();points=[];gesture=undefined;syncBrushSize();if(data)view.setData(data);view.showDraft([]);view.render();status.textContent='Entwurf verworfen.';};
  element('undo').onclick=()=>{if(draftPending()){status.textContent='Zuerst Entwurf abschließen oder verwerfen.';return;}void write({kind:'undo'});};
  element('redo').onclick=()=>{if(draftPending()){status.textContent='Zuerst Entwurf abschließen oder verwerfen.';return;}void write({kind:'redo'});};
  element<HTMLInputElement>('tilt').oninput=()=>{if(draftPending()){element<HTMLInputElement>('tilt').value=String(view.tilt);return;}view.tilt=Number(element<HTMLInputElement>('tilt').value);view.render();};
  element<HTMLInputElement>('rotation').oninput=()=>{if(draftPending()){element<HTMLInputElement>('rotation').value=String(view.rotation);return;}view.rotation=Number(element<HTMLInputElement>('rotation').value);view.render();};
  dialog.querySelector<HTMLButtonElement>('#vegetation-top-view')!.onclick=()=>{if(draftPending())return;view.tilt=0;element<HTMLInputElement>('tilt').value='0';view.render();};
  dialog.querySelector<HTMLButtonElement>('#vegetation-tilted-view')!.onclick=()=>{if(draftPending())return;view.tilt=45;element<HTMLInputElement>('tilt').value='45';view.render();};
  element('export').onclick=()=>void(async()=>{if(busy||draftPending()||!data)return;view.showDraft([]);view.render();const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Bildausgabe fehlgeschlagen.');const r=await window.campaign.exportAtlasPNG(host.token,new Uint8Array(await blob.arrayBuffer()),'gm','png',data.fence);if(!r.ok)throw Error(r.error);status.textContent=r.value.cancelled?'Ausgabe abgebrochen.':'Räumliche Ansicht als PNG gespeichert.';})().catch(e=>{status.textContent=String(e);host.error(e);});
  exaggerationInput.oninput=()=>{if(draftPending()){exaggerationInput.value=String(view.exaggeration);return;}view.setExaggeration(Number(exaggerationInput.value));};
  const observer=new ResizeObserver(()=>{syncBrushSize();view.render();});observer.observe(canvas);
  function close(force=false){if(closed)return;if(!force&&(writing||draftPending())){status.textContent=writing?'Änderung wird gespeichert.':'Zuerst Entwurf abschließen oder verwerfen.';return;}closed=true;spatialSize.dispose();if(host.terrain)brushSizeControl(host.terrain.radius)?.sync('land-radius:'+tool.value,box.width/Math.max(1,canvas.clientWidth),false);request++;stopPreview();observer.disconnect();for(const {node,mark}of moved)mark.replaceWith(node);terrainPanel.disabled=false;if(host.viewState)Object.assign(host.viewState,{tilt:view.tilt,rotation:view.rotation,exaggeration:view.exaggeration});dialog.close();view.dispose();dialog.remove();host.navigate?.(box);}
  element('close').onclick=()=>close();
  dialog.oncancel=e=>{e.preventDefault();if(writing)return;if(draftPending()){clearTerrain();gesture=undefined;points=[];syncBrushSize();if(data)view.setData(data);view.showDraft([]);view.render();status.textContent='Entwurf verworfen.';}else close();};
  tool.onchange=()=>{if(busy||draftPending()){tool.value=selectedTool;status.textContent='Zuerst Entwurf abschließen oder verwerfen.';return;}selectedTool=tool.value;syncTools();view.showDraft([]);view.render();};
  await load();
}
