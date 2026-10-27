import {ATLAS_HORIZON_EXTENSION,atlasHorizonRange} from './atlas-horizon';
import {ATLAS_UNLIT_MATERIAL} from './atlas-deck-material';
import {terrainContourStep} from './terrain-contour-style';
import {terrainTraceMeasure} from './terrain-timing';
import {cartographicPhase} from './atlas-cartographic-style';
import {AtlasTerrainMaterialLayer,terrainMaterialTiming} from './atlas-terrain-material-layer';
import {atlasTerrainDisplayedGrid,type AtlasTerrainTileModel} from './atlas-terrain-tile-model';
import {DEFAULT_TERRAIN_STYLE,type TerrainStyle} from './terrain-relief';
import {Deck, COORDINATE_SYSTEM, type Color, type DeckProps, type Layer} from '@deck.gl/core';
import {SimpleMeshLayer} from '@deck.gl/mesh-layers';
import type {Device,Texture} from '@luma.gl/core';
import {atlasMetricFrame, atlasMetricClearanceVolume, AtlasMetricView, atlasMetricZoomAt, atlasMetricPanAt,
  type AtlasMetricCamera} from './atlas-metric-camera';
import {atlasCameraClearanceMargin} from './atlas-camera-navigation';
import {ensureAtlasDeckPickingDepth} from './atlas-deck-picking';
import type {AtlasDeckSceneModel, AtlasDeckSceneObject, AtlasDeckSelectionTarget} from './atlas-deck-scene-model';
import type {AtlasGeometryOverviewMesh} from './atlas-geometry-overview';
import {refineAtlasDeckRayHit} from './atlas-deck-ray';
import {createAtlasDeckLabels, type AtlasDeckLabel, type AtlasDeckLabels} from './atlas-deck-labels';
import {ATLAS_TERRAIN_FIELD_GPU,ATLAS_TERRAIN_PREPARED_GPU,ATLAS_TERRAIN_FIELD_UPLOAD_SCRATCH,AtlasTerrainFieldGpuOwner,AtlasTerrainFieldLayer,prepareAtlasTerrainFieldGeometry,preflightAtlasTerrainFieldPilotGpu,atlasTerrainFieldPlannedTables,atlasTerrainFieldLookupRetained,sameAtlasTerrainFieldSources,type AtlasTerrainFieldGeometry,type AtlasTerrainPreparedLayerGeometry,type AtlasTerrainFieldTables,type AtlasTerrainFieldPilotPreflight} from './atlas-terrain-field-presentation';
import {createAtlasTerrainFieldRayIndex,createAtlasTerrainPreparedRayIndex,type AtlasTerrainFieldRayIndex} from './atlas-mesh-ray';
import {terrainModelBytes,TERRAIN_MODEL_MEMORY} from './atlas-terrain-model-client';
import {terrainPreparedValidateResult,terrainPreparedView,terrainPreparedSameBasis,type TerrainPreparedBasis,type TerrainPreparedBinding,type TerrainPreparedCapture,type TerrainPreparedResult,type TerrainPreparedDisplaySource,type TerrainPreparedDraftSource,type TerrainPreparedScreen,type TerrainPreparedGeometry,type TerrainPreparedInventory} from './atlas-terrain-prepared-contract';
import {atlasWorldTileBounds} from './atlas-world-tiles';

export interface AtlasDeckHit {
  id: string;
  target: AtlasDeckSelectionTarget;
  point: {x: number; y: number; heightM: number} | null;
}
export interface AtlasDeckSurfaceOptions {
  container: HTMLElement;
  camera: AtlasMetricCamera;
  model: AtlasDeckSceneModel;
  labels?: readonly AtlasDeckLabel[];
  onCamera?: (camera: AtlasMetricCamera) => void;
  onError?: (error: Error) => void;
  /** Input owner retires frozen gestures before context recovery starts. */
  onContextLost?: () => void;
  timeoutMs?: number;
  /** Existing Workbench owns input when used through AtlasPresentation. */
  externalInput?:boolean;
  pixelRatio?:number;
  /** Output pixels per logical style pixel; independent of framebuffer density. */
  styleScale?:number;
  /** Unit-test seam; production always uses the pinned Deck runtime. */
  createDeck?: (props: DeckProps<AtlasMetricView[]>) => Deck<AtlasMetricView[]>;
}
type Frame = ReturnType<typeof atlasMetricFrame>;
type PreparedBasisOrigin={basis:TerrainPreparedBasis;target:TerrainPreparedBinding['target'];epoch:number;editSeries:number};
type PreparedField={basis:TerrainPreparedBasis;origin:PreparedBasisOrigin;draftRevision:number;source:TerrainPreparedGeometry;buffers:ReadonlyMap<number,ArrayBuffer>;ray:ReturnType<typeof createAtlasTerrainPreparedRayIndex>;submission:PreparedSubmission};
type TerrainFieldState={sourceGeometry:AtlasTerrainFieldGeometry;geometry:AtlasTerrainFieldGeometry;endFrameDraws?:AtlasTerrainFieldGeometry['draws'];ray:AtlasTerrainFieldRayIndex|null;rayOldModels:readonly AtlasTerrainTileModel[];rayNewModels:readonly AtlasTerrainTileModel[];rayDraftModels:readonly AtlasTerrainTileModel[];oldModels:readonly AtlasTerrainTileModel[];newModels:readonly AtlasTerrainTileModel[];draftModels:readonly AtlasTerrainTileModel[];oldBase:number;newBase:number;draftBase:number;slots:number[];tables:AtlasTerrainFieldTables;layerId:string;stateId?:number;prepared?:PreparedField};
type PreparedSubmission={result:TerrainPreparedResult;expected:TerrainPreparedBinding;capture:Pick<TerrainPreparedCapture,'id'|'editSeries'|'draftRevision'>;buffers:ReadonlyMap<number,ArrayBuffer>};
export interface AtlasTerrainPreparedEscape {readonly token:symbol;readonly screen:TerrainPreparedScreen}
export interface AtlasTerrainInputBinding {
  readonly generation:number;readonly basis:TerrainPreparedBasis;readonly epoch:number;readonly editSeries:number;
  readonly token:string;readonly pose:string;readonly origin:object;
}
const terrainInputPose=(frame:Frame)=>JSON.stringify([frame.camera.focus.x,frame.camera.focus.y,frame.camera.metersPerPixel,frame.camera.rotation,frame.camera.tilt,frame.camera.exaggeration,frame.width,frame.height]);
const PREPARED_EMPTY_F32=new Float32Array(0),PREPARED_EMPTY_U32=new Uint32Array(0);
/** Views share the validated immutable wire backing stores; no copied tile mesh. */
function preparedTile(source:TerrainPreparedDisplaySource|TerrainPreparedDraftSource,reference:TerrainPreparedDisplaySource,table:ReadonlyMap<number,ArrayBuffer>):AtlasTerrainTileModel{
  const material=source.material,height=source.height??reference.height;
  const f32=(view:typeof reference.height)=>terrainPreparedView(view,table) as Float32Array;
  const u8=(view:typeof material.texture)=>terrainPreparedView(view,table) as Uint8Array;
  const bound=atlasWorldTileBounds(reference),box={x:bound.minX,y:bound.minY,width:bound.sizeM,height:bound.sizeM};
  const object={id:`terrain-tile:${reference.lod}/${reference.x}/${reference.y}`,target:{kind:'terrain'} as const,origin:{x:bound.minX,y:bound.minY,heightM:0},positions:PREPARED_EMPTY_F32,indices:PREPARED_EMPTY_U32};
  const mesh={attributes:{POSITION:{size:3,value:PREPARED_EMPTY_F32},NORMAL:{size:3,value:PREPARED_EMPTY_F32},TEXCOORD_0:{size:2,value:PREPARED_EMPTY_F32}},indices:{size:1,value:PREPARED_EMPTY_U32}};
  const image=(view:typeof material.texture)=>({data:u8(view),width:256,height:256});
  return{grid:{view:{box,frame:box,columns:65,rows:65,focusM:0,tilt:0,rotation:0,exaggeration:1},heights:f32(height),seaLevelM:reference.seaLevelM},gridNormals:PREPARED_EMPTY_F32,object,bounds:{min:[bound.minX,bound.minY,0],max:[bound.maxX,bound.maxY,0]},mesh,data:[object],texture:image(material.texture),masks:image(material.masks),cover:image(material.cover),relief:image(material.relief)};
}
function preparedViewsEqual(a:TerrainPreparedDisplaySource,b:TerrainPreparedDisplaySource){
  const same=(x:{buffer:number;offset:number;length:number},y:{buffer:number;offset:number;length:number})=>x.buffer===y.buffer&&x.offset===y.offset&&x.length===y.length;
  return a.id===b.id&&a.lod===b.lod&&a.x===b.x&&a.y===b.y&&a.seaLevelM===b.seaLevelM&&
    a.source.token===b.source.token&&a.source.fence===b.source.fence&&a.source.revision===b.source.revision&&
    same(a.height,b.height)&&(['texture','masks','cover','relief'] as const).every(name=>same(a.material[name],b.material[name]));
}
/** A brush reuses and mutates its source views on the next input frame. Count
 * whole backing stores, then retain the exact five uploaded draft channels. */
function terrainDraftBuffers(models:readonly AtlasTerrainTileModel[]):ArrayBuffer[]{
  const buffers=new Set<ArrayBuffer>();
  for(const model of models)for(const view of [model.grid.heights,model.texture.data,model.masks.data,model.cover.data,model.relief.data]){
    if(!(view.buffer instanceof ArrayBuffer))throw Error('Terrainfeld-Draftbuffer nicht als ArrayBuffer bilanzierbar.');
    buffers.add(view.buffer);
  }
  return[...buffers];
}
function terrainDraftSnapshot(models:readonly AtlasTerrainTileModel[]):AtlasTerrainTileModel[]{
  const buffers=new Map<ArrayBuffer,ArrayBuffer>();
  const copied=(view:Uint8Array|Float32Array)=>{
    const source=view.buffer as ArrayBuffer;let buffer=buffers.get(source);
    if(!buffer){buffer=source.slice(0);buffers.set(source,buffer);}
    return view instanceof Float32Array?new Float32Array(buffer,view.byteOffset,view.length):new Uint8Array(buffer,view.byteOffset,view.length);
  };
  return models.map(model=>({...model,
    grid:{...model.grid,heights:copied(model.grid.heights) as Float32Array},
    texture:{...model.texture,data:copied(model.texture.data) as Uint8Array},
    masks:{...model.masks,data:copied(model.masks.data) as Uint8Array},
    cover:{...model.cover,data:copied(model.cover.data) as Uint8Array},
    relief:{...model.relief,data:copied(model.relief.data) as Uint8Array}
  }));
}
const colors: Record<AtlasDeckSelectionTarget['kind'], Color> = {
  terrain: [112, 142, 94, 255], building: [180, 125, 82, 255], room: [213, 180, 117, 255]
};
type SceneMesh = {attributes: {POSITION: {size: number; value: Float32Array}}; indices: {size: number; value: Uint32Array}};
const meshes = new WeakMap<AtlasDeckSceneObject, {mesh: SceneMesh; data: AtlasDeckSceneObject[]}>();
const overviewMeshes = new WeakMap<AtlasGeometryOverviewMesh, {mesh: SceneMesh; data: AtlasGeometryOverviewMesh[]}>();
const overviewColors: Record<AtlasGeometryOverviewMesh['kind'], Color> = {
  building: [153, 117, 89, 255], room: [189, 164, 123, 255]
};

/** Camera/origin changes only update instance transforms. Mesh and instance-data
 * identities survive; Deck retains the expensive geometry buffers. */
export function atlasDeckSceneLayers(model: AtlasDeckSceneModel, frame: Frame): Layer[] {
  const semanticLayers = model.objects.map(object => {
    let cached = meshes.get(object);
    if (!cached) {
      cached = {mesh: {attributes: {POSITION: {size: 3, value: object.positions}},
        indices: {size: 1, value: object.indices}}, data: [object]};
      meshes.set(object, cached);
    }
    return new SimpleMeshLayer<AtlasDeckSceneObject>({
      id: `atlas-scene:${object.id}`, data: cached.data, mesh: cached.mesh,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      getPosition: [object.origin.x - frame.origin.x, object.origin.y - frame.origin.y,
        (object.origin.heightM - frame.origin.z) * frame.camera.exaggeration],
      getScale: [1, 1, frame.camera.exaggeration],
      // Retained instance data does not invalidate multi-accessor transform
      // attributes. Explicit triggers update only those small attributes.
      updateTriggers: {
        getPosition: [frame.origin.x, frame.origin.y, frame.origin.z, frame.camera.exaggeration],
        getScale: frame.camera.exaggeration
      },
      getColor: colors[object.target.kind], material: ATLAS_UNLIT_MATERIAL, pickable: '3d',
      getPolygonOffset: () => [0, 0],
      parameters: {depthWriteEnabled: true, depthCompare: 'less-equal', cullMode: 'none'}
    });
  });
  const overviewLayers = (model.overviews ?? []).flatMap(overview => overview.meshes.map(object => {
    let cached = overviewMeshes.get(object);
    if (!cached) {
      cached = {mesh: {attributes: {POSITION: {size: 3, value: object.positions}},
        indices: {size: 1, value: object.indices}}, data: [object]};
      overviewMeshes.set(object, cached);
    }
    const {lod, x, y} = overview.tile;
    return new SimpleMeshLayer<AtlasGeometryOverviewMesh>({
      id: `atlas-overview:${lod}/${x}/${y}:${overview.resolution}:${object.id}`,
      data: cached.data, mesh: cached.mesh,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      getPosition: [object.origin.x - frame.origin.x, object.origin.y - frame.origin.y,
        (object.origin.heightM - frame.origin.z) * frame.camera.exaggeration],
      getScale: [1, 1, frame.camera.exaggeration],
      updateTriggers: {
        getPosition: [frame.origin.x, frame.origin.y, frame.origin.z, frame.camera.exaggeration],
        getScale: frame.camera.exaggeration
      },
      getColor: overviewColors[object.kind], material: ATLAS_UNLIT_MATERIAL, pickable: false,
      getPolygonOffset: () => [0, 0],
      parameters: {depthWriteEnabled: true, depthCompare: 'less-equal', cullMode: 'none'}
    });
  }));
  return [...overviewLayers, ...semanticLayers];
}

/** Standalone metric scene. Main/preload owns snapshots; this surface never
 * writes canonical data and never normalizes a world into a finite map root. */
export class AtlasDeckSurface {
  private canvasValue: HTMLCanvasElement;
  private deckValue: Deck<AtlasMetricView[]> | null = null;
  private gpuDevice:Device|null=null;
  private cameraValue: AtlasMetricCamera;
  private crop?:{width:number;height:number;x:number;y:number};
  private modelValue: AtlasDeckSceneModel;
  private frameValue: Frame;
  private labels: readonly AtlasDeckLabel[];
  private drawing:((frame:Frame)=>Layer[])|null=null;
  private terrain:readonly AtlasTerrainTileModel[]=[];
  private terrainFieldOwner:AtlasTerrainFieldGpuOwner|null=null;
  private terrainField:TerrainFieldState|null=null;
  private confirmedField:TerrainFieldState|null=null;
  private pendingField:{field:TerrainFieldState;previous:TerrainFieldState|null;fresh:number[];published?:boolean}|null=null;
  private fieldSerial=0;
  private terrainStyle:Readonly<TerrainStyle>=DEFAULT_TERRAIN_STYLE;
  private terrainDisplay={contours:0,seaLevelM:0};
  private labelLayout: AtlasDeckLabels | null = null;
  private disposed = false;
  private loaded = false;
  private lost = false;
  private failure:Error|null=null;
  private generation = 0;
  private revision = 0;
  private renderedRevision = -1;
  private renderingRevision = -1;
  private fieldScreenProof:{generation:number;revision:number;frame:Frame;field:TerrainFieldState;content:number;alpha:number;endFrame:boolean}|null=null;
  private fieldContentDeadline:{content:number;goal:'screen'|'complete';timer:ReturnType<typeof setTimeout>}|null=null;
  private terrainAnimation=0;
  private terrainMorphStart:number|null=null;private terrainAlpha=1;private terrainFrozen=false;
  private terrainDrawn:{at:number;frame:Frame;content:number;complete:boolean;alpha:number;models:readonly AtlasTerrainTileModel[];renderModels:readonly AtlasTerrainTileModel[];field:TerrainFieldState|null}|null=null;
  private terrainObserver:((snapshot:NonNullable<AtlasDeckSurface['terrainDrawn']>)=>void)|null=null;
  private preparedObserver:((screen:TerrainPreparedScreen)=>void)|null=null;
  private preparedDrawn:TerrainPreparedScreen|null=null;
  private clearance={checks:0,lifts:0,visits:0,triangles:0,ms:0,lastLiftM:0,lastVisits:0,lastTriangles:0,lastMs:0,maxMs:0,proof:null as null|{minimumZ:number;maximum:number|null;margin:number;alpha:number;originZ:number;iterations:number}};
  get terrainClearance(){return {...this.clearance};}
  private preparedEscape:TerrainFieldState|null=null;
  private preparedEscapeToken:symbol|null=null;
  private preparedEscapeAlpha:number|null=null;
  private preparedRestorePending=false;
  private preparedCpuPeakBytes=0;
  private contentWaiters=new Set<{content:number;resolve:()=>void;reject:(error:Error)=>void}>();
  private terrainRevision = 0;
  private renderedTerrainRevision = -1;
  private terrainContentRevision = 0;private terrainContentSerial=0;
  private renderedTerrainContentRevision = -1;
  private recovery: Promise<void> | null = null;
  private pickerDrawn:{color:object;depth:object}|null=null;
  private lastDrawingSize:readonly [number,number]|null=null;
  private observer: ResizeObserver;
  private listeners: (() => void)[] = [];
  private waiters = new Set<{resolve: () => void; reject: (error: Error) => void}>();
  private drag: {id: number; pixel: {x: number; y: number}; camera: AtlasMetricCamera; rotate: boolean} | null = null;

  private constructor(private readonly options: AtlasDeckSurfaceOptions) {
    this.cameraValue = {...options.camera, focus: {...options.camera.focus}};
    this.modelValue = options.model;
    this.labels = options.labels ?? [];
    this.frameValue = atlasMetricFrame(this.cameraValue, Math.max(1, options.container.clientWidth), Math.max(1, options.container.clientHeight));
    this.canvasValue = this.makeCanvas();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(options.container);
  }
  static async create(options: AtlasDeckSurfaceOptions): Promise<AtlasDeckSurface> {
    const surface = new AtlasDeckSurface(options);
    try { await surface.start(); return surface; }
    catch (error) { surface.dispose(); throw error; }
  }
  get canvas(): HTMLCanvasElement { return this.canvasValue; }
  get camera(): AtlasMetricCamera { return {...this.cameraValue, focus: {...this.cameraValue.focus}}; }
  get model(): AtlasDeckSceneModel { return this.modelValue; }
  get frame(): Frame { return this.frameValue; }
  get terrainTimings(){return {...terrainMaterialTiming};}
  /** Live CPU and GPU owners, including an older common mesh retained for a
   * byte-identical source acknowledgement and a pending candidate. */
  terrainResourceInventory(){
    const gpuFields=[...new Set([this.confirmedField,this.pendingField?.field,this.terrainDrawn?.field].filter((field):field is TerrainFieldState=>!!field))];
    const fields=[...new Set([...gpuFields,this.preparedEscape].filter((field):field is TerrainFieldState=>!!field))];
    const deck=this.deckValue as unknown as {layerManager?:{getLayers:()=>Layer[]};props?:{layers?:readonly Layer[]}}|null;
    const liveLayers=deck?.layerManager?.getLayers()??deck?.props?.layers??[];
    const liveGeometry=liveLayers.filter((layer):layer is AtlasTerrainFieldLayer=>layer instanceof AtlasTerrainFieldLayer).map(layer=>layer.props.geometry);
    const geometry=[...new Set([...gpuFields.map(field=>field.geometry),...liveGeometry])];
    const descriptors=[...new Set([...gpuFields.flatMap(field=>[field.sourceGeometry.draws,field.geometry.draws,field.endFrameDraws]),...liveGeometry.map(item=>item.draws)].filter((draws):draws is AtlasTerrainFieldGeometry['draws']=>!!draws))];
    return{retained:[this.terrain,this.terrainDrawn?.models,this.terrainDrawn?.renderModels,...liveGeometry,...fields.flatMap(field=>[field.sourceGeometry,field.geometry,field.endFrameDraws,...(field.prepared?.buffers.values()??[]),field.prepared?.source,field.oldModels,field.newModels,field.draftModels,field.rayOldModels,field.rayNewModels,field.rayDraftModels,...[field.oldModels,field.newModels,field.draftModels,field.rayOldModels,field.rayNewModels,field.rayDraftModels].flatMap(models=>atlasTerrainFieldLookupRetained(models))])],
      gpuGeometryBytes:geometry.reduce((sum,item)=>sum+item.gpuGeometryBytes,0),
      drawMetadataBytes:descriptors.reduce((sum,item)=>sum+item.length*128,0)};
  }
  /** Surface half of C's inventory. All retained wire stores are physical
   * owners, including a CPU-only Escape beginning and pending candidates. */
  preparedResourceInventory():Pick<TerrainPreparedInventory,'rendererBackingBytes'|'gpuGeometryBytes'|'gpuOtherBytes'|'drawMetadataBytes'|'retainedBufferIds'|'retainedBases'>&{gpuArrayBytes:number;gpuTableBytes:number;pickerBytes:number;framebufferModelBytes:number;legacyModelBytes:number;cpuPeakBytes:number}{
    const inventory=this.terrainResourceInventory(),fields=[...new Set([this.confirmedField,this.pendingField?.field,this.terrainDrawn?.field,this.preparedEscape].filter((field):field is TerrainFieldState=>!!field))];
    const retainedBufferIds=[...new Set(fields.flatMap(field=>[...(field.prepared?.buffers.keys()??[])]))].sort((a,b)=>a-b);
    const retainedBases:TerrainPreparedBasis[]=[];
    for(const field of fields)if(field.prepared&&!retainedBases.some(b=>terrainPreparedSameBasis(b,field.prepared!.basis)))retainedBases.push(field.prepared.basis);
    const bytes=(value:{width:number;height:number;depth?:number;samples?:number;format:string})=>{
      const size=({rgba8unorm:4,rgba32float:16,r32float:4,r8uint:1,depth24plus:4} as Record<string,number>)[value.format];
      if(!size||![value.width,value.height,value.depth??1,value.samples??1].every(n=>Number.isSafeInteger(n)&&n>0))throw Error('Terrain-P-GPU-Besitzer nicht bilanzierbar.');
      return value.width*value.height*(value.depth??1)*(value.samples??1)*size;
    };
    const gpuArrayBytes=this.terrainFieldOwner?.liveArrays.reduce((s,v)=>s+bytes(v),0)??0;
    const gpuTableBytes=this.terrainFieldOwner?.liveTables.reduce((s,v)=>s+bytes(v),0)??0;
    const picker=this.pickerFrames(),frameBytes=(frame:NonNullable<typeof picker>['pickingFBO'])=>frame&&!frame.destroyed?
      frame.colorAttachments.reduce((s,a)=>s+bytes({width:frame.width,height:frame.height,...a.texture}),0)+
      (frame.depthStencilAttachment?bytes({width:frame.width,height:frame.height,...frame.depthStencilAttachment.texture}):0):0;
    const pickerBytes=frameBytes(picker?.pickingFBO)+frameBytes(picker?.depthFBO);
    const framePixels=this.canvasValue.width*this.canvasValue.height,framebufferModelBytes=40*framePixels;
    const known=gpuArrayBytes+gpuTableBytes+inventory.gpuGeometryBytes+pickerBytes;
    const materialBytes=this.materialGpuTextures().material.filter(texture=>!texture.destroyed).reduce((s,v)=>s+bytes(v),0);
    const legacyModelBytes=Math.max(materialBytes,ATLAS_TERRAIN_PREPARED_GPU.legacyMeasuredCalm,Math.max(0,this.gpuMemory.bytes-known));
    return{rendererBackingBytes:terrainModelBytes(inventory.retained),gpuGeometryBytes:inventory.gpuGeometryBytes,
      gpuOtherBytes:gpuArrayBytes+gpuTableBytes+pickerBytes+framebufferModelBytes+legacyModelBytes,
      drawMetadataBytes:inventory.drawMetadataBytes,retainedBufferIds,retainedBases,
      gpuArrayBytes,gpuTableBytes,pickerBytes,framebufferModelBytes,legacyModelBytes,cpuPeakBytes:this.preparedCpuPeakBytes};
  }
  private preflightTerrainCpu(counted:AtlasTerrainFieldGeometry,oldModels:readonly AtlasTerrainTileModel[],newModels:readonly AtlasTerrainTileModel[],draftModels:readonly AtlasTerrainTileModel[],reuseGeometry:boolean){
    const retained=this.terrainResourceInventory().retained;
    const distinctBuffers=terrainModelBytes([retained,counted,oldModels,newModels,draftModels]);
    const draftSourceCopies=terrainDraftBuffers(draftModels).reduce((sum,buffer)=>sum+buffer.byteLength,0);
    const rebaseCopy=reuseGeometry?0:counted.vertices.byteLength;
    const descriptorCopy=reuseGeometry?0:counted.gpuDrawMetadataBytes;
    const uploadScratch=ATLAS_TERRAIN_FIELD_UPLOAD_SCRATCH;
    const peak=distinctBuffers+draftSourceCopies+rebaseCopy+descriptorCopy+uploadScratch;
    if(peak>TERRAIN_MODEL_MEMORY.total)throw Error('Terrainfeld-Surface-Arbeitsspeicher vor Übernahmekopien überschritten.');
    return{peakBytes:peak,distinctBuffers,draftSourceCopies,rebaseCopy,descriptorCopy,uploadScratch};
  }
  get gpuMemory(){
    const stats=this.gpuDevice?.statsManager.getStats('GPU Time and Memory');
    return {bytes:stats?.get('GPU Memory').count??0,buffers:stats?.get('Buffer Memory').count??0,textures:stats?.get('Texture Memory').count??0};
  }
  private pickerFrames(){return (this.deckValue as unknown as {deckPicker?:{pickingFBO?:AtlasTerrainFieldPilotPreflight['picker']['color'];depthFBO?:AtlasTerrainFieldPilotPreflight['picker']['depth']}}|null)?.deckPicker;}
  private reservePickerAllocation(next:readonly [number,number],prepared=false){
    const pixels=(size:readonly [number,number])=>{if(!size.every(value=>Number.isSafeInteger(value)&&value>0))throw Error('Terrainfeld-Picker-Größe ungültig.');return size[0]*size[1];};
    const count=(value:number)=>{if(!Number.isSafeInteger(value)||value<1)throw Error('Terrainfeld-GPU-Layer/Samples ungültig.');return value;};
    const picker=this.pickerFrames(),old=[picker?.pickingFBO,picker?.depthFBO],formatBytes=(format:string)=>({rgba8unorm:4,rgba32float:16,depth16unorm:2,depth24plus:4} as Record<string,number>)[format]??NaN;
    const oldPicker=old.reduce((sum,frame)=>frame&&!frame.destroyed?sum+pixels([frame.width,frame.height])*(formatBytes(frame.colorAttachments[0]?.texture.format??'')*count(frame.colorAttachments[0]?.texture.samples??1)+formatBytes(frame.depthStencilAttachment?.texture.format??'')*count(frame.depthStencilAttachment?.texture.samples??1)):sum,0);
    if(!Number.isFinite(oldPicker))throw Error('Terrainfeld-Picker-Anhang nicht bilanziert.');
    const material=this.materialGpuTextures(),materialBytes=[...new Set(material.material.filter(texture=>!texture.destroyed))].reduce((sum,texture)=>sum+pixels([texture.width,texture.height])*count(texture.depth)*count(texture.samples)*(({rgba8unorm:4,rgba32float:16,r32float:4} as Record<string,number>)[texture.format]??NaN),0);
    if(!Number.isFinite(materialBytes)||material.morph.some(texture=>!texture.destroyed))throw Error('Terrainfeld-Materialbesitzer vor Picker-Resize ungültig.');
    const inventory=this.terrainResourceInventory(),tables=this.terrainFieldOwner?.liveTables??[];
    const tableBytes=tables.reduce((sum,table)=>sum+pixels([table.width,table.height])*count(table.depth??1)*count(table.samples??1)*(({rgba32float:16,r8uint:1} as Record<string,number>)[table.format]??NaN),0);
    if(!Number.isFinite(tableBytes)||tables.some(table=>table.destroyed))throw Error('Terrainfeld-Tabellenbesitzer vor Picker-Resize ungültig.');
    const previous=this.lastDrawingSize,defaultBuffers=40*(pixels(next)+(previous?pixels(previous):0));
    const limit=prepared||this.confirmedField?.prepared||this.pendingField?.field.prepared?ATLAS_TERRAIN_PREPARED_GPU:ATLAS_TERRAIN_FIELD_GPU,arrayBytes=this.terrainFieldOwner?.liveArrayBytes??0,known=this.terrainFieldOwner?arrayBytes+inventory.gpuGeometryBytes+tableBytes:0;
    const legacy=Math.max(materialBytes,limit.legacyMeasuredCalm,Math.max(0,this.gpuMemory.bytes-known-oldPicker));
    const peak=legacy+arrayBytes+tableBytes+inventory.gpuGeometryBytes+inventory.drawMetadataBytes+defaultBuffers+oldPicker+28*pixels(next);
    if(!Number.isFinite(peak)||peak>limit.total)throw Error('Terrainfeld-GPU-Gesamtbudget vor Picker-Allokation überschritten.');
  }
  private drawPicker(prepared=false){
    const deck=this.deckValue;if(!deck)throw Error('Terrainfeld-Picker ohne Deck.');
    ensureAtlasDeckPickingDepth(deck,reservation=>this.reservePickerAllocation(reservation.next,prepared));
    deck.pickObject({x:Math.floor(this.canvasValue.width/2),y:Math.floor(this.canvasValue.height/2),radius:0,unproject3D:true});
    const picker=this.pickerFrames();if(!picker?.pickingFBO||!picker.depthFBO)throw Error('Terrainfeld-Picker-Draw ohne beide Anhänge.');
    this.pickerDrawn={color:picker.pickingFBO,depth:picker.depthFBO};
  }
  private materialGpuTextures(){
    const material=new Set<Texture>(),morph=new Set<Texture>();
    const live=this.deckValue as unknown as {layerManager?:{getLayers:()=>Layer[]}}|null;
    const layers=live?.layerManager?.getLayers()??this.deckValue?.props.layers??[];
    for(const layer of layers){if(!(layer instanceof AtlasTerrainMaterialLayer)||!layer.state)continue;
      const state=layer as unknown as {baseTexture?:Texture;maskTexture?:Texture;extras?:Record<string,Texture|undefined>};
      for(const texture of [state.baseTexture,state.maskTexture,...Object.values(state.extras??{})])if(texture&&'destroyed' in texture&&'width' in texture)material.add(texture);
      for(const [name,texture] of Object.entries(state.extras??{}))if(name.startsWith('atlasPrevious')&&texture)morph.add(texture);
    }
    return{material:[...material],morph:[...morph]};
  }
  private terrainGpuPreflight(newGeometryBytes:number,newMetadataBytes:number,candidatePickerSize?:readonly [number,number]):AtlasTerrainFieldPilotPreflight{
    const picker=this.pickerFrames(),drawn=this.pickerDrawn;
    if(!picker?.pickingFBO||!picker.depthFBO||!drawn)throw Error('Terrainfeld-Picker nicht wirklich gezeichnet.');
    const previous=this.lastDrawingSize;
    const material=this.materialGpuTextures();
    const inventory=this.terrainResourceInventory();
    if(!this.confirmedField&&this.terrain.length&&!this.terrainDrawn?.complete)throw Error('Terrainfeld-Alpha-1-Bild nicht bestätigt.');
    return{drawingWidth:candidatePickerSize?.[0]??this.canvasValue.width,drawingHeight:candidatePickerSize?.[1]??this.canvasValue.height,
      observedLumaGpuBytes:this.gpuMemory.bytes,materialTextures:material.material,morphTextures:material.morph,
      picker:{color:picker.pickingFBO,depth:picker.depthFBO,drawnColor:drawn.color,drawnDepth:drawn.depth},
      previousDrawingSize:previous&&(previous[0]!==this.canvasValue.width||previous[1]!==this.canvasValue.height)?previous:undefined,
      candidatePickerSize,fieldArraysResident:!!this.terrainFieldOwner,fieldArrayTextures:this.terrainFieldOwner?.liveArrays,
      retainedTables:this.terrainFieldOwner?.liveTables??[],plannedTables:this.confirmedField||!this.terrainFieldOwner?atlasTerrainFieldPlannedTables():[],
      retainedFieldGpuGeometryBytes:inventory.gpuGeometryBytes,newFieldGpuGeometryBytes:newGeometryBytes,
      retainedDrawMetadataBytes:inventory.drawMetadataBytes,newDrawMetadataBytes:newMetadataBytes};
  }
  get contextAvailable(): boolean { return !this.disposed && !this.lost && this.loaded && !this.failure; }
  get frameUsable(): boolean { return this.contextAvailable && this.renderedRevision === this.revision; }
  /** Drawing/HUD work cannot revoke the already drawn terrain input surface.
   * Semantic picking and batch completion still require the full frame. */
  get terrainFrameUsable(): boolean { return this.contextAvailable && this.renderedTerrainRevision === this.terrainRevision; }

  private makeCanvas(): HTMLCanvasElement {
    const canvas = this.options.container.ownerDocument.createElement('canvas');
    // Deck can emit its first afterRender before its ResizeObserver runs. Give
    // the recreated context the real framebuffer dimensions before that frame.
    const ratio=this.options.pixelRatio??globalThis.devicePixelRatio??1;
    canvas.width=Math.max(1,Math.round(this.frameValue.viewport.width*ratio));
    canvas.height=Math.max(1,Math.round(this.frameValue.viewport.height*ratio));
    canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Atlas');
    Object.assign(canvas.style, {width: '100%', height: '100%', display: 'block', touchAction: 'none',background:'#c5d7df'});
    this.options.container.append(canvas);
    return canvas;
  }
  private guard(): void { if (this.disposed) throw new Error('Atlas surface disposed'); }
  private publish(terrainChanged = true): void {
    this.guard();
    const previousFrame=this.frameValue;
    // Fix one uploaded alpha before camera safety, layers and their Screenproof.
    // No later layer construction may sample another renderer clock.
    if(!this.terrainFrozen)this.terrainAlpha=this.terrainMorphStart===null?(this.terrainField?.oldModels.length?0:this.terrain.some(t=>t.transition)?0:1):Math.min(1,(performance.now()-this.terrainMorphStart)/180);
    this.terrainAlpha=Math.fround(this.terrainAlpha);
    let frame=atlasMetricFrame(this.cameraValue, Math.max(1, this.options.container.clientWidth), Math.max(1, this.options.container.clientHeight),undefined,{crop:this.crop});
    const prepared=this.terrainField?.prepared,started=performance.now(),beforeHeight=this.cameraValue.focusHeightM,beforeVisits=this.clearance.visits,beforeTriangles=this.clearance.triangles;
    if(prepared){
      let safe=false;
      for(let attempt=0;attempt<4;attempt++){
        const volume=atlasMetricClearanceVolume(frame),hull=prepared.ray.heightEnvelope(volume.box,this.terrainAlpha,frame.origin,frame.camera.exaggeration,!!this.terrainField?.endFrameDraws);
        this.clearance.checks++;this.clearance.visits+=hull.visits;this.clearance.triangles+=hull.triangles;
        const gap=atlasCameraClearanceMargin(frame.width*frame.camera.metersPerPixel)*frame.camera.exaggeration;
        if(hull.maximum===null||hull.maximum+gap<volume.minimumZ){this.clearance.proof={minimumZ:volume.minimumZ,maximum:hull.maximum,margin:gap,alpha:this.terrainAlpha,originZ:frame.origin.z,iterations:attempt+1};safe=true;break;}
        // Move strictly beyond the tested boundary. Reserve the current
        // computed clip-rounding enclosure (at least one physical gap), so a
        // new quantized final-origin matrix need not converge to equality.
        const lift=(hull.maximum+gap+Math.max(gap,volume.roundingZ)-volume.minimumZ)/frame.camera.exaggeration;
        const focusHeightM=this.cameraValue.focusHeightM+lift+Math.max(1e-9,Number.EPSILON*Math.abs(this.cameraValue.focusHeightM)*8);
        if(!Number.isFinite(focusHeightM))break;
        this.cameraValue={...this.cameraValue,focusHeightM};
        frame=atlasMetricFrame(this.cameraValue,frame.width,frame.height,undefined,{crop:this.crop});
      }
      if(!safe){const error=Error('Terrain-Kamera: Nahbereich nach vier Prüfungen nicht sicher frei.');this.fail(error);throw error;}
    }
    this.clearance.lastMs=performance.now()-started;this.clearance.ms+=this.clearance.lastMs;this.clearance.maxMs=Math.max(this.clearance.maxMs,this.clearance.lastMs);this.clearance.lastVisits=this.clearance.visits-beforeVisits;this.clearance.lastTriangles=this.clearance.triangles-beforeTriangles;this.clearance.lastLiftM=this.cameraValue.focusHeightM-beforeHeight;
    if(this.clearance.lastLiftM>0)this.clearance.lifts++;
    this.frameValue=frame;
    this.revision++;
    if(terrainChanged||previousFrame.viewport.width!==this.frameValue.viewport.width||previousFrame.viewport.height!==this.frameValue.viewport.height)this.terrainRevision++;
    this.renderingRevision = -1;
    this.fieldScreenProof=null;
    if (!this.loaded || this.lost) return;
    this.deckValue!.setProps({width: this.frameValue.viewport.width, height: this.frameValue.viewport.height,
      views: [new AtlasMetricView({id: 'atlas-metric', frame: this.frameValue})],
      ...this.renderCallbacks(this.generation, this.revision),
      viewState: {}, layers: [...this.terrainLayers(), ...atlasDeckSceneLayers(this.modelValue, this.frameValue), ...this.labelLayers(),...(this.drawing?.(this.frameValue)??[])].map(layer=>this.cameraValue.tilt>60&&layer instanceof SimpleMeshLayer?layer.clone({extensions:[ATLAS_HORIZON_EXTENSION],atlasHorizon:atlasHorizonRange(this.frameValue,this.crop?.width,this.crop?.height)}):layer)});
    if(this.clearance.lastLiftM>0)this.options.onCamera?.(this.camera);
  }
  setViewportCrop(crop:{width:number;height:number;x:number;y:number}){this.crop=crop;this.publish();}
  setCamera(camera: AtlasMetricCamera): void {
    this.guard();
    // Validate before changing the live camera.
    atlasMetricFrame(camera, this.frameValue.viewport.width, this.frameValue.viewport.height);
    const before=this.cameraValue;
    if(before.focus.x===camera.focus.x&&before.focus.y===camera.focus.y&&before.focusHeightM===camera.focusHeightM&&before.metersPerPixel===camera.metersPerPixel&&before.rotation===camera.rotation&&before.tilt===camera.tilt&&before.exaggeration===camera.exaggeration)return;
    this.cameraValue = {...camera, focus: {...camera.focus}};
    this.publish(); this.options.onCamera?.(this.camera);
  }
  setScene(model: AtlasDeckSceneModel): void {
    this.guard();
    if (model === this.modelValue) return;
    this.modelValue = model; this.publish();
  }
  private rollbackPendingField(){
    const pending=this.pendingField;if(!pending)return;
    this.pendingField=null;this.terrainField=pending.previous;
    if(this.terrainFieldOwner&&!this.lost){
      if(!pending.previous){
        // The first owner has no confirmed slots or tables to retain. Its
        // initialTables are destroyed with it, so a successor needs a new owner.
        this.terrainFieldOwner.dispose();this.terrainFieldOwner=null;
        this.terrain=this.terrainDrawn?.renderModels??[];
        return;
      }
      if(pending.fresh.length&&!pending.published)this.terrainFieldOwner.discardUnpublished(pending.fresh);
      if(pending.field.tables!==pending.previous.tables)this.terrainFieldOwner.releaseTables(pending.field.tables);
    }
  }
  private prepareTerrainField(next:readonly AtlasTerrainTileModel[],localEdit:boolean,prepared?:AtlasTerrainFieldGeometry):{field:TerrainFieldState;fresh:number[]}|null{
    const device=this.gpuDevice,deck=this.deckValue;if(!device||!deck||!this.loaded||this.lost)return null;
    const previous=this.confirmedField,
      // The committed result of a local draft is already the displayed shape.
      // Its fresh worker intentionally has no stale pre-gesture model state, so
      // publish that canonical snapshot directly instead of inventing a morph
      // from sources that were fenced when the gesture began.
      oldModels=localEdit&&previous?previous.oldModels:(previous?.draftModels.length||prepared?.oldSourceCount===0?[]:(previous?.newModels??this.terrain)),
      newModels=localEdit&&previous?previous.newModels:next,draftModels=localEdit?next:[];
    const owner=this.terrainFieldOwner;
    const available=(length:number,blocked:ReadonlySet<number>=new Set())=>[0,32,64,96].find(base=>Array.from({length},(_,i)=>base+i).every(slot=>!owner?.holds(slot)&&!blocked.has(slot)));
    const oldBase=localEdit&&previous?previous.oldBase:(previous?.newBase??0),
      oldSlots=new Set(oldModels.map((_,i)=>oldBase+i)),
      newBase=localEdit&&previous?previous.newBase:(available(newModels.length,oldSlots)??-1),
      occupied=new Set([...oldSlots,...newModels.map((_,i)=>newBase+i)]),
      draftBase=draftModels.length?(available(draftModels.length,occupied)??-1):64;
    if(newBase<0||draftBase<0)throw Error('Terrainfeld-Übernahme benötigt freie, nicht gezeichnete Slots.');
    // A draft is a delta over the frozen displayed field. It must reuse that
    // exact topology and its GPU buffers instead of synchronously rebuilding a
    // second mesh in the input path.
    const counted=localEdit&&previous?{...previous.sourceGeometry,oldSourceCount:oldModels.length,newSourceCount:newModels.length,draftSourceCount:draftModels.length}:
      prepared??prepareAtlasTerrainFieldGeometry(oldModels,newModels,draftModels.length,this.terrainResourceInventory().gpuGeometryBytes,{
        retainedDrawMetadataBytes:this.terrainResourceInventory().drawMetadataBytes,
        reserve:(_bytes,allocation)=>{
          const retained=terrainModelBytes([this.terrainResourceInventory().retained,oldModels,newModels,draftModels]);
          const draftSourceCopies=terrainDraftBuffers(draftModels).reduce((sum,buffer)=>sum+buffer.byteLength,0);
          if(retained+allocation.geometryBytes+allocation.vertexBytes+allocation.drawMetadataBytes*3+draftSourceCopies+ATLAS_TERRAIN_FIELD_UPLOAD_SCRATCH>TERRAIN_MODEL_MEMORY.total)
            throw Error('Terrainfeld-Surface-Arbeitsspeicher vor Endbufferallokation überschritten.');
        }
      });
    if(counted.oldSourceCount!==oldModels.length||counted.newSourceCount!==newModels.length||counted.draftSourceCount!==draftModels.length)throw Error('Terrainfeld-Workergeometrie gehört nicht zum sichtbaren Snapshot.');
    this.preflightTerrainCpu(counted,oldModels,newModels,draftModels,localEdit&&!!previous);
    // The next brush frame may mutate all five source views before its own
    // upload even begins. Ray, GPU owner and explicit recovery share this
    // counted immutable snapshot until a later candidate actually draws.
    const rayDraftModels=terrainDraftSnapshot(draftModels),
      rayNewModels=localEdit&&!previous?rayDraftModels:newModels,
      ray=createAtlasTerrainFieldRayIndex(counted,oldModels,rayNewModels,rayDraftModels);let geometry:AtlasTerrainFieldGeometry;
    if(!this.pickerDrawn)this.drawPicker();
    const newGeometryBytes=localEdit&&previous?0:counted.gpuGeometryBytes,newMetadataBytes=localEdit&&previous?0:counted.gpuDrawMetadataBytes;
    ensureAtlasDeckPickingDepth(deck,reservation=>preflightAtlasTerrainFieldPilotGpu(this.terrainGpuPreflight(newGeometryBytes,newMetadataBytes,reservation.next)));
    if(this.pickerDrawn?.color!==this.pickerFrames()?.pickingFBO||this.pickerDrawn?.depth!==this.pickerFrames()?.depthFBO)this.drawPicker();
    const preflight=this.terrainGpuPreflight(newGeometryBytes,newMetadataBytes);
    preflightAtlasTerrainFieldPilotGpu(preflight);
    if(localEdit&&previous)geometry=previous.geometry;
    else{const vertices=counted.vertices.slice();for(let i=0;i<vertices.length;i+=4){if(vertices[i+2]!>=0)vertices[i+2]!+=oldBase;if(vertices[i+3]!>=0)vertices[i+3]!+=newBase;}
      geometry={...counted,vertices,draws:counted.draws.map(draw=>({...draw,oldSlot:draw.oldSlot<0?-1:draw.oldSlot+oldBase,newSlot:draw.newSlot<0?-1:draw.newSlot+newBase}))};}
    if(!this.terrainFieldOwner)this.terrainFieldOwner=AtlasTerrainFieldGpuOwner.create(device,preflight);
    const active=this.terrainFieldOwner,fresh:number[]=[],tables=previous?active.createTables():active.initialTables;
    const upload=(models:readonly AtlasTerrainTileModel[],base:number)=>models.forEach((model,index)=>{const slot=base+index;if(!active.reuses(slot,model)){active.upload(slot,model);fresh.push(slot);}});
    try{
      upload(oldModels,oldBase);upload(rayNewModels,newBase);upload(rayDraftModels,draftBase);
      active.uploadEdgeOwners(oldModels,rayNewModels,rayDraftModels,{old:oldBase,new:newBase,draft:draftBase},tables);
      const slots=[...oldModels.map((_,i)=>oldBase+i),...newModels.map((_,i)=>newBase+i),...draftModels.map((_,i)=>draftBase+i)];
      return{field:{sourceGeometry:counted,geometry,ray,rayOldModels:oldModels,rayNewModels,rayDraftModels,oldModels,newModels:rayNewModels,draftModels:rayDraftModels,oldBase,newBase,draftBase,slots,tables,layerId:localEdit&&previous?previous.layerId:`atlas-terrain-field:${++this.fieldSerial}`},fresh};
    }catch(error){if(fresh.length)active.discardUnpublished(fresh);if(previous)active.releaseTables(tables);throw error;}
  }
  /** Adopt C's immutable packed result. Binding is supplied by the dispatch
   * owner; no field of the reply is trusted to define its own expected job. */
  setPreparedTerrain(submission:PreparedSubmission,style:Readonly<TerrainStyle>=this.terrainStyle,display=this.terrainDisplay):number{
    return this.applyPreparedTerrain(submission,style,display);
  }
  private applyPreparedTerrain(submission:PreparedSubmission,style:Readonly<TerrainStyle>,display:{contours:number;seaLevelM:number},pinnedAlpha?:number):number{
    this.guard();if(this.failure||this.lost)throw this.failure??Error('Terrainoberfläche nicht verfügbar.');
    try{return this.adoptPreparedTerrain(submission,style,display,pinnedAlpha);}
    catch(error){if(!this.failure)this.fail(error);throw error;}
  }
  private adoptPreparedTerrain(submission:PreparedSubmission,style:Readonly<TerrainStyle>,display:{contours:number;seaLevelM:number},pinnedAlpha?:number):number{
    if(pinnedAlpha!==undefined&&(!Number.isFinite(pinnedAlpha)||pinnedAlpha<0||pinnedAlpha>1||Math.fround(pinnedAlpha)!==pinnedAlpha))throw Error('Terrain-Escape-Screenalpha ungültig.');
    const {result,expected,capture,buffers}=submission;
    this.rollbackPendingField();
    const previous=this.confirmedField,retained=previous?.prepared;
    const retainedBasis=retained?{basis:retained.basis,vertices:(retained.source.vertices.length/14),sourceIds:retained.source.newSources.map(source=>source.id)}:undefined;
    terrainPreparedValidateResult(result,expected,capture,buffers,retainedBasis);
    if(!result.geometry&&!retained)throw Error('Terrain-Basisbindung ungültig.');
    const origin:PreparedBasisOrigin=result.geometry?{basis:{...result.basis},target:{...expected.target},epoch:expected.epoch,editSeries:capture.editSeries}:retained!.origin;
    if(!terrainPreparedSameBasis(origin.basis,result.basis)||expected.epoch!==origin.epoch||capture.editSeries!==origin.editSeries)
      throw Error('Terrain-Basisursprung nicht an Epoch und Editserie gebunden.');
    if(!result.geometry&&(expected.target.token!==origin.target.token||expected.target.revision<origin.target.revision||
      expected.target.revision===origin.target.revision&&expected.target.fence!==origin.target.fence))
      throw Error('Terrain-Draftquelle nicht an Basisursprung gebunden.');
    const source=result.geometry??retained?.source;
    if(!source||!this.gpuDevice||!this.deckValue||!this.loaded)throw Error('Terrain-Basis oder GPU-Kontext fehlt.');
    if(!result.geometry&&!retained||result.geometry&&result.draft&&!terrainPreparedSameBasis(source.basis,result.basis))throw Error('Terrain-Basisbindung ungültig.');
    const oldSources=source.oldSources,newSources=source.newSources;
    if(new Set(oldSources.map(s=>s.id)).size!==oldSources.length||new Set(newSources.map(s=>s.id)).size!==newSources.length)throw Error('Terrain-Quellmanifest doppelt.');
    if(Boolean(result.draft)!==Boolean(result.draftSources.length))throw Error('Terrain-Draftfeld und Materialquellen weichen ab.');
    for(const s of [...oldSources,...newSources]){
      const target=s.source;
      if(!target?.token||!target.fence||!Number.isSafeInteger(target.revision)||
        newSources.includes(s)&&(target.token!==origin.target.token||target.fence!==origin.target.fence||target.revision!==origin.target.revision)||
        !Number.isSafeInteger(s.lod)||s.lod< -8||s.lod>31||![s.x,s.y].every(Number.isSafeInteger)||!Number.isFinite(s.seaLevelM))
        throw Error('Terrain-Displayquelle gehört nicht zur erwarteten Bindung.');
      const bound=atlasWorldTileBounds(s);
      if(Math.max(Math.abs(bound.minX),Math.abs(bound.minY),Math.abs(bound.maxX),Math.abs(bound.maxY))>1e12)throw Error('Terrain-Displayquelle außerhalb der Darstellungsgrenze.');
    }
    if(source.draws.some(d=>d.indexCount<3||d.bounds[2]<=d.bounds[0]||d.bounds[3]<=d.bounds[1]))throw Error('Terrain-Screenpartition leer oder ungültig.');
    // A delivery table may also contain buffers from older settled drafts.
    // Keep only stores addressed by this field so those drafts can retire
    // after their last confirmed owner disappears.
    const needed=new Set<number>(),keep=(ref:{buffer:number})=>needed.add(ref.buffer);
    for(const ref of [source.vertices,source.indices,source.rayNodes,source.rayTriangles,result.draft])if(ref)keep(ref);
    for(const s of [...oldSources,...newSources,...result.draftSources]){
      if(s.height)keep(s.height);
      for(const ref of [s.material.texture,s.material.masks,s.material.cover,s.material.relief])keep(ref);
    }
    const retainedBuffers=new Map([...buffers].filter(([id])=>needed.has(id)));
    if(retainedBuffers.size!==needed.size)throw Error('Terrain-Feldbuffer fehlt bei Übernahme.');
    const view=<T extends Float32Array|Uint32Array>(ref:TerrainPreparedGeometry['vertices']|NonNullable<TerrainPreparedResult['draft']>)=>terrainPreparedView(ref,buffers) as T;
    const basis=view<Float32Array>(source.vertices),indices=view<Uint32Array>(source.indices),draft=result.draft?view<Float32Array>(result.draft):null;
    const rayNodes=view<Uint32Array>(source.rayNodes),rayTriangles=view<Uint32Array>(source.rayTriangles);
    const sameSources=(a:readonly TerrainPreparedDisplaySource[],b:readonly TerrainPreparedDisplaySource[])=>a.length===b.length&&a.every((s,i)=>preparedViewsEqual(s,b[i]!));
    const reuseOldBank=previous?.prepared&&(sameSources(oldSources,previous.prepared.source.oldSources)?'old':sameSources(oldSources,previous.prepared.source.newSources)?'new':null);
    const reuseNewBank=previous?.prepared&&sameSources(newSources,previous.prepared.source.newSources)?'new':null;
    const oldModels=!result.geometry&&previous?previous.oldModels:reuseOldBank==='old'?previous!.oldModels:reuseOldBank==='new'?previous!.newModels:oldSources.map(s=>preparedTile(s,s,buffers));
    const newModels=!result.geometry&&previous?previous.newModels:reuseNewBank==='new'?previous!.newModels:newSources.map(s=>preparedTile(s,s,buffers));
    const draftModels=result.draftSources.map((s,i)=>preparedTile(s,newSources[i]!,buffers));
    const owner=this.terrainFieldOwner;
    const bank=(length:number,blocked:ReadonlySet<number>=new Set())=>[0,32,64,96].find(base=>Array.from({length},(_,i)=>base+i).every(slot=>!owner?.holds(slot)&&!blocked.has(slot)));
    const sameBasis=!!previous?.prepared&&terrainPreparedSameBasis(previous.prepared.basis,result.basis);
    const oldBase=!result.geometry&&previous?previous.oldBase:reuseOldBank==='old'?previous!.oldBase:reuseOldBank==='new'?previous!.newBase:(bank(oldModels.length)??-1);
    const oldSlots=new Set(oldModels.map((_,i)=>oldBase+i));
    const newBase=!result.geometry&&previous?previous.newBase:reuseNewBank==='new'&&!newModels.some((_,i)=>oldSlots.has(previous!.newBase+i))?previous!.newBase:(bank(newModels.length,oldSlots)??-1);
    const occupied=new Set([...oldSlots,...newModels.map((_,i)=>newBase+i)]);
    const draftBase=draftModels.length?(bank(draftModels.length,occupied)??-1):64;
    if(oldBase<0||newBase<0||draftBase<0)throw Error('Terrain-Feld benötigt freie nicht gezeichnete Slots.');
    const localDraws=source.draws.map(d=>({origin:{x:d.origin[0],y:d.origin[1]},bounds:{x:d.bounds[0],y:d.bounds[1],width:d.bounds[2]-d.bounds[0],height:d.bounds[3]-d.bounds[1]},firstIndex:d.firstIndex,indexCount:d.indexCount,oldSlot:d.oldSlot,newSlot:d.newSlot}));
    const sourceGeometry:AtlasTerrainPreparedLayerGeometry={vertices:basis,preparedBasis:basis,preparedDraft:draft,indices,draws:localDraws,gpuGeometryBytes:basis.byteLength+indices.byteLength+(draft?.byteLength??0),gpuDrawMetadataBytes:localDraws.length*128,oldSourceCount:oldModels.length,newSourceCount:newModels.length,draftSourceCount:draftModels.length};
    const geometry:AtlasTerrainPreparedLayerGeometry={...sourceGeometry,draws:localDraws.map(d=>({...d,oldSlot:d.oldSlot<0?-1:oldBase+d.oldSlot,newSlot:d.newSlot<0?-1:newBase+d.newSlot}))};
    const ray=createAtlasTerrainPreparedRayIndex({basis,draft,indices,draws:source.draws,rayNodes,rayTriangles});
    const retainedBytes=terrainModelBytes([this.terrainResourceInventory().retained,buffers,sourceGeometry,geometry,oldModels,newModels,draftModels]);
    const cpuPeak=retainedBytes+ATLAS_TERRAIN_FIELD_UPLOAD_SCRATCH;
    if(!Number.isSafeInteger(cpuPeak))throw Error('Terrain-P-Arbeitsspeicher nicht bilanzierbar.');
    this.preparedCpuPeakBytes=cpuPeak;
    const newGeometryBytes=geometry.gpuGeometryBytes,newMetadataBytes=geometry.gpuDrawMetadataBytes;
    try{
      if(!this.pickerDrawn)this.drawPicker(true);
      ensureAtlasDeckPickingDepth(this.deckValue,reservation=>preflightAtlasTerrainFieldPilotGpu(this.terrainGpuPreflight(newGeometryBytes,newMetadataBytes,reservation.next),ATLAS_TERRAIN_PREPARED_GPU));
      if(this.pickerDrawn?.color!==this.pickerFrames()?.pickingFBO||this.pickerDrawn?.depth!==this.pickerFrames()?.depthFBO)this.drawPicker(true);
      const preflight=this.terrainGpuPreflight(newGeometryBytes,newMetadataBytes);
      preflightAtlasTerrainFieldPilotGpu(preflight,ATLAS_TERRAIN_PREPARED_GPU);
      if(!this.terrainFieldOwner)this.terrainFieldOwner=AtlasTerrainFieldGpuOwner.create(this.gpuDevice,preflight,ATLAS_TERRAIN_PREPARED_GPU);
      const active=this.terrainFieldOwner,fresh:number[]=[],tables=previous?active.createTables():active.initialTables;let pendingOwned=false;
      const upload=(models:readonly AtlasTerrainTileModel[],base:number)=>models.forEach((model,index)=>{const slot=base+index;if(!active.reuses(slot,model)){active.upload(slot,model);fresh.push(slot);}});
      try{
        upload(oldModels,oldBase);upload(newModels,newBase);upload(draftModels,draftBase);
        active.uploadEdgeOwners(oldModels,newModels,draftModels,{old:oldBase,new:newBase,draft:draftBase},tables);
        const slots=[...oldModels.map((_,i)=>oldBase+i),...newModels.map((_,i)=>newBase+i),...draftModels.map((_,i)=>draftBase+i)];
        const field:TerrainFieldState={sourceGeometry,geometry,ray:null,rayOldModels:oldModels,rayNewModels:newModels,rayDraftModels:draftModels,oldModels,newModels,draftModels,oldBase,newBase,draftBase,slots,tables,layerId:`atlas-terrain-field:${++this.fieldSerial}`,stateId:this.fieldSerial,prepared:{basis:result.basis,origin,draftRevision:result.draftRevision,source,buffers:retainedBuffers,ray,submission:{...submission,buffers:retainedBuffers}}};
        this.terrain= draftModels.length?draftModels:newModels;this.terrainField=field;this.pendingField={field,previous:previous??null,fresh};pendingOwned=true;this.terrainStyle=style;this.terrainDisplay=display;
        this.terrainContentRevision=++this.terrainContentSerial;
        const localDraft=!!draft||draftModels.length>0;
        if(pinnedAlpha!==undefined){this.terrainFrozen=true;this.terrainMorphStart=null;this.terrainAlpha=pinnedAlpha;}
        else if(!localDraft){this.terrainFrozen=false;this.terrainMorphStart=null;this.terrainAlpha=oldModels.length?0:1;}else if(!sameBasis){this.terrainAlpha=1;}
        this.armFieldContentDeadline(this.terrainContentRevision,pinnedAlpha!==undefined||localDraft&&this.terrainFrozen?'screen':'complete');
        this.publish(!localDraft);
        if(this.terrainAnimation)cancelAnimationFrame(this.terrainAnimation);this.animateTerrain();
        return this.terrainContentRevision;
      }catch(error){if(!pendingOwned){if(fresh.length)active.discardUnpublished(fresh);if(previous)active.releaseTables(tables);}throw error;}
    }catch(error){throw error;}
  }
  private restoreTerrainField(){
    const field=this.terrainField,device=this.gpuDevice,deck=this.deckValue;if(!field||!device||!deck||!this.loaded||this.lost)return;
    this.drawPicker();
    const preflight={...this.terrainGpuPreflight(0,0),fieldArraysResident:false,fieldArrayTextures:undefined,retainedTables:[],plannedTables:atlasTerrainFieldPlannedTables(),retainedFieldGpuGeometryBytes:0,newFieldGpuGeometryBytes:field.geometry.gpuGeometryBytes,retainedDrawMetadataBytes:0,newDrawMetadataBytes:field.sourceGeometry.gpuDrawMetadataBytes};
    const owner=AtlasTerrainFieldGpuOwner.create(device,preflight,field.prepared?ATLAS_TERRAIN_PREPARED_GPU:ATLAS_TERRAIN_FIELD_GPU),slots:number[]=[];
    const upload=(models:readonly AtlasTerrainTileModel[],base:number)=>models.forEach((model,index)=>{const slot=base+index;owner.upload(slot,model);slots.push(slot);});
    try{upload(field.oldModels,field.oldBase);upload(field.newModels,field.newBase);upload(field.draftModels,field.draftBase);owner.uploadEdgeOwners(field.oldModels,field.newModels,field.draftModels,{old:field.oldBase,new:field.newBase,draft:field.draftBase},owner.initialTables);field.slots=slots;field.tables=owner.initialTables;this.terrainFieldOwner=owner;this.confirmedField=null;this.pendingField={field,previous:null,fresh:slots};this.armFieldContentDeadline(this.terrainContentRevision,this.terrainFrozen&&field.draftModels.length?'screen':'complete');}
    catch(error){owner.dispose();throw error;}
  }
  setTerrain(tiles:readonly AtlasTerrainTileModel[],style:Readonly<TerrainStyle>=this.terrainStyle,display=this.terrainDisplay,localEdit=false,prepared?:AtlasTerrainFieldGeometry):number {
    this.guard();if(this.failure||this.lost)throw this.failure??Error('Terrainoberfläche nicht verfügbar.');
    this.rollbackPendingField();const current=this.confirmedField;
    if(!localEdit&&current&&!current.draftModels.length&&sameAtlasTerrainFieldSources(current.newModels,tiles)){
      // This content acknowledgement still needs a real draw, but its source
      // fields and already visible common mesh are byte-identical. Preserve a
      // running alpha instead of starting a redundant slot-bank transition.
      this.terrain=tiles;this.terrainStyle=style;this.terrainDisplay=display;this.terrainFrozen=false;
      this.terrainContentRevision=++this.terrainContentSerial;this.armFieldContentDeadline(this.terrainContentRevision);try{this.publish();}catch(error){this.fail(error);throw error;}
      if(this.terrainAnimation)cancelAnimationFrame(this.terrainAnimation);
      this.animateTerrain();return this.terrainContentRevision;
    }
    let candidate:{field:TerrainFieldState;fresh:number[]}|null=null;
    try{candidate=this.prepareTerrainField(tiles,localEdit,prepared);}catch(error){this.fail(error);throw error;}
    const field=candidate?.field??null;
    this.terrain=localEdit&&field?field.draftModels:tiles;this.terrainStyle=style;this.terrainDisplay=display;this.terrainContentRevision=++this.terrainContentSerial;
    if(field){this.terrainField=field;this.pendingField={field,previous:current,fresh:candidate!.fresh};this.armFieldContentDeadline(this.terrainContentRevision,localEdit&&this.terrainFrozen?'screen':'complete');}
    if(!localEdit){this.terrainFrozen=false;this.terrainMorphStart=null;this.terrainAlpha=field?(field.oldModels.length?0:1):(tiles.some(t=>t.transition)?0:1);}else if(!field){this.terrainAlpha=tiles.some(t=>t.transition)?0:1;}
    try{this.publish(!localEdit);}catch(error){this.fail(error);throw error;}
    if(this.terrainAnimation)cancelAnimationFrame(this.terrainAnimation);
    this.animateTerrain();return this.terrainContentRevision;
  }
  refreshTerrainStyle(style:Readonly<TerrainStyle>,display=this.terrainDisplay){if(style===this.terrainStyle&&display.contours===this.terrainDisplay.contours&&display.seaLevelM===this.terrainDisplay.seaLevelM)return;this.terrainStyle=style;this.terrainDisplay=display;this.publish(false);}
  observeTerrainFrames(observer:typeof this.terrainObserver){this.terrainObserver=observer;}
  observePreparedScreens(observer:((screen:TerrainPreparedScreen)=>void)|null){this.preparedObserver=observer;}
  get preparedScreenSnapshot():TerrainPreparedScreen|null{
    return this.contextAvailable&&this.terrainDrawn?.field?.stateId===this.preparedDrawn?.fieldState?this.preparedDrawn:null;
  }
  /** A retained screen can be a rollback owner while its camera frame is no
   * longer a valid pointer target. */
  get preparedInputUsable():boolean{
    const drawn=this.terrainDrawn,screen=this.preparedScreenSnapshot,current=this.terrainField;
    if(!drawn?.field?.prepared||!screen||this.preparedRestorePending||this.pendingField?.field.endFrameDraws||!current?.prepared)return false;
    const a=drawn.frame,b=this.frameValue,sameMatrix=(x:Frame['viewMatrix'],y:Frame['viewMatrix'])=>{
      const left=Array.from(x),right=Array.from(y);return left.length===right.length&&left.every((value,i)=>value===right[i]);
    };
    if(a.width!==b.width||a.height!==b.height||a.origin.x!==b.origin.x||a.origin.y!==b.origin.y||a.origin.z!==b.origin.z||
      !sameMatrix(a.viewMatrix,b.viewMatrix)||!sameMatrix(a.projectionMatrix,b.projectionMatrix))return false;
    const source=drawn.field.prepared.submission.expected.target,target=current.prepared.submission.expected.target;
    return source.token===target.token&&source.fence===target.fence&&source.revision===target.revision;
  }
  capturePreparedInputBinding():AtlasTerrainInputBinding {
    const field=this.terrainDrawn?.field?.prepared;
    if(!field||!this.preparedInputUsable)throw Error('Terrain-Eingabe benötigt ein bestätigtes Bild.');
    return{generation:this.generation,basis:{...field.basis},epoch:field.origin.epoch,editSeries:field.origin.editSeries,token:field.origin.target.token,pose:terrainInputPose(this.terrainDrawn!.frame),origin:field.origin};
  }
  /** Only the already active gesture may use a retained confirmed pair while a
   * safety camera/draft is pending. No buffer is retained across this call. Own
   * receipts advance the canonical prefix, not this basis/epoch/edit series. */
  samplePreparedInput(binding:AtlasTerrainInputBinding,pixel:{x:number;y:number}){
    const drawn=this.contextAvailable?this.terrainDrawn:null,screen=this.preparedScreenSnapshot,field=drawn?.field?.prepared;
    if(!drawn||!screen||!field||binding.generation!==this.generation||screen.fieldState!==drawn.field?.stateId||
      binding.origin!==field.origin||!terrainPreparedSameBasis(binding.basis,field.basis)||binding.epoch!==field.origin.epoch||binding.editSeries!==field.origin.editSeries||binding.token!==field.origin.target.token||
      binding.pose!==terrainInputPose(drawn.frame)||binding.pose!==terrainInputPose(this.frameValue))return null;
    const segment=drawn.frame.ray(pixel);if(!segment)return null;
    const hit=field.ray.intersect(segment,drawn.alpha,drawn.frame.origin.z);
    return{frame:drawn.frame,screen,segment,hit};
  }
  /** A remains a CPU-only escape owner after B draws. Its immutable wire
   * stores survive B updates; no third draft GPU bank is pinned. */
  capturePreparedEscape():AtlasTerrainPreparedEscape{
    const drawn=this.terrainDrawn,screen=this.preparedScreenSnapshot;
    if(!drawn?.field?.prepared||!screen||!this.preparedInputUsable||screen.fieldState!==drawn.field.stateId||this.pendingField)throw Error('Terrain-Escape benötigt bestätigten A-Screen.');
    this.preparedEscape=drawn.field;this.preparedEscapeToken=Symbol('terrain-prepared-escape');this.preparedEscapeAlpha=screen.alpha;
    return{token:this.preparedEscapeToken,screen};
  }
  restorePreparedEscape(snapshot:AtlasTerrainPreparedEscape):number{
    if(!this.preparedEscape||snapshot.token!==this.preparedEscapeToken||!this.preparedEscape.prepared||this.preparedEscapeAlpha===null||!this.preparedScreenSnapshot)throw Error('Terrain-Escape-Snapshot nicht mehr gültig.');
    const submission=this.preparedEscape.prepared.submission;
    // Submission stores the immutable A backing table. The normal K3 pending
    // path keeps B drawn until this new A draw is actually confirmed.
    this.preparedRestorePending=true;
    try{const content=this.applyPreparedTerrain(submission,this.terrainStyle,this.terrainDisplay,this.preparedEscapeAlpha);this.preparedRestorePending=!!this.pendingField;return content;}
    catch(error){this.preparedRestorePending=false;throw error;}
  }
  releasePreparedEscape(snapshot:AtlasTerrainPreparedEscape){
    if(snapshot.token!==this.preparedEscapeToken)throw Error('Terrain-Escape-Besitzer ungültig.');
    this.preparedEscape=null;this.preparedEscapeToken=null;this.preparedEscapeAlpha=null;this.preparedRestorePending=false;
  }
  get terrainSnapshot(){return this.terrainDrawn;}
  freezeTerrain(){this.terrainFrozen=true;if(this.terrainAnimation)cancelAnimationFrame(this.terrainAnimation);this.terrainAnimation=0;this.cancelTerrainContent();this.rollbackPendingField();const drawn=this.terrainDrawn;if(drawn){this.terrain=drawn.renderModels;this.terrainField=drawn.field;this.terrainAlpha=drawn.alpha;this.terrainContentRevision=drawn.content;this.publish(false);}return drawn;}
  /** Continue only the exact prepared screen that input froze. The elapsed
   * portion of the 180 ms morph is the Float32 alpha actually drawn, not an
   * unconfirmed queued frame. K3 still owns the real old-slot-free endframe. */
  resumePreparedTerrain(screen:TerrainPreparedScreen):void{
    this.guard();
    const drawn=this.terrainDrawn;
    if(!this.terrainFrozen||!drawn?.field?.prepared||this.preparedScreenSnapshot!==screen||
      screen.content!==drawn.content||screen.fieldState!==drawn.field.stateId||screen.alpha!==Math.fround(drawn.alpha)||
      this.terrainField!==drawn.field||this.pendingField||!this.preparedInputUsable||screen.alpha>=1)
      throw Error('Terrain-Resume benötigt den aktuellen bestätigten Frozen-Screen.');
    this.terrainAlpha=screen.alpha;
    this.terrainMorphStart=performance.now()-screen.alpha*180;
    this.terrainFrozen=false;
    this.armFieldContentDeadline(screen.content,'complete');
    try{this.publish(false);this.animateTerrain();}
    catch(error){this.fail(error);throw error;}
  }
  private clearFieldContentDeadline(){if(this.fieldContentDeadline)clearTimeout(this.fieldContentDeadline.timer);this.fieldContentDeadline=null;}
  private armFieldContentDeadline(content:number,goal:'screen'|'complete'='complete'){
    this.clearFieldContentDeadline();
    const delay=this.options.timeoutMs??15000;
    const timer=setTimeout(()=>{
      if(this.fieldContentDeadline?.content!==content||this.disposed||this.lost||this.failure)return;
      if(this.terrainDrawn?.content===content&&(goal==='screen'||this.terrainDrawn.complete)){this.clearFieldContentDeadline();return;}
      this.fail(Error(`Terrainfeld-Screenframe für Inhalt ${content} nicht binnen ${delay} ms bestätigt.`));
    },delay);
    this.fieldContentDeadline={content,goal,timer};
  }
  cancelTerrainContent(error:Error=Error('Terraininhalt abgelöst.')){this.clearFieldContentDeadline();for(const waiter of [...this.contentWaiters]){this.contentWaiters.delete(waiter);waiter.reject(error);}}
  waitForTerrainContent(content:number):Promise<void>{
    if(this.terrainDrawn?.content===content&&this.terrainDrawn.complete)return Promise.resolve();
    if(!this.contextAvailable)return Promise.reject(Error('Terrainoberfläche nicht verfügbar.'));
    return new Promise((resolve,reject)=>this.contentWaiters.add({content,resolve,reject}));
  }
  private animateTerrain(){
    if(this.terrainFrozen||this.terrainAlpha>=1)return;
    this.terrainAnimation=requestAnimationFrame(()=>{this.terrainAnimation=0;if(this.disposed||this.lost||this.terrainFrozen)return;this.publish(false);this.animateTerrain();});
  }
  private terrainLayers():Layer[]{
    const frame=this.frameValue;
    const field=this.terrainField;if(field&&this.terrainFieldOwner){
      const generation=this.generation,revision=this.revision,content=this.terrainContentRevision,alpha=Math.fround(this.terrainAlpha);
      const layer=(value:TerrainFieldState,visible:boolean)=>{
        const object=value.newModels[0]?.object??value.oldModels[0]?.object;if(!object)return null;
        return new AtlasTerrainFieldLayer({id:value.layerId,data:[object],mesh:value.geometry as never,owner:this.terrainFieldOwner!,tables:value.tables,geometry:value.geometry,endFrameDraws:value.endFrameDraws,oldModels:value.oldModels,newModels:value.newModels,draftModels:value.draftModels,oldBase:value.oldBase,newBase:value.newBase,draftBase:value.draftBase,alpha:this.terrainAlpha,frameOrigin:frame.origin,exaggeration:frame.camera.exaggeration,terrainStyle:this.terrainStyle,seaLevelM:this.terrainDisplay.seaLevelM,materialBand:Math.max(frame.camera.metersPerPixel*.5,1e-6),onDrawSuccess:uploadedAlpha=>{
          if(visible&&generation===this.generation&&revision===this.revision&&this.renderingRevision===revision&&this.contextAvailable&&
            this.terrainField===value&&this.terrainContentRevision===content&&this.frameValue===frame&&uploadedAlpha===alpha)
            this.fieldScreenProof={generation,revision,frame,field:value,content,alpha,endFrame:!!value.prepared&&alpha===1&&(value.endFrameDraws??value.geometry.draws).every(draw=>draw.oldSlot<0)};
        },coordinateSystem:COORDINATE_SYSTEM.CARTESIAN,getPosition:[0,0,0],getColor:[255,255,255,255],pickable:true,visible,parameters:{depthWriteEnabled:true,depthCompare:'less-equal',cullMode:'none'}});
      };
      const older=this.pendingField?.previous;if(older&&older.layerId!==field.layerId){const retained=layer(older,false),candidate=layer(field,true);return [retained,candidate].filter((item):item is AtlasTerrainFieldLayer=>!!item);}
      const current=layer(field,true),legacy=this.pendingField?.field===field&&!older&&this.terrainDrawn?.field===null?this.legacyTerrainLayers(this.terrainDrawn.renderModels,false):[];
      return [...legacy,...(current?[current]:[])];
    }
    return this.legacyTerrainLayers(this.terrain);
  }
  private legacyTerrainLayers(terrain:readonly AtlasTerrainTileModel[],visible=true):Layer[]{
    const frame=this.frameValue;
    return terrain.map(tile=>new AtlasTerrainMaterialLayer({
      id:`atlas-scene:${tile.object.id}`,data:tile.data,mesh:tile.mesh,baseColor:tile.texture,
      masks:tile.masks,cover:tile.cover,relief:tile.relief,terrainStyle:this.terrainStyle,heightOrigin:tile.object.origin.heightM,
      transition:tile.transition,transitionAlpha:this.terrainAlpha,transitionComplete:!!tile.transition&&this.terrainAlpha>=1,
      materialOrigin:[cartographicPhase(tile.object.origin.x),cartographicPhase(tile.object.origin.y)],
      ...this.terrainDisplay,automaticStep:terrainContourStep(frame.camera.metersPerPixel*(this.options.styleScale??1)),pixelRatio:(this.options.pixelRatio??globalThis.devicePixelRatio??1)*(this.options.styleScale??1),
      coordinateSystem:COORDINATE_SYSTEM.CARTESIAN,
      getPosition:[tile.object.origin.x-frame.origin.x,tile.object.origin.y-frame.origin.y,(tile.object.origin.heightM-frame.origin.z)*frame.camera.exaggeration],
      getScale:[1,1,frame.camera.exaggeration],getColor:[255,255,255,255],material:ATLAS_UNLIT_MATERIAL,pickable:'3d',
      textureParameters:{minFilter:'linear',magFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'},
      updateTriggers:{getPosition:[frame.origin.x,frame.origin.y,frame.origin.z,frame.camera.exaggeration],getScale:frame.camera.exaggeration},
      getPolygonOffset:()=>[0,0],visible,parameters:{depthWriteEnabled:true,depthCompare:'less-equal',cullMode:'none'}
    }));
  }
  setDrawing(drawing:((frame:Frame)=>Layer[])|null){this.drawing=drawing;this.publish(false);}
  setLabels(labels: readonly AtlasDeckLabel[]): void {
    this.guard(); this.labels = labels; this.publish(false);
  }
  private labelLayers(): Layer[] {
    if (!this.labels.length) return [];
    this.labelLayout ??= createAtlasDeckLabels(this.options.container.ownerDocument);
    return [this.labelLayout.layer(this.frameValue, this.labels)];
  }
  resize(): void {
    if (this.disposed) return;
    const width = Math.max(1, this.options.container.clientWidth), height = Math.max(1, this.options.container.clientHeight);
    if (width === this.frameValue.viewport.width && height === this.frameValue.viewport.height) return;
    // A resize changes the pointer-to-world transform; begin another drag only
    // after release rather than reusing an anchor in an obsolete viewport.
    this.drag = null; this.publish();
  }
  terrainRay(segment:Parameters<AtlasTerrainFieldRayIndex['intersect']>[0]){
    const drawn=this.contextAvailable?this.terrainDrawn:null,field=drawn?.field;
    if(!drawn||!field)return null;
    if(!field.prepared)return field.ray?.intersect(segment,drawn.alpha)??null;
    if(!this.preparedInputUsable)return null;
    const hit=field.prepared.ray.intersect(segment,drawn.alpha,drawn.frame.origin.z);
    if(!hit)return null;
    const model=(hit.sourceBank==='old'?field.oldModels:field.newModels)[hit.sourceIndex];
    if(!model)throw Error('Terrain-Pickquelle fehlt im bestätigten Screen.');
    return{...hit,model};
  }
  pick(x: number, y: number): AtlasDeckHit | null {
    this.guard();
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Atlas pick requires finite coordinates');
    if (!this.frameUsable) return null;
    ensureAtlasDeckPickingDepth(this.deckValue!,reservation=>this.reservePickerAllocation(reservation.next));
    const info = this.deckValue!.pickObject({x, y, radius: 0});
    const object = info?.object as AtlasDeckSceneObject | undefined;
    if(info?.picked&&info.layer?.id===this.terrainDrawn?.field?.layerId){
      const segment=this.frameValue.ray({x,y}),hit=segment&&this.terrainRay(segment);return hit?{id:hit.model.object.id,target:hit.model.object.target,point:{x:hit.point[0],y:hit.point[1],heightM:hit.point[2]}}:null;
    }
    // Treat renderer output as untrusted: overview layers are non-pickable, and
    // only the exact canonical scene object instances have semantic targets.
    const terrainHit=object&&this.terrain.some(tile=>tile.object===object);
    if (!info?.picked || info.index !== 0 || !object || (!terrainHit&&(!this.modelValue.objects.some(candidate => candidate === object)||this.modelValue.targets.get(object.id)!==object.target)) ||
      info.layer?.id !== `atlas-scene:${object.id}`) return null;
    const segment = this.frameValue.ray({x, y});
    const point = segment ? refineAtlasDeckRayHit({object, segment})?.point ?? null : null;
    return {id: object.id, target: object.target, point};
  }
  waitForFrame(): Promise<void> {
    this.guard();
    if(this.failure)return Promise.reject(this.failure);
    if (this.frameUsable) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const waiter = {resolve: () => { clearTimeout(timer); this.waiters.delete(waiter); resolve(); },
        reject: (error: Error) => { clearTimeout(timer); this.waiters.delete(waiter); reject(error); }};
      const timer = setTimeout(() => waiter.reject(new Error(`Atlas frame readiness timeout (loaded=${this.loaded}, lost=${this.lost}, revision=${this.revision}, rendered=${this.renderedRevision})`)), this.options.timeoutMs ?? 15000);
      this.waiters.add(waiter);
    });
  }
  private async start(): Promise<void> {
    const generation = ++this.generation;
    this.loaded = false; this.lost = false; this.failure=null; this.renderedRevision = -1;this.preparedDrawn=null;
    this.bindInput();
    const ready = this.waitForFrame();
    try {
      this.deckValue = (this.options.createDeck ?? (props => new Deck<AtlasMetricView[]>(props)))({
        canvas: this.canvasValue, width: this.frameValue.viewport.width, height: this.frameValue.viewport.height,
        useDevicePixels: this.options.pixelRatio??true, controller: false, viewState: {},
        views: [new AtlasMetricView({id: 'atlas-metric', frame: this.frameValue})], layers: [],
        deviceProps: {type: 'webgl', webgl: {antialias: true, preserveDrawingBuffer: true}},
        onDeviceInitialized: device=>{if(generation===this.generation)this.gpuDevice=device;},
        onLoad: () => {
          if (this.disposed || generation !== this.generation) return;
          this.loaded = true;
          try { ensureAtlasDeckPickingDepth(this.deckValue!,reservation=>this.reservePickerAllocation(reservation.next));this.restoreTerrainField();this.publish(); }
          catch (error) { this.fail(error); }
        },
        ...this.renderCallbacks(generation, this.revision),
        onError: error => { if (!this.lost && !this.disposed && generation === this.generation) this.fail(error); }
      });
    } catch (error) { this.fail(error); }
    await ready;
  }
  /** A completion belongs to the props that began drawing, not whichever props
   * are current when an old callback eventually returns. */
  private renderCallbacks(generation:number,revision:number) {
    return {
      onBeforeRender:()=>{
        if(generation===this.generation&&revision===this.revision&&this.contextAvailable){this.renderingRevision=revision;this.fieldScreenProof=null;}
      },
      onAfterRender:()=>{
        if(generation!==this.generation||revision!==this.revision||!this.contextAvailable||this.renderingRevision!==revision)return;
        if(this.gpuContextLost()){this.handleContextLoss();return;}
        this.renderingRevision=-1;
        if((this.deckValue?.props.layers??[]).some(layer=>layer&&'isLoaded' in layer&&layer.isLoaded===false))return;
        const field=this.terrainField,proof=this.fieldScreenProof;
        if(field&&(!proof||proof.generation!==generation||proof.revision!==revision||proof.frame!==this.frameValue||
          proof.field!==field||proof.content!==this.terrainContentRevision||proof.alpha!==Math.fround(this.terrainAlpha)))return;
        if(field)this.terrainAlpha=proof!.alpha;
        if(field?.prepared&&proof!.alpha===1&&!proof!.endFrame&&field.geometry.draws.some(draw=>draw.oldSlot>=0)){
          // The first alpha-one draw still binds old material in the full FS.
          // Keep every old slot until the same content draws once more with no
          // old material lookup. Only that second screen may retire the bank.
          const endMetadataBytes=field.geometry.draws.length*128;
          const projectedCpu=this.preparedResourceInventory().rendererBackingBytes+endMetadataBytes+ATLAS_TERRAIN_FIELD_UPLOAD_SCRATCH;
          if(!Number.isSafeInteger(projectedCpu)){this.fail(Error('Terrain-P-Endframe-Besitzer nicht bilanzierbar.'));return;}
          this.preparedCpuPeakBytes=Math.max(this.preparedCpuPeakBytes,projectedCpu);
          const endFrameDraws=field.geometry.draws.map(draw=>({...draw,oldSlot:-1}));
          const endField:TerrainFieldState={...field,endFrameDraws,stateId:++this.fieldSerial};
          if(this.pendingField?.field===field)this.pendingField.field=endField;
          else this.pendingField={field:endField,previous:field,fresh:[]};
          this.terrainField=endField;
          try{this.publish(false);}catch(error){this.fail(error);}
          return;
        }
        const pending=this.pendingField;
        if(pending&&this.terrainField===pending.field){
          try{
            this.terrainFieldOwner!.publish(pending.field.slots);pending.published=true;
            if(pending.previous?.slots.length)this.terrainFieldOwner!.release(pending.previous.slots);
            if(pending.previous&&pending.previous.tables!==pending.field.tables)this.terrainFieldOwner!.releaseTables(pending.previous.tables);
            this.confirmedField=pending.field;this.pendingField=null;
            this.preparedRestorePending=false;
            if(!pending.previous||pending.previous.layerId!==pending.field.layerId)queueMicrotask(()=>{if(!this.disposed&&!this.lost&&!this.failure&&this.confirmedField===pending.field)this.publish(false);});
          }catch(error){this.terrainFieldOwner?.dispose();this.terrainFieldOwner=null;this.fail(error);return;}
        }
        this.renderedRevision=revision;
        this.lastDrawingSize=[this.canvasValue.width,this.canvasValue.height];
        this.renderedTerrainRevision=this.terrainRevision;
        if(this.renderedTerrainContentRevision!==this.terrainContentRevision){this.renderedTerrainContentRevision=this.terrainContentRevision;terrainTraceMeasure('frame.terrain',()=>{},this.terrainContentRevision);}
        if(this.terrainMorphStart===null&&this.terrainAlpha<1)this.terrainMorphStart=performance.now();
        for(const model of this.terrain)if(model.transition){model.transition.progress=this.terrainAlpha;model.transition.presented=true;model.transition.start=this.terrainMorphStart??performance.now();}
        const models=this.terrainAlpha>=1?this.terrain:this.terrain.map(model=>model.transition?{...model,grid:atlasTerrainDisplayedGrid(model),transition:undefined}:model);
        this.terrainDrawn={at:performance.now(),frame:this.frameValue,content:this.terrainContentRevision,complete:this.terrainAlpha>=1,alpha:this.terrainAlpha,models,renderModels:this.terrain,field:this.terrainField};
        this.preparedDrawn=field?.prepared?{surfaceGeneration:generation,frameRevision:revision,fieldState:field.stateId!,content:this.terrainContentRevision,alpha:Math.fround(this.terrainAlpha),endFrame:proof!.endFrame,basis:field.prepared.basis,draftRevision:field.prepared.draftRevision}:null;
        if(this.fieldContentDeadline?.content===this.terrainDrawn.content&&
          (this.fieldContentDeadline.goal==='screen'||this.terrainDrawn.complete))this.clearFieldContentDeadline();
        if(field&&this.terrainAlpha>=1&&(!field.prepared?!field.draftModels.length:proof!.endFrame)&&field.oldModels.length){const retired=field.oldModels.map((_,i)=>field.oldBase+i).filter(slot=>field.slots.includes(slot));if(retired.length){this.terrainFieldOwner?.release(retired);field.slots=field.slots.filter(slot=>!retired.includes(slot));}}
        for(const waiter of [...this.contentWaiters])if(waiter.content===this.terrainContentRevision&&this.terrainDrawn.complete){this.contentWaiters.delete(waiter);waiter.resolve();}
        for(const waiter of [...this.waiters])waiter.resolve();
        // Observers may synchronously publish another camera/frame. Finish all
        // ownership and waiter decisions for this confirmed frame first.
        const drawn=this.terrainDrawn,preparedScreen=this.preparedDrawn;
        this.terrainObserver?.(drawn);
        if(preparedScreen&&this.preparedDrawn===preparedScreen)this.preparedObserver?.(preparedScreen);
        // Native qualification may bind an independent triangle intersection to
        // this exact afterRender-confirmed CPU snapshot. Production installs no
        // hook and pays no copying or retained-history cost.
        (globalThis as typeof globalThis&{__atlasTerrainFrameProbe?:(snapshot:NonNullable<AtlasDeckSurface['terrainDrawn']>)=>void}).__atlasTerrainFrameProbe?.(drawn);
      }
    };
  }
  private fail(value: unknown): void {
    let error = value instanceof Error ? value : new Error(String(value));
    this.fieldScreenProof=null;
    this.preparedRestorePending=false;
    try{this.rollbackPendingField();}catch(rollback){error=new AggregateError([error,rollback],'Terrainfeld-Rollback fehlgeschlagen.');}
    if(this.terrainDrawn){this.terrain=this.terrainDrawn.renderModels;this.terrainField=this.terrainDrawn.field;this.terrainAlpha=this.terrainDrawn.alpha;this.terrainContentRevision=this.terrainDrawn.content;}
    if(this.lost||!this.confirmedField){this.terrainFieldOwner?.dispose();this.terrainFieldOwner=null;if(this.confirmedField)this.confirmedField.slots=[];this.pickerDrawn=null;this.lastDrawingSize=null;}
    this.failure=error;this.cancelTerrainContent(error);
    ++this.generation; // Fence even a delayed onLoad after a failed GPU initialization.
    this.renderedRevision = -1; this.loaded = false;
    for (const waiter of [...this.waiters]) waiter.reject(error);
    this.options.onError?.(error);
  }
  private gpuContextLost():boolean{
    const device=this.gpuDevice as (Device&{gl?:{isContextLost?:()=>boolean}})|null;
    return !!(device?.isLost||device?.gl?.isContextLost?.());
  }
  private handleContextLoss():void{
    if(this.lost||this.disposed)return;
    this.lost=true;this.renderedRevision=-1;this.renderingRevision=-1;this.drag=null;
    const drawn=this.terrainDrawn;
    this.terrainDrawn=null;this.preparedDrawn=null;this.preparedEscape=null;this.preparedEscapeToken=null;this.preparedEscapeAlpha=null;this.preparedRestorePending=false;this.renderedTerrainRevision=-1;
    if(drawn){this.terrain=drawn.renderModels;this.terrainField=drawn.field;this.terrainAlpha=drawn.alpha;this.terrainContentRevision=drawn.content;}
    this.options.onContextLost?.();
    this.fail(Error('Atlas WebGL-Kontext verloren. Ausdrücklicher Neustart erforderlich.'));
  }
  private bindInput(): void {
    const canvas = this.canvasValue;
    type Events = HTMLElementEventMap & {webglcontextlost: Event};
    const listen = <K extends keyof Events>(type: K, callback: (event: Events[K]) => void, options?: AddEventListenerOptions) => {
      if(this.options.externalInput&&type!=='webglcontextlost')return;
      canvas.addEventListener(type, callback as EventListener, options); this.listeners.push(() => canvas.removeEventListener(type, callback as EventListener, options));
    };
    const pixel = (event: MouseEvent) => { const r = canvas.getBoundingClientRect(); return {x: event.clientX - r.left, y: event.clientY - r.top}; };
    listen('pointerdown', event => {
      if (this.lost || event.button !== 0 && event.button !== 2) return;
      canvas.focus(); canvas.setPointerCapture(event.pointerId); event.preventDefault();
      this.drag = {id: event.pointerId, pixel: pixel(event), camera: this.camera, rotate: event.button === 2 || event.shiftKey};
    });
    listen('pointermove', event => {
      const drag = this.drag;
      if (!drag || drag.id !== event.pointerId || this.lost) return;
      const now = pixel(event);
      if (drag.rotate) this.setCamera({...drag.camera,
        rotation: drag.camera.rotation + (now.x - drag.pixel.x) * .3,
        tilt: Math.max(0, Math.min(75, drag.camera.tilt + (now.y - drag.pixel.y) * .3))});
      else this.setCamera(atlasMetricPanAt(drag.camera, this.frameValue.viewport.width, this.frameValue.viewport.height, drag.pixel, now));
    });
    const release = (event: PointerEvent) => {
      if (this.drag?.id === event.pointerId) this.drag = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    listen('pointerup', release); listen('pointercancel', release); listen('lostpointercapture', () => { this.drag = null; });
    listen('contextmenu', event => event.preventDefault());
    listen('wheel', event => {
      if (this.lost) return;
      event.preventDefault(); this.drag = null;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.frameValue.viewport.height : 1);
      this.setCamera(atlasMetricZoomAt(this.cameraValue, this.frameValue.viewport.width, this.frameValue.viewport.height, pixel(event), Math.exp(Math.max(-2, Math.min(2, delta * .002)))));
    }, {passive: false});
    listen('keydown', event => {
      if (this.lost) return;
      const moves: Record<string, [number, number]> = {ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40]};
      const move = moves[event.key], center = {x: this.frameValue.viewport.width / 2, y: this.frameValue.viewport.height / 2};
      if (move) { event.preventDefault(); this.setCamera(atlasMetricPanAt(this.cameraValue, this.frameValue.viewport.width, this.frameValue.viewport.height, center, {x: center.x + move[0], y: center.y + move[1]})); }
      else if (event.key === '+' || event.key === '-') { event.preventDefault(); this.setCamera(atlasMetricZoomAt(this.cameraValue, this.frameValue.viewport.width, this.frameValue.viewport.height, center, event.key === '+' ? .8 : 1.25)); }
    });
    listen('webglcontextlost', event => {
      event.preventDefault();this.handleContextLoss();
    });
  }
  /** An explicit caller may recreate disposable GPU state after context loss.
   * Generation fencing prevents late callbacks reviving old GPU state. */
  recover(): Promise<void> {
    this.guard();
    if (this.recovery) return this.recovery;
    if(!this.lost&&!this.failure)return Promise.reject(Error('Atlas-Neustart ohne GPU-Fehler abgewiesen.'));
    this.recovery = (async () => {
      const focused = this.canvasValue.ownerDocument.activeElement === this.canvasValue;
      ++this.generation;
      for (const off of this.listeners.splice(0)) off();
      this.deckValue?.finalize(); this.deckValue = null;this.terrainFieldOwner?.dispose();this.terrainFieldOwner=null;if(this.terrainField)this.terrainField.slots=[];
      this.canvasValue.remove(); this.canvasValue = this.makeCanvas();
      if (focused) this.canvasValue.focus();
      await this.start();this.animateTerrain();
    })().finally(() => { this.recovery = null; });
    return this.recovery;
  }
  dispose(): void {
    this.cancelTerrainContent();this.terrainObserver=null;this.preparedObserver=null;this.preparedDrawn=null;this.preparedEscape=null;this.preparedEscapeToken=null;this.preparedEscapeAlpha=null;this.preparedRestorePending=false;
    if (this.disposed) return;
    this.disposed = true; ++this.generation; this.drag = null;this.fieldScreenProof=null;
    if(this.terrainAnimation)cancelAnimationFrame(this.terrainAnimation);this.terrainAnimation=0;
    this.observer.disconnect();
    for (const off of this.listeners.splice(0)) off();
    for (const waiter of [...this.waiters]) waiter.reject(new Error('Atlas surface disposed'));
    this.deckValue?.finalize(); this.deckValue = null;this.terrainFieldOwner?.dispose();this.terrainFieldOwner=null;this.terrainField=null;this.confirmedField=null;this.pendingField=null;this.terrainDrawn=null; this.canvasValue.remove();
  }
}
