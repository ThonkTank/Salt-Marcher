import {CollisionFilterExtension} from '@deck.gl/extensions';
import {Deck,OrbitView,COORDINATE_SYSTEM} from '@deck.gl/core';
import {TerrainLayer} from '@deck.gl/geo-layers';
import {PolygonLayer,PathLayer,TextLayer} from '@deck.gl/layers';
const extent=45000000,errors=[],buildings=[],rooms=[],places=[],roads=[],regions=[];
function height(x,y){const mainland=Math.max(0,1-Math.hypot(x/14000000,y/7000000));return mainland>0?80+mainland*300+Math.max(0,Math.sin(x/700000)*Math.cos(y/900000))*mainland*1800:0;}
const rectangle=(x,y,w,h,z=0)=>[[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z],[x,y,z]];
for(let i=0;i<5000;i++){
 const x=(i%100)*30,y=Math.floor(i/100)*30,z=height(x,y);buildings.push({polygon:rectangle(x,y,18,22,z),height:6,name:'Haus '+i});
 for(let room=0;room<4;room++)rooms.push({polygon:rectangle(x+1+(room%2)*8,y+1+Math.floor(room/2)*10,7,9,z+(room<2?0:3))});
 const px=(i%100-50)*350000,py=(Math.floor(i/100)-25)*350000;places.push({position:[px,py,height(px,py)],name:['Dornfels','Silberhain','Eichenwacht','Nebelbruch'][i%4]+' '+i,rank:i%10});
}
for(let i=0;i<50;i++)roads.push({path:[[0,i*30-4,height(0,i*30-4)+.1],[3100,i*30-4,height(3100,i*30-4)+.1]]});
for(let i=0;i<12;i++)regions.push({path:rectangle((i%4-2)*7e6,(Math.floor(i/4)-1)*5e6,6e6,4e6,500)});
await document.fonts.load('12px "Noto Serif"');
let viewState={target:[0,0,0],rotationX:90,rotationOrbit:0,zoom:Math.log2(1152/4e7)},mode='full',width=4e7;
const common={coordinateSystem:COORDINATE_SYSTEM.CARTESIAN,pickable:false};
const terrain=new TerrainLayer({...common,id:'terrain',elevationData:location.origin+'/dem/{z}/{x}/{y}.png',texture:location.origin+'/color/{z}/{x}/{y}.png',minZoom:-18,maxZoom:8,tileSize:256,extent:[-extent/2,-extent/2,extent/2,extent/2],maxCacheSize:160,elevationDecoder:{rScaler:6553.6,gScaler:25.6,bScaler:.1,offset:-10000},meshMaxError:4,loadOptions:{terrain:{workerUrl:location.origin+'/terrain-worker.js'}},material:{ambient:.7,diffuse:.3,shininess:0},onTileError:e=>errors.push(String(e))});
function layers(){
 const mlZoom=Math.log2(extent*1152/(512*width)),objects=mode==='full'||mode==='flat';
 return [mode!=='background'&&mode!=='flat'&&new TerrainLayer(terrain.props),
 objects&&new PathLayer({...common,id:'regions',data:regions,getPath:d=>d.path,getColor:[147,108,96],getWidth:1,widthUnits:'pixels',visible:mlZoom<11}),
 objects&&new PathLayer({...common,id:'roads',data:roads,getPath:d=>d.path,getColor:[139,115,85],getWidth:Math.max(1,Math.min(5,1+(mlZoom-10)*.4)),widthUnits:'pixels',visible:mlZoom>=10}),
 objects&&new PolygonLayer({...common,id:'buildings',data:buildings,getPolygon:d=>d.polygon,getElevation:6,getFillColor:[187,145,112],extruded:true,stroked:false,visible:mlZoom>=12}),
 objects&&new PolygonLayer({...common,id:'interiors',data:rooms,getPolygon:d=>d.polygon,filled:false,getLineColor:[72,60,48],getLineWidth:2,lineWidthUnits:'pixels',visible:mlZoom>=20}),
 objects&&new TextLayer({...common,id:'names',data:places,extensions:[new CollisionFilterExtension()],getCollisionPriority:d=>-d.rank,parameters:{depthCompare:'always',depthWriteEnabled:false},getPosition:d=>d.position,getText:d=>d.name,getSize:Math.min(17,12+mlZoom*5/12),getColor:[56,46,36],fontFamily:'Noto Serif',fontSettings:{sdf:true},outlineWidth:1,outlineColor:[238,225,189]})];
}
const tick=()=>new Promise(r=>requestAnimationFrame(r));
const deck=new Deck({parent:document.getElementById('map'),width:1152,height:852,useDevicePixels:1,views:new OrbitView({orbitAxis:'Z',orthographic:false,near:.1,far:1000}),viewState,controller:true,layers:layers(),parameters:{clearColor:[116/255,168/255,178/255,1]},onViewStateChange:({viewState:v})=>{viewState=v;deck.setProps({viewState});},onError:e=>errors.push(e.stack??String(e)),onLoad:()=>window.probe.ready=true});
window.probe={version:'9.4.0',deck,errors,fixture:{buildings:5000,rooms:20000,places:5000,roads:50,regions:12},ready:false,
 async pose(w,center=[0,0],pitch=0,bearing=0){width=w;const start=performance.now();viewState={target:[...center,height(...center)],zoom:Math.log2(1152/w),rotationX:90-pitch,rotationOrbit:bearing};deck.setProps({viewState,layers:layers()});for(let i=0;i<5;i++)await tick();let deadline=performance.now()+30000;while(!deck.isInitialized||!deck.layerManager.getLayers().every(l=>l.isLoaded)){if(performance.now()>deadline)throw Error('Deck load timeout');await tick();}await tick();const viewport=deck.getViewports()[0],projected=viewport.project(viewState.target),roundtrip=viewport.unproject(projected);return{width:w,pitch,bearing,readyMs:performance.now()-start,roundtrip:roundtrip.map((v,i)=>v-viewState.target[i]),errors:errors.slice()};},
 async mode(value){mode=value;deck.setProps({layers:layers()});for(let i=0;i<5;i++)await tick();const deadline=performance.now()+30000;while(!deck.layerManager.getLayers().every(l=>l.isLoaded)){if(performance.now()>deadline)throw Error('Component load timeout');await tick();}for(let i=0;i<60;i++)await tick();},
 camera(i){deck.setProps({viewState:{...viewState,rotationOrbit:23+Math.sin(i/20)*10,zoom:viewState.zoom+Math.sin(i/10)*.015}});}
};
