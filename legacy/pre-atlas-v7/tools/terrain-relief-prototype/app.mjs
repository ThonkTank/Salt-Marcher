import * as THREE from 'three';
import {Terrain,LANDMARKS,VIEWS,sampleGrid,gridHeight,riverY,reliefColor} from './terrain.mjs';

const $=id=>document.getElementById(id),terrain=new Terrain();
const viewport=$('viewport'),flat=$('flat'),spatial=$('spatial'),overlay=$('overlay');
const ctx=flat.getContext('2d'),ink=overlay.getContext('2d');
const state={...VIEWS.region,view:'tilted',scale:'region',style:'drawn',tilt:40,rotation:0,exaggeration:2};
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera();
let renderer,mesh,water,decoration=new THREE.Group(),grid,box,dirty=true,geometryDirty=true,localDirty=false,width=0,height=0;
let origin={x:state.x,y:state.y};
let pointer=null,gesture=null,frameTimes=[],buildTimes=[],lastFrame=0,frameNumber=0;
const raycaster=new THREE.Raycaster(),v3=new THREE.Vector3();
const diagnostics={errors:[],frames:0,lastHit:null,lastBrushLatencyMs:null};
const linear=Array.from({length:256},(_,v)=>THREE.ColorManagement.convert(new THREE.Color(v/255,v/255,v/255),THREE.SRGBColorSpace,THREE.LinearSRGBColorSpace).r);
try{
  renderer=new THREE.WebGLRenderer({canvas:spatial,antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.setClearColor('#a8c1c7');
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene.add(decoration);
}catch(error){diagnostics.errors.push(String(error));$('error').hidden=false;$('error').textContent='Räumliche Ansicht nicht verfügbar. Draufsicht bleibt nutzbar.';state.view='top';}
function surface(x,y){return gridHeight(grid,x,y);}
function point3(x,y,lift=0){return new THREE.Vector3(x-origin.x,origin.y-y,(surface(x,y)+lift)*state.exaggeration);}
function disposeGroup(group){for(const obj of [...group.children]){group.remove(obj);obj.geometry?.dispose();obj.material?.dispose();}}
function rebuild(){
  const start=performance.now(),aspect=width/height;
  // A finite overscan supports tilted views. This is explicitly not R1 streaming.
  const extent=state.span*(state.view==='top'?1.5:1.9);
  origin={x:state.x,y:state.y};
  box={x:state.x-extent*aspect/2,y:state.y-extent/2,width:extent*aspect,height:extent};
  grid=sampleGrid(terrain,box,state.view==='top'?300:210);
  if(renderer){
    const count=grid.heights.length,positions=new Float32Array(count*3),colors=new Float32Array(count*3),indices=[];
    for(let j=0;j<=grid.n;j++)for(let i=0;i<=grid.n;i++){
      const k=j*(grid.n+1)+i;
      positions.set([box.x+i*box.width/grid.n-state.x,state.y-box.y-j*box.height/grid.n,grid.heights[k]*state.exaggeration],k*3);
      colors[k*3]=linear[grid.colors[k*3]];colors[k*3+1]=linear[grid.colors[k*3+1]];colors[k*3+2]=linear[grid.colors[k*3+2]];
      if(i<grid.n&&j<grid.n)indices.push(k,k+1,k+grid.n+1,k+1,k+grid.n+2,k+grid.n+1);
    }
    if(mesh){scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeBoundingSphere();
    mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));scene.add(mesh);
    if(water){scene.remove(water);water.geometry.dispose();water.material.dispose();}
    water=new THREE.Mesh(new THREE.PlaneGeometry(box.width,box.height),new THREE.MeshBasicMaterial({color:'#acc8cd',transparent:true,opacity:.86,side:THREE.DoubleSide}));
    water.position.z=.2;scene.add(water);
    rebuildDecorations();
  }
  buildTimes.push(performance.now()-start);if(buildTimes.length>200)buildTimes.shift();geometryDirty=false;localDirty=false;
}
function updateLocalSurface(){
  const s=terrain.draft;if(!s?.points.length){localDirty=false;return;}
  const dx=box.width/grid.n,dy=box.height/grid.n,n=grid.n,stride=n+1;
  const minX=Math.min(...s.points.map(p=>p.x))-s.radius,maxX=Math.max(...s.points.map(p=>p.x))+s.radius;
  const minY=Math.min(...s.points.map(p=>p.y))-s.radius,maxY=Math.max(...s.points.map(p=>p.y))+s.radius;
  const x0=Math.max(0,Math.floor((minX-box.x)/dx)-1),x1=Math.min(n,Math.ceil((maxX-box.x)/dx)+1),y0=Math.max(0,Math.floor((minY-box.y)/dy)-1),y1=Math.min(n,Math.ceil((maxY-box.y)/dy)+1);
  for(let j=y0;j<=y1;j++)for(let i=x0;i<=x1;i++)grid.heights[j*stride+i]=terrain.height(box.x+i*dx,box.y+j*dy);
  const positions=mesh?.geometry.getAttribute('position'),colors=mesh?.geometry.getAttribute('color');
  for(let j=Math.max(0,y0-1);j<=Math.min(n,y1+1);j++)for(let i=Math.max(0,x0-1);i<=Math.min(n,x1+1);i++){
    const k=j*stride+i,left=Math.max(0,i-1),right=Math.min(n,i+1),up=Math.max(0,j-1),down=Math.min(n,j+1);
    const gx=(grid.heights[j*stride+right]-grid.heights[j*stride+left])/((right-left)*dx),gy=(grid.heights[down*stride+i]-grid.heights[up*stride+i])/((down-up)*dy);
    grid.colors.set(reliefColor(grid.heights[k],gx,gy,box.x+i*dx,box.y+j*dy),k*3);
    if(positions){positions.setZ(k,grid.heights[k]*state.exaggeration);colors.setXYZ(k,linear[grid.colors[k*3]],linear[grid.colors[k*3+1]],linear[grid.colors[k*3+2]]);}
  }
  if(mesh){positions.needsUpdate=true;colors.needsUpdate=true;mesh.geometry.computeBoundingSphere();rebuildDecorations();}
  localDirty=false;
}
function hachures(){
  const segments=[],spacing=state.span/52;
  for(let y=Math.ceil(box.y/spacing)*spacing;y<box.y+box.height;y+=spacing)for(let x=Math.ceil(box.x/spacing)*spacing;x<box.x+box.width;x+=spacing){
    const xx=x+Math.sin(y/spacing*7.13+x/spacing*1.9)*spacing*.25,yy=y+Math.cos(x/spacing*3.71)*spacing*.2;
    const h=surface(xx,yy),d=grid.spacing*.75;
    const gx=(surface(xx+d,yy)-surface(xx-d,yy))/(2*d),gy=(surface(xx,yy+d)-surface(xx,yy-d))/(2*d),slope=Math.hypot(gx,gy);
    if(h<650||slope<.045||Math.sin(xx/spacing*31+yy/spacing*13)<-.25)continue;
    const length=spacing*Math.min(.95,.3+slope*2),dx=-gx/slope*length,dy=-gy/slope*length;
    segments.push([[xx,yy],[xx+dx*.5+dy*.08,yy+dy*.5-dx*.08],[xx+dx,yy+dy]]);
  }
  return segments;
}
function riverPoints(){const p=[];for(let x=-122000;x<92000;x+=600)p.push([x,riverY(x)]);return p;}
const houses=Array.from({length:27},(_,i)=>({x:5000+(i%6-2.5)*150+Math.sin(i*4)*48,y:13500+(Math.floor(i/6)-2)*150,angle:Math.sin(i*5)*.25}));
function rebuildDecorations(){
  disposeGroup(decoration);
  if(state.style==='drawn'){
    const vertices=[];for(const line of hachures())for(let i=0;i<line.length-1;i++)for(const p of [line[i],line[i+1]])vertices.push(...point3(p[0],p[1],12).toArray());
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    decoration.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:'#4b5045',transparent:true,opacity:.25,depthWrite:false})));
  }
  const river=[];const rp=riverPoints();for(let i=0;i<rp.length-1;i++){const p=rp[i],q=rp[i+1];if(surface(...p)>0)river.push(...point3(...p,8).toArray(),...point3(...q,8).toArray());}
  const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(river,3));decoration.add(new THREE.LineSegments(rg,new THREE.LineBasicMaterial({color:'#487c92'})));
  if(state.span<35000)for(const house of houses){
    const p=point3(house.x,house.y),body=new THREE.Mesh(new THREE.BoxGeometry(60,42,11*state.exaggeration),new THREE.MeshBasicMaterial({color:'#eee5ce'}));
    body.position.copy(p);body.position.z+=5.5*state.exaggeration;body.rotation.z=house.angle;decoration.add(body);
    // A gable roof: finite simple test geometry, not a production building model.
    const roof=new THREE.BufferGeometry(),z=11*state.exaggeration,peak=21*state.exaggeration;
    roof.setAttribute('position',new THREE.Float32BufferAttribute([-36,-27,z,36,-27,z,-36,0,peak,36,-27,z,36,0,peak,-36,0,peak,-36,0,peak,36,0,peak,-36,27,z,36,0,peak,36,27,z,-36,27,z],3));
    const rm=new THREE.Mesh(roof,new THREE.MeshBasicMaterial({color:'#675d52',side:THREE.DoubleSide}));rm.position.copy(p);rm.rotation.z=house.angle;decoration.add(rm);
  }
}
function updateCamera(){
  if(!renderer)return;
  const aspect=width/height,half=state.span/2,r=state.span*2,tilt=state.tilt*Math.PI/180,rot=state.rotation*Math.PI/180;
  camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.near=state.span*.005;camera.far=state.span*8;
  const center=Math.max(0,terrain.height(state.x,state.y))*state.exaggeration,cx=state.x-origin.x,cy=origin.y-state.y;
  camera.position.set(cx+Math.sin(rot)*Math.sin(tilt)*r,cy-Math.cos(rot)*Math.sin(tilt)*r,center+Math.cos(tilt)*r);
  camera.up.set(-Math.sin(rot)*Math.cos(tilt),Math.cos(rot)*Math.cos(tilt),Math.sin(tilt));camera.lookAt(cx,cy,center);camera.updateProjectionMatrix();camera.updateMatrixWorld();
}
function project(x,y,lift=0){
  if(state.view==='top')return{x:width/2+(x-state.x)/state.span*height,y:height/2+(y-state.y)/state.span*height,visible:true};
  const p=point3(x,y,lift).project(camera);return{x:(p.x+1)*width/2,y:(1-p.y)*height/2,visible:p.z>=-1&&p.z<=1};
}
function hit(sx,sy){
  if(state.view==='top'){const x=state.x+(sx-width/2)*state.span/height,y=state.y+(sy-height/2)*state.span/height;return{x,y,z:terrain.height(x,y)};}
  if(!mesh)return null;
  raycaster.setFromCamera(new THREE.Vector2(sx/width*2-1,1-sy/height*2),camera);
  const found=raycaster.intersectObject(mesh,false)[0];if(!found)return null;
  const x=found.point.x+origin.x,y=origin.y-found.point.y;
  return{x,y,z:terrain.height(x,y),meshHeight:found.point.z/state.exaggeration};
}
function path2d(points,context){context.beginPath();points.forEach((p,i)=>{const s=project(...p);context[i?'lineTo':'moveTo'](s.x,s.y);});}
function drawFlat(){
  const tile=document.createElement('canvas');tile.width=tile.height=grid.n+1;const tc=tile.getContext('2d'),image=tc.createImageData(tile.width,tile.height);
  for(let k=0;k<grid.heights.length;k++){image.data.set(grid.colors.subarray(k*3,k*3+3),k*4);image.data[k*4+3]=255;}
  tc.putImageData(image,0,0);const p=project(box.x,box.y);ctx.clearRect(0,0,width,height);ctx.imageSmoothingEnabled=true;ctx.drawImage(tile,p.x,p.y,box.width/state.span*height,box.height/state.span*height);
  if(state.style==='drawn'){ctx.strokeStyle='rgba(55,64,49,.25)';ctx.lineWidth=.75;for(const line of hachures()){path2d(line,ctx);ctx.stroke();}}
  ctx.strokeStyle='#4c8195';ctx.lineWidth=1.6;let segment=[];for(const p of riverPoints()){if(surface(...p)>0)segment.push(p);else if(segment.length){path2d(segment,ctx);ctx.stroke();segment=[];}}if(segment.length){path2d(segment,ctx);ctx.stroke();}
  if(state.span<35000)for(const house of houses){const p=project(house.x,house.y);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(house.angle);ctx.fillStyle='#675d52';ctx.fillRect(-30/state.span*height,-21/state.span*height,60/state.span*height,42/state.span*height);ctx.restore();}
}
const labelNodes=LANDMARKS.map(p=>{const node=document.createElement('span');node.textContent=p.name;node.className='map-label '+(p.scale==='wide'?'wide':'');$('map-labels').append(node);return{p,node};});
function drawLabels(){
  const occupied=[];
  for(const {p,node} of labelNodes){
    const pos=project(p.x,p.y,35),show=$('labels').checked&&pos.visible&&pos.x>80&&pos.x<width-80&&pos.y>110&&pos.y<height-30&&(state.span>35000||p.scale==='all');
    ink.font='15px "Noto Serif"';const labelWidth=ink.measureText(p.name).width;
    const blocked=occupied.some(q=>Math.abs(q.x-pos.x)<(q.width+labelWidth)/2+10&&Math.abs(q.y-pos.y)<30);
    node.hidden=!show||blocked;if(show&&!blocked){node.style.left=pos.x+'px';node.style.top=pos.y+'px';occupied.push({...pos,width:labelWidth});}
  }
  const metres=state.span/height*130,power=10**Math.floor(Math.log10(metres)),distance=Math.floor(metres/power)*power;
  $('scale-bar').textContent=(distance>=1000?distance/1000+' km':distance+' m')+(state.view==='tilted'?' · Quermaß':'');$('scale-bar').style.width=distance/state.span*height+'px';
  $('map-caption').firstChild.textContent=state.scale==='place'?'Steinwacht':'Sattelpass';
}
function drawCursor(){
  ink.clearRect(0,0,width,height);if(!pointer||$('tool').value==='navigate')return;
  const p=hit(pointer.x,pointer.y);if(!p)return;const radius=Number($('radius').value),points=[];
  for(let i=0;i<=70;i++){const angle=i/70*Math.PI*2;points.push([p.x+Math.cos(angle)*radius,p.y+Math.sin(angle)*radius]);}
  path2d(points,ink);ink.strokeStyle='#244b5e';ink.lineWidth=1.5;ink.setLineDash([5,4]);ink.stroke();ink.setLineDash([]);
}
function render(time){
  const started=performance.now();
  if(dirty){
    if(geometryDirty)rebuild();else if(localDirty)updateLocalSurface();updateCamera();
    flat.hidden=state.view!=='top';spatial.hidden=state.view==='top';
    if(state.view==='top')drawFlat();else renderer?.render(scene,camera);
    drawLabels();drawCursor();
    diagnostics.frames++;frameNumber++;
    if(gesture?.changedAt){diagnostics.lastBrushLatencyMs=performance.now()-gesture.changedAt;gesture.changedAt=0;}
    $('metrics').textContent=`${state.view==='top'?'Draufsicht':'GPU-Relief'} · Raster ${Math.round(grid.spacing)} m · ${Math.round(performance.now()-started)} ms`;
    dirty=false;
  }
  if(lastFrame){frameTimes.push(time-lastFrame);if(frameTimes.length>600)frameTimes.shift();}lastFrame=time;
  requestAnimationFrame(render);
}
function refresh(geometry=false){dirty=true;geometryDirty ||= geometry;}
function resize(){const rect=viewport.getBoundingClientRect();width=Math.round(rect.width);height=Math.round(rect.height);for(const canvas of [flat,overlay]){canvas.width=width;canvas.height=height;}renderer?.setSize(width,height,false);refresh(true);}
new ResizeObserver(resize).observe(viewport);
function sync(){
  $('top').setAttribute('aria-pressed',String(state.view==='top'));$('tilted').setAttribute('aria-pressed',String(state.view==='tilted'));
  $('tilt-value').value=state.tilt+'°';$('ex-value').value=state.exaggeration+'×';$('radius-value').value=Number($('radius').value)/1000+' km';$('strength-value').value=$('strength').value+' m';
  $('undo').disabled=!terrain.strokes.length;$('redo').disabled=!terrain.redoStack.length;
}
function endGesture(commit){if(terrain.draft){if(commit)terrain.commit();else terrain.cancel();refresh(true);}gesture=null;sync();}
function view(mode){endGesture(false);state.view=mode;if(mode==='tilted'&&!renderer){state.view='top';return;}$('error').hidden=true;sync();refresh(true);}
$('top').onclick=()=>view('top');$('tilted').onclick=()=>view('tilted');
$('scale').onchange=()=>{endGesture(false);Object.assign(state,VIEWS[$('scale').value]);state.scale=$('scale').value;state.exaggeration=state.scale==='place'?1:state.scale==='continent'?8:2;$('exaggeration').value=state.exaggeration;$('radius').value=state.scale==='place'?500:4500;sync();refresh(true);};
for(const id of ['tilt','rotation','exaggeration'])$(id).oninput=()=>{endGesture(false);state[id]=Number($(id).value);sync();refresh(id==='exaggeration');};
$('style').onchange=()=>{state.style=$('style').value;refresh(true);};$('labels').onchange=()=>refresh();
for(const id of ['radius','strength'])$(id).oninput=()=>{sync();refresh();};
$('tool').onchange=()=>{endGesture(false);refresh();};
$('undo').onclick=()=>{terrain.undo();sync();refresh(true);};$('redo').onclick=()=>{terrain.redo();sync();refresh(true);};
$('reset').onclick=()=>{terrain.reset();sync();refresh(true);$('status').textContent='Testlandschaft wiederhergestellt.';};
const local=e=>{const b=viewport.getBoundingClientRect();return{x:e.clientX-b.left,y:e.clientY-b.top};};
viewport.oncontextmenu=e=>e.preventDefault();
viewport.onpointerdown=e=>{
  if(e.target.closest('button,input,select'))return;
  const p=local(e),world=hit(p.x,p.y);pointer=p;viewport.setPointerCapture(e.pointerId);
  const painting=e.button===0&&$('tool').value!=='navigate';
  gesture={painting,start:p,x:state.x,y:state.y,changedAt:performance.now()};
  if(painting&&world){terrain.begin(Number($('radius').value),Number($('strength').value)*($('tool').value==='lower'?-1:1));terrain.add(world.x,world.y);localDirty=true;refresh();}
};
viewport.onpointermove=e=>{
  pointer=local(e);const world=hit(pointer.x,pointer.y);
  if(world){diagnostics.lastHit=world;$('status').textContent=`Höhe ${Math.round(world.z).toLocaleString('de-DE')} m · ${Math.round(world.x/1000)} / ${Math.round(world.y/1000)} km`;}
  if(gesture){
    if(gesture.painting&&world&&terrain.draft){if(terrain.add(world.x,world.y)){gesture.changedAt=performance.now();localDirty=true;refresh();}}
    else if(!gesture.painting){
      const dx=(pointer.x-gesture.start.x)*state.span/height,dy=(pointer.y-gesture.start.y)*state.span/height,rot=state.view==='top'?0:state.rotation*Math.PI/180,scale=state.view==='top'?1:1/Math.max(.4,Math.cos(state.tilt*Math.PI/180));
      state.x=gesture.x-dx*Math.cos(rot)-dy*scale*Math.sin(rot);state.y=gesture.y+dx*Math.sin(rot)-dy*scale*Math.cos(rot);
      refresh(Math.abs(state.x-origin.x)>box.width*.12||Math.abs(state.y-origin.y)>box.height*.12);
    }
  }
  refresh();
};
viewport.onpointerup=e=>{endGesture(true);if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);};
viewport.onpointercancel=()=>endGesture(false);
viewport.onlostpointercapture=()=>{if(gesture)endGesture(false);};
viewport.onpointerleave=()=>{if(!gesture){pointer=null;refresh();}};
viewport.onwheel=e=>{e.preventDefault();if(gesture)return;state.span=Math.max(1800,Math.min(700000,state.span*Math.exp(e.deltaY*.001)));refresh(true);};
window.addEventListener('keydown',e=>{if(e.key==='Escape')endGesture(false);});window.addEventListener('blur',()=>endGesture(false));
spatial.addEventListener('webglcontextlost',e=>{e.preventDefault();endGesture(false);state.view='top';sync();refresh(true);$('status').textContent='GPU-Kontext verloren; Draufsicht aktiv.';});
window.addEventListener('error',e=>diagnostics.errors.push(e.message));
// Read-only diagnostic surface for tests. All editing is exercised through UI.
window.reliefProbe={
  read:()=>({state:{...state},revision:terrain.revision,strokes:terrain.strokes.length,draft:!!terrain.draft,gridSpacing:grid?.spacing,frameNumber,diagnostics:{...diagnostics},buildTimes:[...buildTimes],frameTimes:[...frameTimes],gpu:renderer?.getContext().getParameter(renderer.getContext().RENDERER),sample:{pass:terrain.height(-16800,10400),village:terrain.height(5000,13500)}}),
  height:(x,y)=>terrain.height(x,y),project:(x,y)=>project(x,y),hit:(x,y)=>hit(x,y),
};
sync();resize();requestAnimationFrame(render);$('status').textContent='Ansicht kippen, Maßstab wechseln oder Gelände anheben.';document.body.dataset.ready='true';
