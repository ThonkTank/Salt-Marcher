import {maplibre,initializeAtlasMapLibre,AtlasMapLibreBridge} from '../src/app/atlas-maplibre-runtime.ts';
import {atlasMetricCRS} from '../src/app/atlas-maplibre-projection.ts';
import {MapLibreOverlay} from '@deck.gl/maplibre';
import {VERSION as DECK_VERSION,COORDINATE_SYSTEM} from '@deck.gl/core';
import {GeoJsonLayer} from '@deck.gl/layers';
import {metricCameraPose,metricLngLat,metricMapCamera,metricPoint,translateMetricTile} from '../src/app/atlas-metric-space.ts';
import {queryRenderedFeaturesMetricSafe as queryMetricFeatures} from '../src/app/atlas-metric-query.ts';

const initialRootM=2**26,width=1152;
const scales=[
  {name:'world',span:40_000_000},
  {name:'continent',span:16_000_000},
  {name:'kingdom',span:4_000_000},
  {name:'city',span:3_000},
  {name:'interior',span:200}
];
const errors=[],results={versions:{maplibre:maplibre.getVersion(),deck:DECK_VERSION},scales:[],integration:[],rootExpansion:null,errors};
window.atlasMapLibreInterop=results;
const rootFor=size=>({x:-size/2,y:-size/2,size});
const initialRoot=rootFor(initialRootM);
let activeRoot=rootFor(initialRootM),projectionFrame=null,diagnosticGl=null;
function lngLat([x,y],root=activeRoot){return metricLngLat(root,{x,y});}
function cameraZoom(root,span){return Math.log2(root*width/(512*span));}
function camera(root,focus,span,bearing,pitch){return metricMapCamera(root,{focus:{x:focus[0],y:focus[1]},metersPerPixel:metersPerPixel(root.size,cameraZoom(root.size,span)),rotation:bearing,tilt:pitch});}
function registerCRS(name,root){maplibre.addProjection(atlasMetricCRS(name,root));}
function markerFeature(root){return {type:'Feature',id:'maplibre-marker',properties:{id:'maplibre-marker'},geometry:{type:'Point',coordinates:lngLat([0,0],root)}};}
let activeBridge=null;
function currentFrame(){return activeBridge?.frame??projectionFrame;}
async function attachBridge(map,root,layers,sceneOrigin={x:0,y:0},sourceIds=['occluder','marker']){
  // Remove only this probe's independent matrix witness before installing the
  // production bridge, which owns its own capture layer and lifecycle.
  if(map.getLayer('atlas-projection-diagnostic'))map.removeLayer('atlas-projection-diagnostic');
  const bridge=new AtlasMapLibreBridge({map,root,sceneOrigin,sourceIds,onError:error=>errors.push(error?.stack??String(error))});
  activeBridge=bridge;
  const overlay=await bridge.attach(layers);
  await rendered(map,sourceIds);
  return {bridge,overlay};
}
function disposeBridge(){activeBridge?.dispose();activeBridge=null;}
function makeMap(container,projection,root){
  activeRoot=root;
  const center=lngLat([0,0],root);
  const marker=markerFeature(root);
  const occluder={type:'Feature',id:'maplibre-occluder',properties:{id:'maplibre-occluder',height:0},geometry:{type:'Polygon',coordinates:[[
    lngLat([-500,-500],root),lngLat([500,-500],root),lngLat([500,500],root),lngLat([-500,500],root),lngLat([-500,-500],root)
  ]]}};
  return new maplibre.Map({container,center,zoom:cameraZoom(root.size,scales[0].span),bearing:0,pitch:0,
    minZoom:0,maxZoom:32,maxPitch:75,maxBounds:[[-64,-64],[64,64]],renderWorldCopies:false,attributionControl:false,
    canvasContextAttributes:{preserveDrawingBuffer:true},
    style:{version:8,projection:{type:projection},sources:{
      dem:{type:'raster-dem',tiles:[`${location.origin}/dem/{z}/{x}/{y}.png`],tileSize:256,maxzoom:24,encoding:'mapbox'},
      demElevated:{type:'raster-dem',tiles:[`${location.origin}/dem-elevated/{z}/{x}/{y}.png`],tileSize:256,maxzoom:24,encoding:'mapbox'},
      marker:{type:'geojson',data:{type:'FeatureCollection',features:[marker]},maxzoom:24},
      occluder:{type:'geojson',data:{type:'FeatureCollection',features:[occluder]},maxzoom:24}
    },layers:[
      {id:'background',type:'background',paint:{'background-color':'#b8c6b0'}},
      {id:'maplibre-occluder-layer',type:'fill-extrusion',source:'occluder',paint:{'fill-extrusion-color':'#6b354d','fill-extrusion-height':['get','height'],'fill-extrusion-base':0,'fill-extrusion-opacity':1}},
      {id:'maplibre-marker-layer',type:'circle',source:'marker',paint:{'circle-radius':8,'circle-color':'#d02b39','circle-stroke-width':2,'circle-stroke-color':'#ffffff'}}
    ]}
  });
}
function addProjectionDiagnostic(map){
  map.addLayer({id:'atlas-projection-diagnostic',type:'custom',renderingMode:'3d',onAdd(_map,gl){diagnosticGl=gl;},
    render(gl,options){
      diagnosticGl=gl;projectionFrame={mvp:Array.from(options.modelViewProjectionMatrix),projection:Array.from(options.projectionMatrix),
        mainMatrix:Array.from(options.defaultProjectionData.mainMatrix),nearZ:options.nearZ,farZ:options.farZ};

    }});
}
async function updateScene(map,root,span,focus=[0,0]){
  const half=span*.16,height=span*.09;
  const data={type:'FeatureCollection',features:[{type:'Feature',id:'maplibre-occluder',properties:{id:'maplibre-occluder',height},geometry:{type:'Polygon',coordinates:[[
    lngLat([focus[0]-half,focus[1]-half],root),lngLat([focus[0]+half,focus[1]-half],root),lngLat([focus[0]+half,focus[1]+half],root),lngLat([focus[0]-half,focus[1]+half],root),lngLat([focus[0]-half,focus[1]-half],root)
  ]]}}]};
  await map.getSource('occluder').setData(data);
}
function deckFeatures(span,root){
  const half=span*.12,visibleHeight=span*.12,hiddenHeight=span*.05;
  const polygon=(x,y,r)=>[[[x-r,y-r,0],[x+r,y-r,0],[x+r,y+r,0],[x-r,y+r,0],[x-r,y-r,0]]];
  return {type:'FeatureCollection',features:[
    {type:'Feature',id:'visible-room',properties:{id:'visible-room',height:visibleHeight/root},geometry:{type:'Polygon',coordinates:polygon(span*.32/root,0,half/root)}},
    {type:'Feature',id:'hidden-room',properties:{id:'hidden-room',height:hiddenHeight/root},geometry:{type:'Polygon',coordinates:polygon(0,0,half/root)}}
  ]};
}
function deckLayers(span,root=initialRootM){
  const data=deckFeatures(span,root);
  return [new GeoJsonLayer({id:'atlas-building-and-rooms',data,pickable:true,extruded:true,filled:true,stroked:false,
    coordinateSystem:COORDINATE_SYSTEM.CARTESIAN,getFillColor:f=>f.properties.id==='visible-room'?[214,174,71,255]:[44,105,148,255],
    getElevation:f=>f.properties.height,opacity:1,wireframe:false})];
}
const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>resolve()));
async function frames(count=2){for(let i=0;i<count;i++)await tick();}
async function idle(map){await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('MapLibre idle timeout')),45_000);map.once('idle',()=>{clearTimeout(timer);resolve();});});}
async function rendered(map,sourceIds=[]){
  const ready=()=>sourceIds.every(id=>map.isSourceLoaded(id));
  if(!ready())await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{map.off('sourcedata',check);reject(Error(`MapLibre source-ready timeout: ${sourceIds.filter(id=>!map.isSourceLoaded(id)).join(',')}`));},10_000);
    function check(event){if(event.dataType==='source'&&sourceIds.includes(event.sourceId)&&ready()){clearTimeout(timer);map.off('sourcedata',check);resolve();}}
    map.on('sourcedata',check);
  });
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{map.off('render',finish);reject(Error('MapLibre render timeout'));},5_000);
    function finish(){clearTimeout(timer);map.off('render',finish);resolve();}
    map.once('render',finish);map.triggerRepaint();
  });
  await frames();
}
function metersPerPixel(root,zoom){return root/(512*2**zoom);}
async function projectionSweep(map,root){
  const rows=[];results.projectionVisuals=[];
  for(const scale of scales){
    const zoom=cameraZoom(root.size,scale.span);
    map.jumpTo(camera(root,[0,0],scale.span,137,scale.name==='world'?0:75));await idle(map);
    await updateScene(map,root,scale.span);
    await map.getSource('marker').setData({type:'FeatureCollection',features:[{...markerFeature(root),geometry:{type:'Point',coordinates:lngLat([scale.span*.32,0],root)}}]});
    await rendered(map,['occluder','marker']);
    const pose=metricCameraPose(root,{center:[map.getCenter().lng,map.getCenter().lat],zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch()});
    const samples=[[0,0],[scale.span*.17,scale.span*.11],[-scale.span*.13,-scale.span*.07]];
    const roundTrips=samples.map(meters=>{const screen=map.project(lngLat(meters,root)),back=map.unproject(screen),decoded=metricPoint(root,[back.lng,back.lat]);return {meters,errorM:[decoded.x-meters[0],decoded.y-meters[1]]};});
    const maxRoundTripM=Math.max(...roundTrips.map(row=>Math.hypot(...row.errorM)));
    const markerScreen=map.project(lngLat([scale.span*.32,0],root));
    const markerExactQuery=queryRenderedFeaturesMetricSafe(map,[markerScreen.x,markerScreen.y],{layers:['maplibre-marker-layer']});
    const markerHits=markerExactQuery.features;
    const markerNegativeQuery=queryRenderedFeaturesMetricSafe(map,[markerScreen.x+20,markerScreen.y],{layers:['maplibre-marker-layer']});
    const markerBounds=[[markerScreen.x-16,markerScreen.y-16],[markerScreen.x+16,markerScreen.y+16]];
    const markerBoundsHits=map.queryRenderedFeatures(markerBounds,{layers:['maplibre-marker-layer']});
    const markerSourceHits=map.querySourceFeatures('marker');
    const markerPixel=readPixel(map.getCanvas().getContext('webgl2'),map.getCanvas(),markerScreen);
    const markerOccluderHits=map.queryRenderedFeatures([markerScreen.x,markerScreen.y],{layers:['maplibre-occluder-layer']});
    results.projectionVisuals.push({name:scale.name,dataUrl:map.getCanvas().toDataURL()});
    const occluderHits=map.queryRenderedFeatures(map.project(lngLat([0,0],root)),{layers:['maplibre-occluder-layer']});
    const canvasRect=map.getCanvas().getBoundingClientRect();
    const markerInViewport=markerScreen.x>=0&&markerScreen.y>=0&&markerScreen.x<canvasRect.width&&markerScreen.y<canvasRect.height;
    rows.push({name:scale.name,spanM:scale.span,zoom,bearing:map.getBearing(),pitch:map.getPitch(),roundTrips,maxRoundTripM,
      maplibrePick:markerHits[0]?.properties?.id??null,maplibreOccluderFeature:occluderHits[0]?.properties?.id??null,
      markerScreen,markerInViewport,markerPixel,markerExactQueryScale:{raw:markerExactQuery.rawScale,adapted:markerExactQuery.adaptedScale,farZ:markerExactQuery.farZ,cameraDistance:markerExactQuery.cameraDistance,
        restored:markerExactQuery.restored,negativeHitIds:markerNegativeQuery.features.map(hit=>hit.properties?.id??null),negativeRestored:markerNegativeQuery.restored},
      markerBoundsHits:markerBoundsHits.map(hit=>({id:hit.properties?.id,geometry:hit.geometry?.type})),
      markerSourceHits:markerSourceHits.map(hit=>({id:hit.properties?.id,geometry:hit.geometry,source:hit.source,sourceLayer:hit.sourceLayer})),
      markerOccluderHits:markerOccluderHits.map(hit=>hit.properties?.id),metersPerPixel:metersPerPixel(root.size,zoom),cameraPose:pose});
  }
  return rows;
}
function matrixPoint(matrix,[x,y,z]){
  const v=[x,y,z,1],out=[0,0,0,0];
  for(let row=0;row<4;row++)for(let col=0;col<4;col++)out[row]+=matrix[col*4+row]*v[col];
  return {x:(out[0]/out[3]+1)*width/2,y:(1-out[1]/out[3])*852/2,z:out[2]/out[3],w:out[3]};
}
function deckViewBridgeContract(){
  return {adapter:'src/app/atlas-maplibre-bridge.ts',instanceOwned:true,
    matrixSource:'MapLibre defaultProjectionData.mainMatrix, with view=inverse(P)*mainMatrix*T(fixed scene origin) and original projection P.',
    capturedMapLibreMatrix:!!currentFrame(),sharedGlObject:!!diagnosticGl};
}
function readPixel(gl,canvas,point){
  const rect=canvas.getBoundingClientRect();
  if(!point||point.x<0||point.y<0||point.x>=rect.width||point.y>=rect.height)return null;
  const x=Math.min(canvas.width-1,Math.round(point.x*canvas.width/rect.width)),y=canvas.height-1-Math.min(canvas.height-1,Math.round(point.y*canvas.height/rect.height));
  const pixel=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return Array.from(pixel);
}
function pixelDelta(a,b){return !a||!b?Infinity:Math.max(...a.slice(0,3).map((channel,index)=>Math.abs(channel-b[index])));}
function localPickToMeters(pick,root,focus){
  const c=pick?.coordinate;
  if(!Array.isArray(c)||c.length<2)return null;
  return {x:focus[0]+c[0]*root,y:focus[1]+c[1]*root,z:(c[2]??0)*root};
}
function queryRenderedFeaturesMetricSafe(map,geometry,options){
  return queryMetricFeatures(map,geometry,options,maplibre.getVersion());
}
async function tryDeckOverlay(map){
  const gl=map.getCanvas().getContext('webgl2');
  results.integration.push({check:'map-webgl2',passed:!!gl,contextType:gl?.constructor?.name??null,depthBits:gl?.getParameter(gl.DEPTH_BITS)??null});
  let defaultOverlay;
  try{defaultOverlay=new MapLibreOverlay({interleaved:true,layers:deckLayers(scales[0].span)});map.addControl(defaultOverlay);
    results.integration.push({check:'pinned-default-view-overlay',passed:true});
  }catch(error){results.integration.push({check:'pinned-default-view-overlay',passed:false,error:String(error),stack:error?.stack??null});
    try{defaultOverlay?.finalize();}catch{}}
  let injectedOverlay;
  try{
    const attached=await attachBridge(map,initialRoot,deckLayers(scales[0].span));
    injectedOverlay=attached.overlay;
    results.integration.push({check:'pinned-styledata-guard-adapter',passed:true,deckVersion:'9.4.0',maplibreVersion:'6.15.0',
      module:'src/app/atlas-maplibre-bridge.ts',instanceOwned:true});
    const deckGl=injectedOverlay._deck?.device?.gl??injectedOverlay._deck?.device?.handle;
    results.integration.push({check:'caller-view-overlay',passed:injectedOverlay.getCanvas()===map.getCanvas()&&deckGl===gl,sharedCanvas:injectedOverlay.getCanvas()===map.getCanvas(),
      mapWebgl2:gl instanceof WebGL2RenderingContext,deckUsesSameWebgl2:deckGl===gl,deckContextType:deckGl?.constructor?.name??null,
      pickingApi:['pickObject','pickObjects','pickMultipleObjects'].every(name=>typeof injectedOverlay[name]==='function')});
    await frames();
    const measured=results.fiveScaleDeckMeasurements=[];
    results.stage='five-scale-deck-measurements';
    for(const scale of scales){
      results.stage=`five-scale-deck-${scale.name}`;
      map.jumpTo({center:lngLat([0,0],initialRoot),zoom:cameraZoom(initialRoot.size,scale.span),bearing:137,pitch:scale.name==='world'?0:75});
      await updateScene(map,initialRoot,scale.span);
      injectedOverlay.setProps({layers:deckLayers(scale.span)});await rendered(map,['occluder']);
      const visibleRoof=matrixPoint(currentFrame().mainMatrix,[.5+scale.span*.32/initialRoot.size,.5,.12*scale.span/initialRoot.size]);
      const hiddenRoof=matrixPoint(currentFrame().mainMatrix,[.5,.5,.05*scale.span/initialRoot.size]);
      const visiblePick=injectedOverlay.pickObject({x:visibleRoof.x,y:visibleRoof.y,radius:3,unproject3D:true});
      const hiddenPick=injectedOverlay.pickObject({x:hiddenRoof.x,y:hiddenRoof.y,radius:3,unproject3D:true});
      const viewport=injectedOverlay._deck.getViewports().find(item=>item.id==='maplibre');
      const visibleLocal=[scale.span*.32/initialRoot.size,0,.12*scale.span/initialRoot.size];
      const projected=viewport?.project(visibleLocal),unprojected=projected&&viewport.unproject(projected);
      const viewTransformErrorPx=projected?Math.hypot(projected[0]-visibleRoof.x,projected[1]-visibleRoof.y):Infinity;
      const viewRoundTripError=unprojected?Math.hypot(unprojected[0]-visibleLocal[0],unprojected[1]-visibleLocal[1],unprojected[2]-visibleLocal[2]):Infinity;
      map.triggerRepaint();await rendered(map);
      const visiblePixel=readPixel(gl,map.getCanvas(),visibleRoof),hiddenPixel=readPixel(gl,map.getCanvas(),hiddenRoof);
      const layerOrder=map.getLayersOrder(),deckGroupIds=layerOrder.filter(id=>id.startsWith('deck-maplibre-layer-group'));
      const deckGroupAfterOccluder=deckGroupIds.some(id=>layerOrder.indexOf(id)>layerOrder.indexOf('maplibre-occluder-layer'));
      const maplibreOccluderAtVisiblePixel=map.queryRenderedFeatures([visibleRoof.x,visibleRoof.y],{layers:['maplibre-occluder-layer']}).length>0;
      const maplibreOccluderAtHiddenPixel=map.queryRenderedFeatures([hiddenRoof.x,hiddenRoof.y],{layers:['maplibre-occluder-layer']}).length>0;
      map.setLayoutProperty('maplibre-occluder-layer','visibility','none');map.triggerRepaint();await rendered(map);
      const hiddenPixelWithoutOccluder=readPixel(gl,map.getCanvas(),hiddenRoof),visiblePixelWithoutOccluder=readPixel(gl,map.getCanvas(),visibleRoof);
      map.setLayoutProperty('maplibre-occluder-layer','visibility','visible');map.triggerRepaint();await rendered(map);
      const hiddenPixelRestored=readPixel(gl,map.getCanvas(),hiddenRoof);
      const visibleDeckWorld=localPickToMeters(visiblePick,initialRoot.size,[0,0]),hiddenDeckWorld=localPickToMeters(hiddenPick,initialRoot.size,[0,0]);
      const rect=map.getCanvas().getBoundingClientRect();
      measured.push({scale:scale.name,zoom:map.getZoom(),visibleRoof,hiddenRoof,
        visibleInViewport:visibleRoof.w>0&&visibleRoof.z>=-1&&visibleRoof.z<=1&&visibleRoof.x>=0&&visibleRoof.y>=0&&visibleRoof.x<rect.width&&visibleRoof.y<rect.height,
        hiddenInViewport:hiddenRoof.w>0&&hiddenRoof.z>=-1&&hiddenRoof.z<=1&&hiddenRoof.x>=0&&hiddenRoof.y>=0&&hiddenRoof.x<rect.width&&hiddenRoof.y<rect.height,
        deckVisiblePick:visiblePick?.object?.properties?.id??null,deckHiddenPick:hiddenPick?.object?.properties?.id??null,
        visibleDeckWorld,hiddenDeckWorld,viewTransformErrorPx,viewRoundTripError,cameraPosition:Array.from(viewport?.cameraPosition??[]),
        maplibreOccluderVisible:map.queryRenderedFeatures(map.project(lngLat([0,0])),{layers:['maplibre-occluder-layer']}).length>0,
        deckGroupIds,layerOrder,deckGroupAfterOccluder,maplibreOccluderAtVisiblePixel,maplibreOccluderAtHiddenPixel,
        visiblePixel,hiddenPixel,hiddenPixelWithoutOccluder,hiddenPixelRestored,visiblePixelWithoutOccluder,
        hiddenOcclusionDelta:pixelDelta(hiddenPixel,hiddenPixelWithoutOccluder),hiddenRestoreDelta:pixelDelta(hiddenPixel,hiddenPixelRestored),
      visibleStabilityDelta:pixelDelta(visiblePixel,visiblePixelWithoutOccluder)});
      results.fiveScaleDeckMeasurements=measured;
    }
    map.jumpTo({center:lngLat([0,0],initialRoot),zoom:cameraZoom(initialRoot.size,scales[3].span),bearing:0,pitch:0});await rendered(map);
    const atBearing0=map.project(lngLat([scales[3].span*.2,0]));
    map.jumpTo({bearing:360});await rendered(map);
    const atBearing360=map.project(lngLat([scales[3].span*.2,0],initialRoot));
    results.integration.push({check:'rotation-360-wrap',passed:map.getBearing()===0&&Math.hypot(atBearing0.x-atBearing360.x,atBearing0.y-atBearing360.y)<1e-6,
      requestedBearing:360,observedBearing:map.getBearing(),screenDeltaPx:Math.hypot(atBearing0.x-atBearing360.x,atBearing0.y-atBearing360.y)});
    const panScale=scales[3],panZoom=cameraZoom(initialRoot.size,panScale.span),panLayers=deckLayers(panScale.span),panGeometry=JSON.stringify(panLayers[0].props.data);
    injectedOverlay.setProps({layers:panLayers});map.jumpTo({center:lngLat([150,-100],initialRoot),zoom:panZoom-1,bearing:137,pitch:75});await rendered(map,['occluder']);
    const panViewport=injectedOverlay._deck.getViewports().find(item=>item.id==='maplibre');
    const canonicalWorldPoint=[panScale.span*.32,0,0],panLocalPoint=[panScale.span*.32/initialRoot.size,0,0];
    const panDeckPoint=panViewport?.project(panLocalPoint),panMapPoint=map.project(lngLat(canonicalWorldPoint,initialRoot));
    const panScreenErrorPx=panDeckPoint?Math.hypot(panDeckPoint[0]-panMapPoint.x,panDeckPoint[1]-panMapPoint.y):Infinity;
    results.integration.push({check:'pan-zoom-preserves-fixed-deck-world-geometry',passed:panScreenErrorPx<.1&&JSON.stringify(panLayers[0].props.data)===panGeometry&&activeBridge.sceneOrigin.x===0&&activeBridge.sceneOrigin.y===0,
      panCenterM:[150,-100],sceneOriginM:activeBridge.sceneOrigin,panScreenErrorPx,deckLocalPoint:panLocalPoint,mapLibreWorldPoint:canonicalWorldPoint,
      semantics:'The camera pans and zooms while the Deck layer data and explicit scene origin remain unchanged; its projected canonical point must continue to match MapLibre.'});
    const groupReloadStart=performance.now();results.stage='full-style-reload';
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('MapLibre full style reload timeout')),45_000);map.once('style.load',()=>{clearTimeout(timer);resolve();});map.setStyle(map.getStyle(),{diff:false});});
    await activeBridge.waitForStyleReconciliation();
    await rendered(map,['occluder','marker']);
    const groupOrder=map.getLayersOrder(),groupCount=groupOrder.filter(id=>id==='deck-maplibre-layer-group-last').length;
    const groupAfterMapLibre=groupOrder.indexOf('deck-maplibre-layer-group-last')>groupOrder.indexOf('maplibre-occluder-layer');
    results.stage='style-reload-layer-group-reconciliation';
    results.integration.push({check:'style-reload-layer-group-reconciliation',passed:groupCount===1&&groupAfterMapLibre&&!!currentFrame()&&map.getLayer('deck-maplibre-layer-group-last')!=null,
      elapsedMs:performance.now()-groupReloadStart,groupCount,groupAfterMapLibre,groupOrder,diagnosticFrameCaptured:!!currentFrame(),
      adapter:'version-guarded _handleStyleChange calls public setProps to retain resolveMapLibreLayerGroups'});
    const pickWorldPass=measured.every(row=>{const s=scales.find(item=>item.name===row.scale);return row.visibleDeckWorld&&row.hiddenDeckWorld&&row.visibleInViewport&&row.hiddenInViewport&&
      Math.abs(row.visibleDeckWorld.x-s.span*.32)<s.span*.12&&Math.abs(row.visibleDeckWorld.y)<s.span*.12&&
      Math.abs(row.hiddenDeckWorld.x)<s.span*.12&&Math.abs(row.hiddenDeckWorld.y)<s.span*.12;});
    results.integration.push({check:'five-scale-deck-geometry-picking',passed:measured.every(row=>row.deckVisiblePick==='visible-room'&&row.deckHiddenPick==='hidden-room'&&row.viewTransformErrorPx<.1&&row.viewRoundTripError<1e-5)&&pickWorldPass,measured,pickWorldPass,
      semantics:'Deck pickObject reports Deck geometry picks independently of MapLibre occlusion; hidden-room IDs are not full-scene visible selection.'});
    results.integration.push({check:'cross-engine-shared-depth-pixel-proof',passed:measured.every(row=>row.deckGroupAfterOccluder&&row.maplibreOccluderAtHiddenPixel&&!row.maplibreOccluderAtVisiblePixel&&row.hiddenOcclusionDelta>40&&row.hiddenRestoreDelta<12&&row.visibleStabilityDelta<12),measured,
      note:'At each scale the MapLibre extrusion is toggled while sampling Deck roof pixels from the shared canvas. The MapLibre layer order and silhouette query must show the intended overlap, the covered Deck roof must change, the exposed roof must stay stable, and the covered pixel must restore.'});
    results.visualDataUrl=map.getCanvas().toDataURL();results.stage='complete';
    return injectedOverlay;
  }catch(error){
    results.failedStage=results.stage??'caller-view-overlay-initialization';
    try{results.visualDataUrl??=map.getCanvas().toDataURL();}catch{}
    results.integration.push({check:'caller-view-overlay',passed:false,error:String(error),stack:error?.stack??null,
      note:'The caller-supplied view path was attempted; this records the actual failure point without inferring a successful render.'});
    try{injectedOverlay?.finalize();}catch{}
    results.integration.push({check:'five-scale-deck-geometry-picking',passed:false,status:'failed',reason:`Probe aborted at ${results.failedStage}; partial measurements are retained.`,measured:results.fiveScaleDeckMeasurements??[]},
      {check:'cross-engine-shared-depth-pixel-proof',passed:false,status:'failed',reason:`Probe aborted at ${results.failedStage}; partial measurements are retained.`,measured:results.fiveScaleDeckMeasurements??[]});
    return null;
  }
}
async function rootExpansion(map){
  const expanded=initialRootM*4,checks=[],deckChecks=[];
  results.rootExpansion={passed:false,checks,deckChecks,stage:'starting'};
  const expandedName='atlas:metres-expanded';
  const from=initialRoot,to={x:from.x,y:from.y,size:expanded},focus=[100_000_000,1_000_000];
  registerCRS(expandedName,to);
  for(const scale of scales){
    const oldZoom=cameraZoom(from.size,scale.span),newZoom=oldZoom+2,z=16,tilt=scale.name==='world'?0:75;
    const tileMeters={x:from.x+from.size*.2,y:from.y+from.size*.3};
    const oldTile=[Math.floor((tileMeters.x-from.x)/from.size*2**z),Math.floor((tileMeters.y-from.y)/from.size*2**z)];
    const translated=translateMetricTile({z,x:oldTile[0],y:oldTile[1]},from,to);
    const row={scale:scale.name,oldZoom,newZoom,rootGrowthRatio:expanded/initialRootM,oldTile,translatedTile:translated,
      tileAddressPreserved:translated.z===z+2&&translated.x===oldTile[0]&&translated.y===oldTile[1],
      metersPerPixelPreserved:Math.abs(metersPerPixel(from.size,oldZoom)-metersPerPixel(expanded,newZoom))<1e-9,
      oldRootBoundsM:[from.x,from.y,from.x+from.size,from.y+from.size],focusBeyondOldRootM:focus};
    if(map){disposeBridge();map.remove();map=null;}
    map=makeMap(document.querySelector('#map'),'atlas:metres',from);await idle(map);
    map.jumpTo(camera(from,focus,scale.span,137,tilt));await idle(map);
    const oldCenter=map.getCenter(),oldFocus=metricPoint(from,[oldCenter.lng,oldCenter.lat]);
    row.oldRootCanCenterAtFocus=Math.hypot(oldFocus.x-focus[0],oldFocus.y-focus[1])<1;
    map.remove();map=null;
    map=makeMap(document.querySelector('#map'),expandedName,to);await idle(map);
    map.jumpTo(camera(to,focus,scale.span,137,tilt));await idle(map);
    const newCenter=map.getCenter(),newFocus=metricPoint(to,[newCenter.lng,newCenter.lat]);
    row.expandedRootCanCenterAtFocus=Math.hypot(newFocus.x-focus[0],newFocus.y-focus[1])<1;
    const pose=metricCameraPose(to,{center:[newCenter.lng,newCenter.lat],zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch()});
    row.cameraPosePreserved=map.getBearing()===137&&map.getPitch()===tilt&&Math.abs(pose.metersPerPixel-metersPerPixel(expanded,newZoom))<1e-9;
    row.passes=row.tileAddressPreserved&&row.metersPerPixelPreserved&&!row.oldRootCanCenterAtFocus&&row.expandedRootCanCenterAtFocus&&row.cameraPosePreserved;
    checks.push(row);
    results.rootExpansion.checks=checks;results.rootExpansion.stage=`map-expansion-${scale.name}`;

    await updateScene(map,to,scale.span,focus);
    await rendered(map,['occluder']);
    const {overlay}=await attachBridge(map,to,deckLayers(scale.span,expanded),{x:focus[0],y:focus[1]},['occluder']);
    const rootX=(focus[0]-to.x)/expanded,rootY=(focus[1]-to.y)/expanded;
    const visibleRoof=matrixPoint(currentFrame().mainMatrix,[rootX+scale.span*.32/expanded,rootY,.12*scale.span/expanded]);
    const hiddenRoof=matrixPoint(currentFrame().mainMatrix,[rootX,rootY,.05*scale.span/expanded]);
    const visiblePick=overlay.pickObject({x:visibleRoof.x,y:visibleRoof.y,radius:3,unproject3D:true}),hiddenPick=overlay.pickObject({x:hiddenRoof.x,y:hiddenRoof.y,radius:3,unproject3D:true});
    const viewport=overlay._deck.getViewports().find(item=>item.id==='maplibre'),visibleLocal=[scale.span*.32/expanded,0,.12*scale.span/expanded];
    const projected=viewport?.project(visibleLocal),unprojected=projected&&viewport.unproject(projected);
    const viewTransformErrorPx=projected?Math.hypot(projected[0]-visibleRoof.x,projected[1]-visibleRoof.y):Infinity;
    const viewRoundTripError=unprojected?Math.hypot(unprojected[0]-visibleLocal[0],unprojected[1]-visibleLocal[1],unprojected[2]-visibleLocal[2]):Infinity;
    map.triggerRepaint();await rendered(map);
    const gl=map.getCanvas().getContext('webgl2'),visiblePixel=readPixel(gl,map.getCanvas(),visibleRoof),hiddenPixel=readPixel(gl,map.getCanvas(),hiddenRoof);
    const maplibreOccluderAtVisiblePixel=map.queryRenderedFeatures([visibleRoof.x,visibleRoof.y],{layers:['maplibre-occluder-layer']}).length>0;
    const maplibreOccluderAtHiddenPixel=map.queryRenderedFeatures([hiddenRoof.x,hiddenRoof.y],{layers:['maplibre-occluder-layer']}).length>0;
    map.setLayoutProperty('maplibre-occluder-layer','visibility','none');map.triggerRepaint();await rendered(map);
    const hiddenPixelWithoutOccluder=readPixel(gl,map.getCanvas(),hiddenRoof),visiblePixelWithoutOccluder=readPixel(gl,map.getCanvas(),visibleRoof);
    map.setLayoutProperty('maplibre-occluder-layer','visibility','visible');map.triggerRepaint();await rendered(map);
    const hiddenPixelRestored=readPixel(gl,map.getCanvas(),hiddenRoof);
    const visibleDeckWorld=localPickToMeters(visiblePick,expanded,focus),hiddenDeckWorld=localPickToMeters(hiddenPick,expanded,focus);
    const layerOrder=map.getLayersOrder(),deckGroupIds=layerOrder.filter(id=>id.startsWith('deck-maplibre-layer-group')),
      deckGroupAfterOccluder=deckGroupIds.some(id=>layerOrder.indexOf(id)>layerOrder.indexOf('maplibre-occluder-layer'));
    const local125=Math.fround(.125/expanded),local250=Math.fround(.25/expanded),global125=Math.fround(rootX+.125/expanded),globalOrigin=Math.fround(rootX);
    const localMvp=currentFrame().mainMatrix.slice();
    for(let r=0;r<4;r++)localMvp[12+r]+=currentFrame().mainMatrix[r]*rootX+currentFrame().mainMatrix[4+r]*rootY;
    const localPrecisionShiftPx=Math.hypot(matrixPoint(localMvp,[local125,0,0]).x-matrixPoint(localMvp,[local250,0,0]).x,
      matrixPoint(localMvp,[local125,0,0]).y-matrixPoint(localMvp,[local250,0,0]).y);
    const rect=map.getCanvas().getBoundingClientRect();
    const visibleInViewport=visibleRoof.w>0&&visibleRoof.z>=-1&&visibleRoof.z<=1&&visibleRoof.x>=0&&visibleRoof.y>=0&&visibleRoof.x<rect.width&&visibleRoof.y<rect.height;
    const hiddenInViewport=hiddenRoof.w>0&&hiddenRoof.z>=-1&&hiddenRoof.z<=1&&hiddenRoof.x>=0&&hiddenRoof.y>=0&&hiddenRoof.x<rect.width&&hiddenRoof.y<rect.height;
    deckChecks.push({scale:scale.name,focusM:focus,deckVisiblePick:visiblePick?.object?.properties?.id??null,deckHiddenPick:hiddenPick?.object?.properties?.id??null,
      visibleRoof,hiddenRoof,visibleInViewport,hiddenInViewport,
      visibleDeckWorld,hiddenDeckWorld,viewTransformErrorPx,viewRoundTripError,cameraPosition:Array.from(viewport?.cameraPosition??[]),
      visiblePixel,hiddenPixel,hiddenPixelWithoutOccluder,hiddenPixelRestored,visiblePixelWithoutOccluder,
      hiddenOcclusionDelta:pixelDelta(hiddenPixel,hiddenPixelWithoutOccluder),hiddenRestoreDelta:pixelDelta(hiddenPixel,hiddenPixelRestored),visibleStabilityDelta:pixelDelta(visiblePixel,visiblePixelWithoutOccluder),
      maplibreOccluderAtVisiblePixel,maplibreOccluderAtHiddenPixel,deckGroupAfterOccluder,deckGroupIds,layerOrder,
      deckGroupIndices:deckGroupIds.map(id=>({id,index:layerOrder.indexOf(id),layer:map.getLayer(id)?{type:map.getLayer(id).type,beforeId:map.getLayer(id).beforeId}:null})),
      local125mAnd250mDistinct:local125!==local250,globalOriginLoses125m:global125===globalOrigin,localPrecisionShiftPx,adapterViewId:overlay._deck?.getViewports()?.map(view=>view.id)});
    results.rootExpansion.deckChecks=deckChecks;results.rootExpansion.stage=`deck-expansion-${scale.name}`;
    if(scale.name==='interior')results.visualDataUrl=map.getCanvas().toDataURL();
    disposeBridge();
  }
  results.rootExpansion={passed:checks.every(c=>c.passes)&&deckChecks.every(c=>c.deckVisiblePick==='visible-room'&&c.deckHiddenPick==='hidden-room'&&c.visibleInViewport&&c.hiddenInViewport&&c.deckGroupAfterOccluder&&c.maplibreOccluderAtHiddenPixel&&!c.maplibreOccluderAtVisiblePixel&&c.hiddenOcclusionDelta>40&&c.hiddenRestoreDelta<12&&c.visibleStabilityDelta<12&&c.viewTransformErrorPx<.1&&c.viewRoundTripError<1e-5&&c.local125mAnd250mDistinct&&c.globalOriginLoses125m),checks,deckChecks,stage:'complete',
    policy:'Recreate the map on a power-of-two root four times larger, preserve its old top-left origin, translate tiles dyadically, preserve camera pose and scale, and reattach Deck at a 100 Mm focus. Deck features use scene-local meters normalized on CPU before Float32 upload.'};
  return map;
}
window.runAtlasMapLibreInterop=async()=>{
  const projection='atlas:metres';
  await initializeAtlasMapLibre();
  results.workerSetup={workerUrl:maplibre.getWorkerUrl(),workerPoolSetupBeforeProjectionHandler:true};
  registerCRS(projection,initialRoot);
  let map=makeMap(document.querySelector('#map'),projection,initialRoot);
  try{
    await idle(map);addProjectionDiagnostic(map);await idle(map);
    results.scales=await projectionSweep(map,initialRoot);
    results.scaleProjectionPassed=results.scales.every(s=>s.maxRoundTripM<.01);
    results.scaleMaplibrePickingPassed=results.scales.every(s=>s.maplibrePick==='maplibre-marker'&&s.markerInViewport&&
      Number.isFinite(s.markerExactQueryScale?.raw)&&Number.isFinite(s.markerExactQueryScale?.adapted)&&s.markerExactQueryScale.adapted>0&&
      s.markerExactQueryScale.restored&&s.markerExactQueryScale.negativeRestored&&s.markerExactQueryScale.negativeHitIds.length===0);
    results.maplibreOccluderVisibleAtAllScales=results.scales.every(s=>s.maplibreOccluderFeature==='maplibre-occluder');
    results.adapterSeam=deckViewBridgeContract();
    results.sourceLimits={mapMaximumZoom:map.getMaxZoom(),demMaxZoom:24,geojsonMaxZoom:24,
      requestedZooms:results.scales.map(scale=>({scale:scale.name,zoom:scale.zoom,demExceedsMaxzoom:scale.zoom>24,geojsonExceedsMaxzoom:scale.zoom>24})),
      note:'MapLibre can set a map maxZoom above 24; raster source maxzoom controls DEM detail. @maplibre/geojson-vt rejects maxZoom above 24. Overzooming above source maxzoom does not add spatial precision.'};
    map.setTerrain({source:'demElevated',exaggeration:1});await idle(map);
    const terrainElevationM=map.queryTerrainElevation(map.getCenter(),{exaggerated:false});
    results.terrainMetreContract={terrainElevationM,expectedM:450,toleranceM:.01,mapboxRgbDecodeExpected:'round((height + 10000) * 10)',passed:Number.isFinite(terrainElevationM)&&Math.abs(terrainElevationM-450)<.01};
    map.setTerrain(null);await idle(map);
    const overlay=await tryDeckOverlay(map);
    results.remainingProductWork='Instance-owned adapter, real scene connection, visible-scene selection, local font/icon pipeline and complete M1 product acceptance remain open.';
    map=await rootExpansion(map);
    return results;
  }catch(error){errors.push(error?.stack??String(error));throw error;}
  finally{disposeBridge();map?.remove();}
};
window.__atlasMapLibreInteropReady=true;

// The native driver sends real mouse/wheel input. These hooks only prepare the
// fixture and observe the resulting camera; they never simulate its gestures.
let gestureFixture=null;
window.prepareAtlasMetricGestureProbe=async()=>{
  const root=initialRoot,span=3000;
  const map=makeMap(document.querySelector('#map'),'atlas:metres',root);
  await idle(map);addProjectionDiagnostic(map);await rendered(map);
  map.jumpTo(camera(root,[0,0],span,0,0));
  await updateScene(map,root,span);await rendered(map,['occluder','marker']);
  const {bridge,overlay}=await attachBridge(map,root,deckLayers(span));
  const trusted={pointerdown:0,pointermove:0,wheel:0};
  const canvas=map.getCanvas();
  const listeners=Object.keys(trusted).map(type=>{
    const listener=event=>{if(event.isTrusted)trusted[type]++;};
    canvas.addEventListener(type,listener);return [type,listener];
  });
  gestureFixture={map,bridge,overlay,root,span,trusted,listeners};
};
window.observeAtlasMetricGesture=async(point)=>{
  const f=gestureFixture;if(!f)throw Error('Gesture fixture is not prepared');
  await rendered(f.map);
  const map=f.map,back=map.unproject(point),world=metricPoint(f.root,[back.lng,back.lat]);
  const fixedWorld=[f.span*.32,0],screen=map.project(lngLat(fixedWorld,f.root));
  const viewport=f.overlay._deck.getViewports().find(v=>v.id==='maplibre');
  const deckScreen=viewport.project([fixedWorld[0]/f.root.size,0,0]);
  const rect=map.getCanvas().getBoundingClientRect();
  return {center:metricPoint(f.root,[map.getCenter().lng,map.getCenter().lat]),zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch(),
    moving:map.isMoving(),worldAtPointer:world,point,screen:{x:screen.x,y:screen.y},deckScreen,
    projectionErrorPx:Math.hypot(screen.x-deckScreen[0],screen.y-deckScreen[1]),
    viewport:{width:rect.width,height:rect.height,deckWidth:viewport.width,deckHeight:viewport.height},trusted:{...f.trusted}};
};
window.atlasMetricGestureSettled=()=>gestureFixture&&!gestureFixture.map.isMoving();
window.projectAtlasMetricGesturePoint=world=>{
  const f=gestureFixture;return f.map.project(metricLngLat(f.root,world));
};
window.finishAtlasMetricGestureProbe=()=>{
  const f=gestureFixture;if(!f)return;
  for(const [type,listener] of f.listeners)f.map.getCanvas().removeEventListener(type,listener);
  f.bridge.dispose();activeBridge=null;f.map.remove();gestureFixture=null;
};
