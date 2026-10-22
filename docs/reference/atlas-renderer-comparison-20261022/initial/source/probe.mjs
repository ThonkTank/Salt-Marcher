import * as ml from './maplibre-gl.mjs';
const extent=45000000,units=250000,errors=[];window.probe={errors,version:ml.getVersion()};
await ml.importScriptInWorkers(location.origin+'/projection.mjs');
ml.addProjection({name:'atlas:metres',definition:'saltmarcher-plane-v1',projection:{forward:([x,y])=>[x*units,y*units],inverse:([x,y])=>[x/units,y/units]},tileMatrixSet:{origin:[-extent/2,extent/2],extentAtZoom0:extent}});
const ll=([x,y])=>[x/units,y/units],feature=(type,coordinates,properties,id)=>({type:'Feature',id,properties,geometry:{type,coordinates}});
const rectangle=(x,y,w,h)=>[[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]].map(ll)];
const buildings=[],places=[],roads=[],regions=[];
for(let i=0;i<5000;i++){
 const x=(i%100)*30,y=Math.floor(i/100)*30;buildings.push(feature('Polygon',rectangle(x,y,18,22),{height:6,base:0,name:'Haus '+i},i));
 for(let room=0;room<4;room++)buildings.push(feature('Polygon',rectangle(x+1+(room%2)*8,y+1+Math.floor(room/2)*10,7,9),{height:room<2?3:6,base:room<2?0:3,name:'Raum '+room,interior:true},5000+i*4+room));
 places.push(feature('Point',ll([(i%100-50)*350000,(Math.floor(i/100)-25)*350000]),{name:['Dornfels','Silberhain','Eichenwacht','Nebelbruch'][i%4]+' '+i,rank:i%10},i));
}
for(let i=0;i<50;i++)roads.push(feature('LineString',[[0,i*30-4],[3100,i*30-4]].map(ll),{name:'Weg '+i},i));
for(let i=0;i<12;i++)regions.push(feature('Polygon',rectangle((i%4-2)*7e6,(Math.floor(i/4)-1)*5e6,6e6,4e6),{name:'Mark '+i},i));
const collection=features=>({type:'FeatureCollection',features});
const map=new ml.Map({container:'map',center:ll([0,0]),zoom:1.5,maxZoom:28,maxPitch:75,attributionControl:false,renderWorldCopies:false,canvasContextAttributes:{preserveDrawingBuffer:true},style:{version:8,projection:{type:'atlas:metres'},'font-faces':{'Noto Serif':location.origin+'/font.ttf'},sources:{
 dem:{type:'raster-dem',tiles:[location.origin+'/dem/{z}/{x}/{y}.png'],tileSize:256,maxzoom:16,encoding:'mapbox'},
 shadeDem:{type:'raster-dem',tiles:[location.origin+'/dem/{z}/{x}/{y}.png'],tileSize:256,maxzoom:16,encoding:'mapbox'},
 color:{type:'raster',tiles:[location.origin+'/color/{z}/{x}/{y}.png'],tileSize:256,maxzoom:16},
 buildings:{type:'geojson',data:collection(buildings),maxzoom:24,tolerance:0},places:{type:'geojson',data:collection(places)},roads:{type:'geojson',data:collection(roads),maxzoom:24,tolerance:0},regions:{type:'geojson',data:collection(regions)}},
 terrain:{source:'dem',exaggeration:1},layers:[
 {id:'background',type:'background',paint:{'background-color':'#74a8b2'}},
 {id:'land',type:'raster',source:'color',paint:{'raster-fade-duration':0}},
 {id:'shade',type:'hillshade',source:'shadeDem',paint:{'hillshade-exaggeration':.25,'hillshade-shadow-color':'#776342','hillshade-highlight-color':'#f0e6c3'}},
 {id:'regions',type:'line',source:'regions',maxzoom:11,paint:{'line-color':'#936c60','line-width':1,'line-dasharray':[4,3]}},
 {id:'roads',type:'line',source:'roads',minzoom:10,paint:{'line-color':'#8b7355','line-width':['interpolate',['linear'],['zoom'],10,1,20,5]}},
 {id:'buildings',type:'fill-extrusion',source:'buildings',minzoom:12,filter:['!=',['get','interior'],true],paint:{'fill-extrusion-height':['get','height'],'fill-extrusion-base':['get','base'],'fill-extrusion-color':'#bb9170','fill-extrusion-opacity':1}},
 {id:'interiors',type:'line',source:'buildings',minzoom:20,filter:['==',['get','interior'],true],paint:{'line-color':'#483c30','line-width':2}},
 {id:'names',type:'symbol',source:'places',layout:{'text-field':['get','name'],'text-font':['literal',['Noto Serif']],'text-size':['interpolate',['linear'],['zoom'],0,12,12,17],'symbol-sort-key':['get','rank'],'text-padding':5},paint:{'text-color':'#382e24','text-halo-color':'#eee1bd','text-halo-width':1.2}}
 ]}});
map.on('error',e=>errors.push(e.error?.message??String(e)));window.probe.map=map;window.probe.fixture={buildings:5000,rooms:20000,places:5000,roads:50,regions:12};
window.probe.pose=async(width,center=[0,0],pitch=0,bearing=0)=>{
 const start=performance.now();map.jumpTo({center:ll(center),zoom:Math.log2(extent*map.getCanvas().clientWidth/(512*width)),pitch,bearing});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Map idle timeout')),30000);map.once('idle',()=>{clearTimeout(timer);resolve();});});
 const projected=map.project(ll(center)),roundtrip=map.unproject(projected);return{width,pitch,bearing,readyMs:performance.now()-start,roundtrip:[roundtrip.lng*units-center[0],roundtrip.lat*units-center[1]],features:map.queryRenderedFeatures().length,errors:errors.slice()};
};
map.once('idle',()=>{window.probe.ready=true;});
