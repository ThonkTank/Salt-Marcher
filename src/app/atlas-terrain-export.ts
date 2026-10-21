import type {AtlasRenderView} from './campaign-atlas-contracts';
import type {TerrainView} from './terrain-spatial-model';
import type {AtlasPaint} from './atlas-paint';
import {atlasPaint} from './atlas-paint';
import {terrainObjectSources} from './terrain-objects';
import {terrainImage,publicTerrainImage} from './terrain-image';
import {publicAtlasPaint} from './campaign-atlas-export';
import {atlasRegionPaint} from './atlas-region-export';
import {drawTerritories,MapLabelLayout,paintMapLabels,measureMapText} from './atlas-cartography';

/** Capture from an immutable, fenced region with the same perspective renderer as the editor. */
export async function atlasTerrainExport(token:string,snapshot:AtlasRenderView,view:TerrainView,options:{
  audience:'gm'|'public';width:number;height:number;format:'png'|'jpeg';references:boolean;
  grid:boolean;level:string;floorId:string;roofs:boolean;contours:number;overlay?:AtlasPaint;
},current:()=>boolean,progress:(done:number,total:number)=>void){
  const check=()=>{if(!current())throw Error('Atlas-Ausgabe abgebrochen.');};check();
  const {width,height,format,overlay}=options;
  if(options.audience==='public'){
    const reply=await window.campaign.playerView(token);if(!reply.ok)throw Error(reply.error);check();
    return publicTerrainImage(publicAtlasPaint(snapshot,view.box,reply.value.frame),reply.value.frame,view,width,height,format,current,progress,overlay);
  }
  const layer=snapshot.region?.landscape;
  if(!layer||layer.state!=='ready'||!layer.coverage.complete)throw Error(layer?.error??'Landschaftsausgabe nicht vollständig. Erneut laden.');
  const objects=terrainObjectSources(snapshot,{mpp:view.frame.width/width,roofs:options.roofs,scopeId:snapshot.region?.scopeId??null});
  const projection=await window.campaign.atlasTerrainProjection(token,{revision:snapshot.revision,fence:snapshot.region!.fence,view,width:1024,height:Math.max(16,Math.min(1024,Math.round(1024*view.box.height/view.box.width))),detail:view.refinement,detailResolution:view.refinement?1024:undefined,objects,contours:0,displayMpp:view.frame.width/width},'export');
  if(!projection.ok)throw Error(projection.error);check();
  if(projection.value.revision!==snapshot.revision||projection.value.fence!==snapshot.region!.fence)throw Error('Atlas wurde während der Ausgabe geändert. Erneut ausgeben.');
  const assets=new Map<string,string>();
  if(options.references)for(const r of layer.records)if(r.assetId&&!assets.has(r.assetId)){
    const image=await window.campaign.referenceAssetPreview(token,r.assetId,2048);if(!image.ok)throw Error(image.error);check();assets.set(r.assetId,image.value);
  }
  // Ground and 3D routes come from the projection; existing vector author objects stay crisp.
  const records=layer.records.filter(r=>!['patch','road','river'].includes(r.kind));
  // Dense layers carry automatic vegetation in object tiles rather than vector
  // records. Keep those tiles; only the ground raster belongs to the projection.
  const scene=atlasRegionPaint(snapshot,records,view.box,width*view.box.width/view.frame.width,assets,{...options,rasters:layer.tiles.filter(tile=>tile.content==='objects'),automaticLabels:true});
  const raster=snapshot.region?.territoryRaster;if(raster)scene.append(atlasPaint('image',{source:raster.data,x:raster.box.x-view.box.x,y:raster.box.y-view.box.y,width:raster.box.width,height:raster.box.height,pointer:false}));
  if(snapshot.region?.territories)drawTerritories(scene,snapshot.region.territories,view.box,view.frame.width/width);
  const candidates=[...(snapshot.region?.labels??[]),...(layer.labels??[])];
  const labels=new MapLabelLayout().layout(candidates,view.frame,view.frame.width/width,measureMapText);
  paintMapLabels(scene,labels,view.box,view.frame.width/width,{candidates});
  return terrainImage({...projection.value,vegetation:layer.records},width,height,format,current,progress,overlay,scene,options.contours);
}
