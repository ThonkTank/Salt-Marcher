import type {VegetationScene} from '../src/app/vegetation';
import type {SpatialReply} from '../src/app/terrain-spatial-worker';
/** Historical fixture input adapted to the product renderer, never a second camera implementation. */
export function atlasPreviewScene(scene:VegetationScene,tilt=45,rotation=0,exaggeration=1):SpatialReply{
  const records=scene.records.map(r=>({...r}));
  for(const areaId of new Set(scene.instances.map(i=>i.areaId))){
    let record=records.find(r=>r.id===areaId);
    if(!record){record={id:areaId} as typeof records[number];records.push(record);}
    record.vegetationView={mode:record.vegetationView?.mode??'individual',instances:scene.instances.filter(i=>i.areaId===areaId)};
  }
  return {generation:1,source:'fixture',draft:false,width:scene.texture?.width??1,height:scene.texture?.height??1,
    pixels:scene.texture?new Uint8Array(scene.texture.pixels):new Uint8Array([238,229,207,255]),
    routes:records.filter(r=>r.kind==='road'||r.kind==='river'),vegetation:records.filter(r=>r.vegetationView),
    grid:{view:{projection:'perspective',box:scene.box,frame:scene.box,columns:scene.grid.columns,rows:scene.grid.rows,
      focusM:scene.grid.heights[Math.floor(scene.grid.heights.length/2)]!,tilt,rotation,exaggeration},heights:new Float32Array(scene.grid.heights),seaLevelM:0}};
}
