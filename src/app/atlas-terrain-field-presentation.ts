import {atlasTerrainFieldPointOwner,atlasTerrainFieldSourceOrder,type AtlasTerrainTileModel} from './atlas-terrain-tile-model';
import {Buffer,type Device,type Texture} from '@luma.gl/core';
import {GPUGeometry,Model} from '@luma.gl/engine';
import {SimpleMeshLayer,type SimpleMeshLayerProps} from '@deck.gl/mesh-layers';
import {terrainGridLayout} from './terrain-grid-layout';
import type {TerrainStyle} from './terrain-relief';
import {TERRAIN_PREPARED_GLSL,TERRAIN_PREPARED_LAYOUT,terrainSplit} from './atlas-terrain-prepared-field';

/** CPU half of the surface-owned field path. Its buffers are complete before a
 * GPU array is reserved; a failed count cannot leave a partial field upload. */
export const ATLAS_TERRAIN_FIELD_GPU={
  total:480*1024*1024,geometry:24*1024*1024,drawMetadata:1024*1024,
  vertexStride:16,indexStride:4,drawMetadataStride:128,
  maxSources:32,maxDraftSources:32,maxDrawingWidth:1920,maxDrawingHeight:1080,
  fieldArrays:136380928,neighborTables:262144,legacyMeasuredCalm:45780654
} as const;
/** Conditional P representation: the old K3 allowance remains unchanged. */
export const ATLAS_TERRAIN_PREPARED_GPU={...ATLAS_TERRAIN_FIELD_GPU,total:512*1024*1024,geometry:64*1024*1024} as const;
export const ATLAS_TERRAIN_FIELD_SLOTS=128;
export const ATLAS_TERRAIN_FIELD_META_ROWS=25;
export const ATLAS_TERRAIN_FIELD_LOOKUP_SIZE=64;
/** Two packed/upload copies plus the complete four-bank owner grid. */
export const ATLAS_TERRAIN_FIELD_UPLOAD_SCRATCH=2*128*ATLAS_TERRAIN_FIELD_META_ROWS*16+64*256+3*64*64;

export interface AtlasTerrainFieldPilotPreflight {
  drawingWidth:number;drawingHeight:number;
  /** Luma's observed count is diagnostic; browser-owned buffers are modeled separately. */
  observedLumaGpuBytes:number;
  /** Actual old material textures, including former morph textures. */
  materialTextures:readonly AtlasFieldTextureInventory[];
  morphTextures:readonly {destroyed?:boolean}[];
  picker:{color:{width:number;height:number;colorAttachments:readonly {texture:{format:string;samples?:number}}[];depthStencilAttachment?:{texture:{format:string;samples?:number}};destroyed?:boolean};depth:{width:number;height:number;colorAttachments:readonly {texture:{format:string;samples?:number}}[];depthStencilAttachment?:{texture:{format:string;samples?:number}};destroyed?:boolean};drawnColor:object;drawnDepth:object};
  previousDrawingSize?:readonly [number,number];
  candidatePickerSize?:readonly [number,number];
  fieldArraysResident?:boolean;
  fieldArrayTextures?:readonly AtlasFieldTextureInventory[];
  /** Physical live tables and the exact next allocation, counted separately. */
  retainedTables:readonly AtlasFieldTextureInventory[];
  plannedTables:readonly AtlasFieldTextureInventory[];
  retainedFieldGpuGeometryBytes:number;
  newFieldGpuGeometryBytes:number;
  retainedDrawMetadataBytes:number;
  newDrawMetadataBytes:number;
}
export interface AtlasFieldTextureInventory {width:number;height:number;format:string;depth?:number;samples?:number;destroyed?:boolean}
export const atlasTerrainFieldPlannedTables=():readonly AtlasFieldTextureInventory[]=>[
  {width:ATLAS_TERRAIN_FIELD_SLOTS,height:ATLAS_TERRAIN_FIELD_META_ROWS,format:'rgba32float',depth:1,samples:1},
  {width:64,height:256,format:'r8uint',depth:1,samples:1}
];
function atlasGpuPixels(width:number,height:number){if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)throw Error('Terrainfeld-GPU-Maße ungültig.');return width*height;}
function atlasGpuFormatBytes(format:string){const bytes:{[key:string]:number}={rgba8unorm:4,rgba32float:16,depth24plus:4,r32float:4,r8uint:1};const count=bytes[format];if(!count)throw Error(`Terrainfeld-GPU-Format ${format} nicht bilanziert.`);return count;}
function atlasTextureInventoryBytes(texture:AtlasFieldTextureInventory){
  if(texture.destroyed)throw Error('Freigegebene Terrainfeld-Tabelle als Besitzer gezählt.');
  const depth=texture.depth??1,samples=texture.samples??1;
  if(!Number.isSafeInteger(depth)||depth<1||!Number.isSafeInteger(samples)||samples<1)throw Error('Terrainfeld-Tabellen-Layer/Samples ungültig.');
  return atlasGpuPixels(texture.width,texture.height)*depth*samples*atlasGpuFormatBytes(texture.format);
}
function atlasPickerFramebufferBytes(frame:AtlasTerrainFieldPilotPreflight['picker']['color']){
  if(frame.destroyed||frame.colorAttachments.length!==1||frame.depthStencilAttachment?.texture.format!=='depth24plus')throw Error('Terrainfeld-Picker-Besitzer ungültig.');
  const attachment=frame.colorAttachments[0]!.texture,depth=frame.depthStencilAttachment.texture;
  const colorSamples=attachment.samples??1,depthSamples=depth.samples??1;
  if(!Number.isSafeInteger(colorSamples)||colorSamples<1||!Number.isSafeInteger(depthSamples)||depthSamples<1)throw Error('Terrainfeld-Picker-Samples ungültig.');
  return atlasGpuPixels(frame.width,frame.height)*(atlasGpuFormatBytes(attachment.format)*colorSamples+atlasGpuFormatBytes(depth.format)*depthSamples);
}
/** Actual live owners and a separately named four-sample browser model. */
export function preflightAtlasTerrainFieldPilotGpu(input:AtlasTerrainFieldPilotPreflight,limit:typeof ATLAS_TERRAIN_FIELD_GPU|typeof ATLAS_TERRAIN_PREPARED_GPU=ATLAS_TERRAIN_FIELD_GPU){
  if(input.drawingWidth>limit.maxDrawingWidth||input.drawingHeight>limit.maxDrawingHeight)
    throw Error('Terrainfeld-Pilotfenster außerhalb des qualifizierten Drawingbuffer-Bounds.');
  const pixels=atlasGpuPixels(input.drawingWidth,input.drawingHeight),{color,depth,drawnColor,drawnDepth}=input.picker;
  if(color!==drawnColor||depth!==drawnDepth||color.width!==depth.width||color.height!==depth.height||
    (!input.candidatePickerSize&&(color.width!==input.drawingWidth||color.height!==input.drawingHeight))||
    (input.candidatePickerSize&&(input.candidatePickerSize[0]!==input.drawingWidth||input.candidatePickerSize[1]!==input.drawingHeight)))
    throw Error('Terrainfeld-Picker wurde nicht mit den aktuellen Anhängen gezeichnet.');
  const pickerCurrentBytes=atlasPickerFramebufferBytes(color)+atlasPickerFramebufferBytes(depth);
  if(color.colorAttachments[0]!.texture.format!=='rgba8unorm'||depth.colorAttachments[0]!.texture.format!=='rgba32float')throw Error('Terrainfeld-Picker-Format ungültig.');
  if(input.morphTextures.some(texture=>!texture.destroyed))throw Error('Terrainfeld-Morphtextur vor Arrayallokation noch nicht physisch freigegeben.');
  for(const value of [input.observedLumaGpuBytes,input.retainedFieldGpuGeometryBytes,input.newFieldGpuGeometryBytes,input.retainedDrawMetadataBytes,input.newDrawMetadataBytes])if(!Number.isSafeInteger(value)||value<0)
    throw Error('Terrainfeld-GPU-Bestandszählung ungültig.');
  if(input.fieldArraysResident&&input.fieldArrayTextures?.length!==5)throw Error('Terrainfeld-Arraybesitzer nicht vollständig inventarisiert.');
  const fieldArraysBytes=input.fieldArraysResident?[...new Set(input.fieldArrayTextures)].reduce((sum,array)=>sum+atlasTextureInventoryBytes(array),0):limit.fieldArrays;
  if(fieldArraysBytes>limit.fieldArrays)throw Error('Terrainfeld-Arraybudget überschritten.');
  const retainedTableBytes=[...new Set(input.retainedTables)].reduce((sum,table)=>sum+atlasTextureInventoryBytes(table),0);
  const plannedTableBytes=input.plannedTables.reduce((sum,table)=>sum+atlasTextureInventoryBytes(table),0);
  const geometryBytes=input.retainedFieldGpuGeometryBytes+input.newFieldGpuGeometryBytes,drawMetadataBytes=input.retainedDrawMetadataBytes+input.newDrawMetadataBytes,tablesBytes=retainedTableBytes+plannedTableBytes;
  if(geometryBytes>limit.geometry||drawMetadataBytes>limit.drawMetadata||tablesBytes>limit.neighborTables)throw Error('Terrainfeld-GPU-Geometrie-/Tabellenbudget überschritten.');
  const materialBytes=[...new Set(input.materialTextures.filter(texture=>!texture.destroyed))].reduce((sum,texture)=>sum+atlasTextureInventoryBytes(texture),0);
  const knownLuma=input.fieldArraysResident?fieldArraysBytes+input.retainedFieldGpuGeometryBytes+retainedTableBytes:0;
  const legacy=Math.max(materialBytes,limit.legacyMeasuredCalm,Math.max(0,input.observedLumaGpuBytes-knownLuma-pickerCurrentBytes));
  const previous=input.previousDrawingSize,previousPixels=previous?atlasGpuPixels(previous[0],previous[1]):0;
  const candidatePicker=input.candidatePickerSize,candidatePickerBytes=candidatePicker?atlasGpuPixels(candidatePicker[0],candidatePicker[1])*28:0;
  // Four MSAA color/depth samples plus resolve and preserve: 40 B per pixel.
  const defaultOldAndNew=(pixels+previousPixels)*40,pickerOldAndNew=pickerCurrentBytes+candidatePickerBytes;
  const peak=legacy+fieldArraysBytes+tablesBytes+drawMetadataBytes+geometryBytes+defaultOldAndNew+pickerOldAndNew;
  if(peak>limit.total)throw Error('Terrainfeld-GPU-Gesamtbudget vor Arrayallokation überschritten.');
  return {peakBytes:peak,headroomBytes:limit.total-peak,legacyBytes:legacy,materialBytes,observedLumaBytes:input.observedLumaGpuBytes,
    defaultOldAndNew,pickerOldAndNew,fieldArraysBytes,geometryBytes,tablesBytes,retainedTableBytes,plannedTableBytes,drawMetadataBytes};
}

type FieldArrayName='base'|'masks'|'cover'|'relief'|'height';
export interface AtlasTerrainFieldTables {readonly slotMetadata:Texture;readonly edgeOwners:Texture;}
/** One owner per AtlasDeckSurface. Layer finalizers never destroy these arrays. */
export class AtlasTerrainFieldGpuOwner {
  readonly arrays:Readonly<Record<FieldArrayName,Texture>>;
  readonly slotMetadata:Texture;
  readonly edgeOwners:Texture;
  private tables=new Set<AtlasTerrainFieldTables>();
  private slots=new Map<number,{source:AtlasTerrainTileModel;state:'reserved'|'uploaded'|'drawn';references:number}>();
  private disposed=false;
  private constructor(arrays:Record<FieldArrayName,Texture>,slotMetadata:Texture,edgeOwners:Texture,private readonly gl:WebGL2RenderingContext,private readonly device:Device){this.arrays=arrays;this.slotMetadata=slotMetadata;this.edgeOwners=edgeOwners;this.tables.add({slotMetadata,edgeOwners});}
  static create(device:Device,preflight:AtlasTerrainFieldPilotPreflight,limit:typeof ATLAS_TERRAIN_FIELD_GPU|typeof ATLAS_TERRAIN_PREPARED_GPU=ATLAS_TERRAIN_FIELD_GPU):AtlasTerrainFieldGpuOwner{
    preflightAtlasTerrainFieldPilotGpu(preflight,limit);
    const gl=(device as Device & {gl?:WebGL2RenderingContext}).gl;
    if(device.type!=='webgl'||!gl||!device.isTextureFormatSupported('r32float')||!device.isTextureFormatSupported('rgba8unorm'))
      throw Error('Terrainfeld-Arrayformate auf diesem WebGL-Gerät nicht unterstützt.');
    if(gl.MAX_ARRAY_TEXTURE_LAYERS!==undefined&&Number(gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS))<ATLAS_TERRAIN_FIELD_SLOTS)
      throw Error('Terrainfeld benötigt 128 physische Array-Layer.');
    const made:Texture[]=[],arrays={} as Record<FieldArrayName,Texture>;
    try{
      for(const name of ['base','masks','cover','relief','height'] as const){
        const height=name==='height';
        const texture=device.createTexture({id:`atlas-terrain-field-${name}`,dimension:'2d-array',
          width:height?65:256,height:height?65:256,depth:ATLAS_TERRAIN_FIELD_SLOTS,mipLevels:1,
          format:height?'r32float':'rgba8unorm',
          sampler:{minFilter:height?'nearest':'linear',magFilter:height?'nearest':'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'}});
        made.push(texture);arrays[name]=texture;
      }
      const slotMetadata=device.createTexture({id:'atlas-terrain-field-slot-metadata',dimension:'2d',width:ATLAS_TERRAIN_FIELD_SLOTS,height:ATLAS_TERRAIN_FIELD_META_ROWS,mipLevels:1,
        format:'rgba32float',sampler:{minFilter:'nearest',magFilter:'nearest',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'}});
      made.push(slotMetadata);
      const edgeOwners=device.createTexture({id:'atlas-terrain-field-edge-owners',dimension:'2d',width:64,height:256,mipLevels:1,
        format:'r8uint',sampler:{minFilter:'nearest',magFilter:'nearest',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'}});
      made.push(edgeOwners);
      return new AtlasTerrainFieldGpuOwner(arrays,slotMetadata,edgeOwners,gl,device);
    }catch(error){for(const texture of made)texture.destroy();throw error;}
  }
  get initialTables():AtlasTerrainFieldTables{return [...this.tables][0]!;}
  get liveArrays():readonly AtlasFieldTextureInventory[]{return Object.values(this.arrays);}
  get liveArrayBytes(){return this.liveArrays.reduce((sum,array)=>sum+atlasTextureInventoryBytes(array),0);}
  get liveTables():readonly AtlasFieldTextureInventory[]{return [...this.tables].flatMap(pair=>[pair.slotMetadata,pair.edgeOwners]);}
  createTables():AtlasTerrainFieldTables{
    if(this.disposed)throw Error('Terrainfeld-Besitzer freigegeben.');
    let slotMetadata:Texture|undefined,edgeOwners:Texture|undefined;
    try{
      slotMetadata=this.device.createTexture({id:'atlas-terrain-field-slot-metadata',dimension:'2d',width:ATLAS_TERRAIN_FIELD_SLOTS,height:ATLAS_TERRAIN_FIELD_META_ROWS,mipLevels:1,format:'rgba32float',sampler:{minFilter:'nearest',magFilter:'nearest',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'}});
      edgeOwners=this.device.createTexture({id:'atlas-terrain-field-edge-owners',dimension:'2d',width:64,height:256,mipLevels:1,format:'r8uint',sampler:{minFilter:'nearest',magFilter:'nearest',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'}});
      const tables={slotMetadata,edgeOwners};this.tables.add(tables);return tables;
    }catch(error){slotMetadata?.destroy();edgeOwners?.destroy();throw error;}
  }
  releaseTables(tables:AtlasTerrainFieldTables){if(!this.tables.delete(tables))return;tables.slotMetadata.destroy();tables.edgeOwners.destroy();}
  /** A half-written slot is never published; already drawn slots stay intact. */
  upload(slot:number,source:AtlasTerrainTileModel){
    if(this.disposed||!Number.isInteger(slot)||slot<0||slot>=ATLAS_TERRAIN_FIELD_SLOTS||this.slots.has(slot))throw Error('Terrainfeld-Slot nicht frei.');
    const channels=[['base',source.texture],['masks',source.masks],['cover',source.cover],['relief',source.relief]] as const;
    if(channels.some(([,image])=>image.width!==256||image.height!==256||image.data.byteLength!==256*256*4)||
      source.grid.heights.length!==65*65)throw Error('Terrainfeld-Quellformat ungültig.');
    this.slots.set(slot,{source,state:'reserved',references:0});
    try{
      this.writeSource(slot,source);
      this.slots.get(slot)!.state='uploaded';
    }catch(error){this.slots.delete(slot);throw error;}
  }
  holds(slot:number){return this.slots.has(slot);}
  source(slot:number){return this.slots.get(slot)?.source;}
  reuses(slot:number,source:AtlasTerrainTileModel){const held=this.slots.get(slot)?.source;return !!held&&held.grid.heights===source.grid.heights&&held.texture.data===source.texture.data&&held.masks.data===source.masks.data&&held.cover.data===source.cover.data&&held.relief.data===source.relief.data;}
  private writeSource(slot:number,source:AtlasTerrainTileModel){
    const channels=[['base',source.texture],['masks',source.masks],['cover',source.cover],['relief',source.relief]] as const;
    if(channels.some(([,image])=>image.width!==256||image.height!==256||image.data.byteLength!==256*256*4)||source.grid.heights.length!==65*65)throw Error('Terrainfeld-Quellformat ungültig.');
    for(const [name,image] of channels){this.uploadLayer(this.arrays[name],slot,256,256,this.gl.RGBA,this.gl.UNSIGNED_BYTE,image.data);this.checkUpload(name,slot);}
    this.uploadLayer(this.arrays.height,slot,65,65,this.gl.RED,this.gl.FLOAT,source.grid.heights);this.checkUpload('height',slot);
  }
  private uploadLayer(texture:Texture,slot:number,width:number,height:number,format:number,type:number,data:Uint8Array|Float32Array){
    const gl=this.gl,previous=gl.getParameter(gl.TEXTURE_BINDING_2D_ARRAY) as WebGLTexture|null,
      alignment=gl.getParameter(gl.UNPACK_ALIGNMENT) as number,rowLength=gl.getParameter(gl.UNPACK_ROW_LENGTH) as number;
    try{
      gl.bindTexture(gl.TEXTURE_2D_ARRAY,(texture as Texture & {handle:WebGLTexture}).handle);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);gl.pixelStorei(gl.UNPACK_ROW_LENGTH,0);
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,slot,width,height,1,format,type,data);
    }finally{
      gl.pixelStorei(gl.UNPACK_ALIGNMENT,alignment);gl.pixelStorei(gl.UNPACK_ROW_LENGTH,rowLength);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY,previous);
    }
  }
  private checkUpload(name:FieldArrayName,slot:number){
    const code=this.gl.getError();if(code!==this.gl.NO_ERROR)throw Error(`Terrainfeld-${name}-Upload Slot ${slot}: GL 0x${code.toString(16)}.`);
  }
  /** Reused per draw origin. CPU subtraction stays in double precision; the
   * shader never receives a Float32 encoding of the global world origin. */
  uploadSlotMetadata(origin:Point,oldModels:readonly AtlasTerrainTileModel[],newModels:readonly AtlasTerrainTileModel[],draftModels:readonly AtlasTerrainTileModel[]=[],bases={old:0,new:32,draft:64},tables:AtlasTerrainFieldTables=this.initialTables){
    if(this.disposed)throw Error('Terrainfeld-Besitzer freigegeben.');
    const pixels=packAtlasTerrainFieldSlotMetadata(origin,oldModels,newModels,draftModels,bases);
    this.upload2d(tables.slotMetadata,ATLAS_TERRAIN_FIELD_SLOTS,ATLAS_TERRAIN_FIELD_META_ROWS,this.gl.RGBA,this.gl.FLOAT,pixels);this.checkAuxUpload('Metadaten');
  }
  uploadEdgeOwners(oldModels:readonly AtlasTerrainTileModel[],newModels:readonly AtlasTerrainTileModel[],draftModels:readonly AtlasTerrainTileModel[]=[],bases={old:0,new:32,draft:64},tables:AtlasTerrainFieldTables=this.initialTables){
    if(this.disposed)throw Error('Terrainfeld-Besitzer freigegeben.');
    const data=prepareAtlasTerrainFieldEdgeOwners(oldModels,newModels,draftModels,bases);
    this.upload2d(tables.edgeOwners,64,256,this.gl.RED_INTEGER,this.gl.UNSIGNED_BYTE,data);this.checkAuxUpload('Randbesitzer');
  }
  private upload2d(texture:Texture,width:number,height:number,format:number,type:number,data:Uint8Array|Float32Array){
    const gl=this.gl,previous=gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture|null,alignment=gl.getParameter(gl.UNPACK_ALIGNMENT) as number,rowLength=gl.getParameter(gl.UNPACK_ROW_LENGTH) as number;
    try{gl.bindTexture(gl.TEXTURE_2D,(texture as Texture&{handle:WebGLTexture}).handle);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);gl.pixelStorei(gl.UNPACK_ROW_LENGTH,0);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,width,height,format,type,data);}
    finally{gl.pixelStorei(gl.UNPACK_ALIGNMENT,alignment);gl.pixelStorei(gl.UNPACK_ROW_LENGTH,rowLength);gl.bindTexture(gl.TEXTURE_2D,previous);}
  }
  private checkAuxUpload(name:string){const code=this.gl.getError();if(code!==this.gl.NO_ERROR)throw Error(`Terrainfeld-${name}-Upload: GL 0x${code.toString(16)}.`);}
  publish(slots:readonly number[]){
    if(this.disposed||new Set(slots).size!==slots.length||slots.some(slot=>this.slots.get(slot)?.state!=='uploaded'&&this.slots.get(slot)?.state!=='drawn'))
      throw Error('Terrainfeld-Draw referenziert nicht vollständig hochgeladene Slots.');
    for(const slot of slots){const state=this.slots.get(slot)!;state.state='drawn';state.references++;}
  }
  release(slots:readonly number[]){
    if(this.disposed)return;
    if(new Set(slots).size!==slots.length||slots.some(slot=>!this.slots.get(slot)||this.slots.get(slot)!.references<1))
      throw Error('Terrainfeld-Slotreferenz ungültig.');
    for(const slot of slots){const state=this.slots.get(slot)!;
      if(--state.references===0)this.slots.delete(slot);
    }
  }
  discardUnpublished(slots:readonly number[]){
    if(this.disposed)return;
    if(new Set(slots).size!==slots.length||slots.some(slot=>!this.slots.get(slot)||this.slots.get(slot)!.references!==0))
      throw Error('Terrainfeld-Rollback versucht gezeichneten Slot freizugeben.');
    for(const slot of slots)this.slots.delete(slot);
  }
  get heldSlots(){return this.slots.size;}
  dispose(){if(this.disposed)return;this.disposed=true;this.slots.clear();for(const texture of Object.values(this.arrays))texture.destroy();for(const tables of [...this.tables])this.releaseTables(tables);}
}

type Point={x:number;y:number};
type Box={x:number;y:number;width:number;height:number};
/** A camera-only worker result can wrap the same immutable source buffers in
 * fresh objects. Keep the already drawn field and its common triangulation in
 * that case; rebuilding another old/new pair can otherwise replace a finer
 * still-valid common mesh with a coarser equivalent on the next frame. */
export function sameAtlasTerrainFieldSources(a:readonly AtlasTerrainTileModel[],b:readonly AtlasTerrainTileModel[]):boolean{
  if(a.length!==b.length)return false;
  return a.every((left,index)=>{
    const right=b[index];if(!right)return false;
    const x=left.grid.view.box,y=right.grid.view.box;
    return left.object.id===right.object.id&&x.x===y.x&&x.y===y.y&&x.width===y.width&&x.height===y.height&&
      left.grid.heights===right.grid.heights&&left.texture.data===right.texture.data&&left.masks.data===right.masks.data&&
      left.cover.data===right.cover.data&&left.relief.data===right.relief.data;
  });
}
interface FieldLookupNode {bounds:Box;source:number;parent:number;escape:number}
export interface AtlasTerrainFieldLookup {readonly x:readonly number[];readonly y:readonly number[];readonly owners:Uint8Array;readonly nodes:readonly FieldLookupNode[];readonly ranks:readonly number[]}
const fieldLookups=new WeakMap<readonly AtlasTerrainTileModel[],AtlasTerrainFieldLookup>();
export function atlasTerrainFieldLookupRetained(models:readonly AtlasTerrainTileModel[]):readonly Uint8Array[]{const lookup=fieldLookups.get(models);return lookup?[lookup.owners]:[];}
/** Exact finite source cuts, including children smaller than one coarse edge
 * interval. The balanced bounds tree is only for the material filter footprint;
 * normal point queries use the direct cell table and two six-step searches. */
export function prepareAtlasTerrainFieldLookup(models:readonly AtlasTerrainTileModel[]):AtlasTerrainFieldLookup{
  const cached=fieldLookups.get(models);if(cached)return cached;
  if(models.length>32)throw Error('Terrainfeld-Randbesitzerbudget überschritten.');
  const x=[...new Set(models.flatMap(m=>{const b=m.grid.view.box;return[b.x,b.x+b.width];}))].sort((a,b)=>a-b),
    y=[...new Set(models.flatMap(m=>{const b=m.grid.view.box;return[b.y,b.y+b.height];}))].sort((a,b)=>a-b);
  const owners=new Uint8Array(64*64),nodes:FieldLookupNode[]=[],ranked=models.map((_,i)=>i).sort((a,b)=>atlasTerrainFieldSourceOrder(models[a]!,models[b]!)),ranks=models.map((_,i)=>ranked.indexOf(i));
  for(let yy=0;yy<y.length-1;yy++)for(let xx=0;xx<x.length-1;xx++)owners[yy*64+xx]=atlasTerrainFieldPointOwner(models,{x:(x[xx]!+x[xx+1]!)/2,y:(y[yy]!+y[yy+1]!)/2})+1;
  const parents=models.map((model,index)=>{const b=model.grid.view.box;let parent=-1;for(let i=0;i<models.length;i++){const c=models[i]!.grid.view.box;if(i!==index&&c.width>b.width&&b.x>=c.x&&b.x+b.width<=c.x+c.width&&b.y>=c.y&&b.y+b.height<=c.y+c.height&&(parent<0||c.width<models[parent]!.grid.view.box.width))parent=i;}return parent;});
  const add=(indices:number[])=>{const boxes=indices.map(i=>models[i]!.grid.view.box),left=Math.min(...boxes.map(b=>b.x)),top=Math.min(...boxes.map(b=>b.y)),right=Math.max(...boxes.map(b=>b.x+b.width)),bottom=Math.max(...boxes.map(b=>b.y+b.height)),at=nodes.length;
    nodes.push({bounds:{x:left,y:top,width:right-left,height:bottom-top},source:indices.length===1?indices[0]!: -1,parent:indices.length===1?parents[indices[0]!]!: -1,escape:0});
    if(indices.length>1){const axis=right-left>=bottom-top?'x':'y';indices.sort((a,b)=>{const aa=models[a]!.grid.view.box,bb=models[b]!.grid.view.box;return aa[axis]+aa.width/2-bb[axis]-bb.width/2||ranks[a]!-ranks[b]!;});const half=Math.floor(indices.length/2);add(indices.slice(0,half));add(indices.slice(half));}nodes[at]!.escape=nodes.length;
  };if(models.length)add(models.map((_,i)=>i));
  const result={x,y,owners,nodes,ranks};fieldLookups.set(models,result);return result;
}
/** R8UI source+1 in each of four physical 32-slot banks. Empty cells are zero. */
export function prepareAtlasTerrainFieldEdgeOwners(oldModels:readonly AtlasTerrainTileModel[],newModels:readonly AtlasTerrainTileModel[],draftModels:readonly AtlasTerrainTileModel[]=[],bases={old:0,new:32,draft:64}):Uint8Array{
  validateAtlasTerrainFieldSlotBases(oldModels,newModels,draftModels,bases);
  const output=new Uint8Array(64*256);
  for(const {base,models} of [{base:bases.old,models:oldModels},{base:bases.new,models:newModels},{base:bases.draft,models:draftModels}]){
    if(!models.length)continue;const lookup=prepareAtlasTerrainFieldLookup(models);for(let i=0;i<lookup.owners.length;i++)if(lookup.owners[i])output[base/32*4096+i]=base+lookup.owners[i]!;
  }return output;
}
/** CPU interpretation of the exact material footprint rule, also used to
 * inspect the prepared tree independently of any GL runtime. */
export function atlasTerrainFieldMaterialWeights(models:readonly AtlasTerrainTileModel[],p:Point,radius:number):number[]{
  if(!(radius>0)||!Number.isFinite(radius))throw Error('Terrainfeld-Materialband ungültig.');
  const {nodes}=prepareAtlasTerrainFieldLookup(models),weights=new Array<number>(models.length).fill(0);
  for(let index=0;index<nodes.length;){const node=nodes[index]!,b=node.bounds,dx=Math.max(0,Math.min(p.x+radius,b.x+b.width)-Math.max(p.x-radius,b.x))/(2*radius),dy=Math.max(0,Math.min(p.y+radius,b.y+b.height)-Math.max(p.y-radius,b.y))/(2*radius);
    if(!dx||!dy){index=node.escape;continue;}if(node.source>=0){const area=dx*dy;weights[node.source]!+=area;if(node.parent>=0)weights[node.parent]!-=area;}index++;
  }const total=weights.reduce((sum,w)=>sum+Math.max(0,w),0);return weights.map(w=>total?Math.max(0,w)/total:0);
}
type FieldGeometryRegion={bounds:Box;oldSlot:number;newSlot:number;layout:ReturnType<typeof terrainGridLayout>};
type FieldGeometryPlan=FieldGeometryRegion & {origin:Point;vertices:number;indices:number};
export interface AtlasTerrainFieldDraw {
  readonly origin:Point;readonly oldSlot:number;readonly newSlot:number;
  readonly bounds:Box;
  readonly firstIndex:number;readonly indexCount:number;
}
export interface AtlasTerrainFieldAllocation {
  readonly vertexBytes:number;readonly indexBytes:number;readonly geometryBytes:number;readonly drawMetadataBytes:number;
}
export interface AtlasTerrainFieldAllocationBudget {
  readonly retainedDrawMetadataBytes?:number;
  /** Called once with complete counts, before either geometry backing store. */
  readonly reserve?:(bytes:number,allocation:AtlasTerrainFieldAllocation)=>void;
}
export interface AtlasTerrainFieldGeometry {
  /** local X/Y and exact float-encoded old/new slot IDs; 16 bytes per vertex. */
  readonly vertices:Float32Array;
  readonly indices:Uint32Array;
  readonly draws:readonly AtlasTerrainFieldDraw[];
  readonly gpuGeometryBytes:number;
  readonly gpuDrawMetadataBytes:number;
  readonly oldSourceCount:number;readonly newSourceCount:number;readonly draftSourceCount:number;
}
/** The B/C basis is immutable. Its optional absolute draft buffer is a
 * separate owner; an absent draft aliases the basis' new-value attributes. */
export interface AtlasTerrainPreparedLayerGeometry extends AtlasTerrainFieldGeometry {
  readonly preparedBasis:Float32Array;readonly preparedDraft:Float32Array|null;
}
export function atlasTerrainFieldDrawOffsets(draw:Pick<AtlasTerrainFieldDraw,'firstIndex'>){return{firstVertex:draw.firstIndex*Uint32Array.BYTES_PER_ELEMENT,firstIndex:draw.firstIndex};}

/** Snapshot-owned nearest texture rows: source bounds/axis bands, exact cuts,
 * far endpoints/rank, then the finite material tree. Both endpoints subtract
 * the local draw origin in Double before packing; never add a huge Float32
 * origin and width to reconstruct a nearby one-metre boundary. */
export const ATLAS_TERRAIN_FIELD_SLOT_META_FLOATS=ATLAS_TERRAIN_FIELD_SLOTS*ATLAS_TERRAIN_FIELD_META_ROWS*4;
function validateAtlasTerrainFieldSlotBases(oldModels:readonly AtlasTerrainTileModel[],newModels:readonly AtlasTerrainTileModel[],draftModels:readonly AtlasTerrainTileModel[],bases:{old:number;new:number;draft:number}){
  const occupied=new Set<number>();
  for(const [base,models] of [[bases.old,oldModels],[bases.new,newModels],[bases.draft,draftModels]] as const){
    if(!Number.isSafeInteger(base)||base%32!==0||base<0||base+models.length>ATLAS_TERRAIN_FIELD_SLOTS)throw Error('Terrainfeld-Slotbasis außerhalb des Arrays.');
    for(let i=0;i<models.length;i++){const slot=base+i;if(occupied.has(slot))throw Error('Terrainfeld-Slotbasen überlappen.');occupied.add(slot);}
  }
}
export function packAtlasTerrainFieldSlotMetadata(
  origin:Point,oldModels:readonly AtlasTerrainTileModel[],newModels:readonly AtlasTerrainTileModel[],
  draftModels:readonly AtlasTerrainTileModel[]=[],bases={old:0,new:32,draft:64}
):Float32Array{
  if(oldModels.length>32||newModels.length>32||draftModels.length>32||
    !Number.isFinite(origin.x)||!Number.isFinite(origin.y))throw Error('Terrainfeld-Slotmetadaten ungültig.');
  validateAtlasTerrainFieldSlotBases(oldModels,newModels,draftModels,bases);
  const values=new Float32Array(ATLAS_TERRAIN_FIELD_SLOT_META_FLOATS);
  // Texture row order is also the upload order; there is no transpose copy.
  const boxBase=0,xBase=ATLAS_TERRAIN_FIELD_SLOTS*4,yBase=ATLAS_TERRAIN_FIELD_SLOTS*10*4;
  const fill=(slot:number,model:AtlasTerrainTileModel)=>{
    const view=model.grid.view,layout=terrainGridLayout(view),b=view.box;
    if(layout.x.bands.length>9||layout.y.bands.length>9||view.columns!==65||view.rows!==65)
      throw Error('Terrainfeld-Gitterlayout außerhalb des Shadervertrags.');
    values.set([b.x-origin.x,b.y-origin.y,b.width,b.height],boxBase+slot*4);
    for(const [base,axis] of [[xBase,layout.x],[yBase,layout.y]] as const){
      for(let i=0;i<9;i++){
        const band=axis.bands[i];
        values.set(band?[band.origin-(base===xBase?origin.x:origin.y),band.step,band.start,band.cells]:[0,1,0,-1],base+(i*ATLAS_TERRAIN_FIELD_SLOTS+slot)*4);
      }
    }
  };
  oldModels.forEach((model,index)=>fill(bases.old+index,model));
  newModels.forEach((model,index)=>fill(bases.new+index,model));
  draftModels.forEach((model,index)=>fill(bases.draft+index,model));
  const put=(slot:number,row:number,v:number[])=>values.set(v,(row*ATLAS_TERRAIN_FIELD_SLOTS+slot)*4);
  for(const {base,models} of [{base:bases.old,models:oldModels},{base:bases.new,models:newModels},{base:bases.draft,models:draftModels}]){
    if(!models.length)continue;const lookup=prepareAtlasTerrainFieldLookup(models);
    for(let i=0;i<32;i++)put(base+i,19,[lookup.x[i*2]===undefined?0:lookup.x[i*2]!-origin.x,lookup.x[i*2+1]===undefined?0:lookup.x[i*2+1]!-origin.x,lookup.y[i*2]===undefined?0:lookup.y[i*2]!-origin.y,lookup.y[i*2+1]===undefined?0:lookup.y[i*2+1]!-origin.y]);
    models.forEach((model,i)=>{const b=model.grid.view.box;put(base+i,20,[b.x+b.width-origin.x,b.y+b.height-origin.y,lookup.ranks[i]!,lookup.nodes.length]);});
    lookup.nodes.forEach((node,i)=>{const b=node.bounds;put(base+i%32,21+Math.floor(i/32),[b.x-origin.x,b.y-origin.y,b.x+b.width-origin.x,b.y+b.height-origin.y]);put(base+i%32,23+Math.floor(i/32),[node.source<0?-1:base+node.source,node.parent<0?-1:base+node.parent,node.escape,i===0?lookup.x.length+128*lookup.y.length:0]);});
  }
  return values;
}

function box(model:AtlasTerrainTileModel):Box{return model.grid.view.box;}
function localSupport(model:AtlasTerrainTileModel,p:Point){
  const layout=terrainGridLayout(model.grid.view),step=(axis:typeof layout.x,value:number)=>{
    let selected=axis.bands.at(-1)!;
    for(const band of axis.bands)if(value<band.origin+band.step*band.cells){selected=band;break;}
    return selected.step;
  };
  return{x:step(layout.x,p.x),y:step(layout.y,p.y)};
}
function inside(p:Point,axis:'x'|'y',value:number,positive:boolean){return positive?p[axis]>=value:p[axis]<=value;}
function area(a:Point,b:Point,c:Point){return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}
function hasArea(poly:readonly Point[]){return poly.length>=3&&poly.slice(1,-1).some((p,i)=>area(poly[0]!,p,poly[i+2]!)!==0);}
function half(poly:readonly Point[],axis:'x'|'y',value:number,positive:boolean):Point[]{
  const out:Point[]=[];
  for(let i=0;i<poly.length;i++){
    const p=poly[i]!,q=poly[(i+1)%poly.length]!,a=inside(p,axis,value,positive),b=inside(q,axis,value,positive);
    if(a)out.push(p);
    if(a!==b){const t=(value-p[axis])/(q[axis]-p[axis]),v={x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t};v[axis]=value;out.push(v);}
  }
  return out;
}
function within(poly:readonly Point[],b:Box):Point[]{
  let result=[...poly];
  for(const [axis,value,positive] of [['x',b.x,true],['x',b.x+b.width,false],['y',b.y,true],['y',b.y+b.height,false]] as const){result=half(result,axis,value,positive);if(!hasArea(result))return[];}
  return result;
}
/** Visit the actual clipped source triangles without retaining a second JS
 * copy of the vertex/index buffers. The count and fill passes use this same
 * traversal; source-affine containment is checked independently in tests. */
function* visitFieldTriangles(layout:ReturnType<typeof terrainGridLayout>,bounds:Box,visit:(a:Point,b:Point,c:Point)=>void){
  for(let y=0;y<layout.y.values.length-1;y++){
    const y0=layout.y.values[y]!,y1=layout.y.values[y+1]!;if(y1<=bounds.y||y0>=bounds.y+bounds.height)continue;
    for(let x=0;x<layout.x.values.length-1;x++){
      const x0=layout.x.values[x]!,x1=layout.x.values[x+1]!;if(x1<=bounds.x||x0>=bounds.x+bounds.width)continue;
      for(const triangle of [[{x:x0,y:y0},{x:x1,y:y0},{x:x0,y:y1}],[{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}]] as const){
        const clipped=within(triangle,bounds);for(let j=1;j<clipped.length-1;j++)if(area(clipped[0]!,clipped[j]!,clipped[j+1]!)!==0)visit(clipped[0]!,clipped[j]!,clipped[j+1]!);
      }
    }
    yield;
  }
}
/** Counts final Float32 vertices, indices and descriptors before upload-buffer
 * allocation. Uniform dyadic sources share diagonals; only imprecise local
 * rectangles are subdivided on dyadic lines within the source triangles.
 * Draft deltas reuse this topology and only occupy source-array slots. */
export function* prepareAtlasTerrainFieldGeometrySteps(
  oldModels:readonly AtlasTerrainTileModel[],newModels:readonly AtlasTerrainTileModel[],
  draftSourceCount=0,retainedFieldGpuGeometryBytes=0,allocation:AtlasTerrainFieldAllocationBudget={}
):Generator<void,AtlasTerrainFieldGeometry>{
  const budget=ATLAS_TERRAIN_FIELD_GPU,retainedMetadata=allocation.retainedDrawMetadataBytes??0;
  if(!Number.isSafeInteger(retainedMetadata)||retainedMetadata<0||oldModels.length>budget.maxSources||newModels.length>budget.maxSources||draftSourceCount<0||draftSourceCount>budget.maxDraftSources||
    !Number.isSafeInteger(draftSourceCount)||!Number.isSafeInteger(retainedFieldGpuGeometryBytes)||retainedFieldGpuGeometryBytes<0)
    throw Error('Terrainfeld-Quell- oder Lebendbufferbudget überschritten.');
  const plans:FieldGeometryPlan[]=[];let totalVertices=0,totalIndices=0;
  const charge=()=>{
    if(totalVertices*budget.vertexStride+totalIndices*budget.indexStride+retainedFieldGpuGeometryBytes>budget.geometry)
      throw Error('Terrainfeld-Geometriebudget vor GPU-Allokation überschritten.');
    if(plans.length*budget.drawMetadataStride+retainedMetadata>budget.drawMetadata)
      throw Error('Terrainfeld-Drawmetadatenbudget vor GPU-Allokation überschritten.');
  };
  charge();
  function* plan(bounds:Box,layout:ReturnType<typeof terrainGridLayout>,oldSlot:number,newSlot:number):Generator<void>{
    // A grid-aligned double origin preserves ordinary dyadic nodes even when
    // a region starts at a tiny clipped offset inside a world-sized cell.
    const originAxis=(axis:typeof layout.x,start:number,length:number)=>{
      const end=start+length,near=Math.abs(start)<=Math.abs(end)?start:end;
      return axis.values.reduce((best,value)=>Math.abs(value-near)<Math.abs(best-near)?value:best,axis.values[0]!);
    };
    const origin={x:originAxis(layout.x,bounds.x,bounds.width),y:originAxis(layout.y,bounds.y,bounds.height)},seen=new Set<string>(),coordinates={x:new Set<number>(),y:new Set<number>()};
    let indices=0;
    yield* visitFieldTriangles(layout,bounds,(a,b,c)=>{for(const p of [a,b,c]){
      const x=p.x-origin.x,y=p.y-origin.y;
      coordinates.x.add(p.x);coordinates.y.add(p.y);
      seen.add(`${x}/${y}`);indices++;
    }});
    const precise=(axis:'x'|'y')=>{
      const length=axis==='x'?bounds.width:bounds.height,candidates=[origin[axis],bounds[axis],bounds[axis]+length,...layout[axis].values];
      for(const candidate of candidates)if([...coordinates[axis]].every(value=>{const local=value-candidate;return Math.fround(local)===local&&candidate+Math.fround(local)===value;})){origin[axis]=candidate;return true;}
      return false;
    };
    const preciseX=precise('x'),preciseY=precise('y');
    if(!preciseX||!preciseY){
      // Never accept a rounded triangle or silently lower detail. Atlas LODs
      // -8..32 have dyadic cuts but can still need a split inside one very
      // large cell. Check actual packed coordinates instead of assuming a
      // universal Float32 precision bound from a few favourable examples.
      const axes=(['x','y'] as const).filter(axis=>axis==='x'?!preciseX:!preciseY).sort((a,b)=>(b==='x'?bounds.width:bounds.height)-(a==='x'?bounds.width:bounds.height));
      for(const axis of axes){
        const length=axis==='x'?'width':'height',start=bounds[axis],end=start+bounds[length],middle=start+bounds[length]/2;
        const cuts=[...layout[axis].values].filter(value=>value>start&&value<end);
        const unit=2**Math.floor(Math.log2(end-start)),dyadic=(Math.floor(start/unit)+1)*unit;
        const cut=cuts.length?cuts.reduce((best,value)=>Math.abs(value-middle)<Math.abs(best-middle)?value:best,cuts[0]!):dyadic<end?dyadic:(Math.floor(start/(unit/2))+1)*(unit/2);
        if(!(cut>start&&cut<end))continue;
        yield* plan({...bounds,[length]:cut-start},layout,oldSlot,newSlot);
        yield* plan({...bounds,[axis]:cut,[length]:end-cut},layout,oldSlot,newSlot);return;
      }
      throw Error('Terrainfeld-Lokalpräzision außerhalb der darstellbaren Quellpartition.');
    }
    if(!indices)return;
    plans.push({origin,bounds,layout,oldSlot,newSlot,vertices:seen.size,indices});totalVertices+=seen.size;totalIndices+=indices;charge();
  };
  // The owner partition is unchanged: traverse the finer uniform grid in each
  // old/new rectangle. Its triangles refine both dyadic source triangulations.
  const all=[...oldModels,...newModels],xs=[...new Set(all.flatMap(model=>{const b=box(model);return[b.x,b.x+b.width];}))].sort((a,b)=>a-b),ys=[...new Set(all.flatMap(model=>{const b=box(model);return[b.y,b.y+b.height];}))].sort((a,b)=>a-b);
  const choose=(models:readonly AtlasTerrainTileModel[],p:Point)=>models.map((model,index)=>({model,index,b:box(model)})).filter(({b})=>p.x>=b.x&&p.x<=b.x+b.width&&p.y>=b.y&&p.y<=b.y+b.height).sort((a,b)=>a.b.width-b.b.width)[0];
  const regions:FieldGeometryRegion[]=[],rowEnds=new Map<string,FieldGeometryRegion>();
  const append=(region:FieldGeometryRegion)=>{
    const b=region.bounds,key=`${b.y}/${b.height}/${region.oldSlot}/${region.newSlot}`,previous=rowEnds.get(key);
    if(previous&&previous.layout===region.layout&&previous.bounds.x+previous.bounds.width===b.x)previous.bounds.width+=b.width;
    else{regions.push(region);rowEnds.set(key,region);}
  };
  for(let xi=0;xi<xs.length-1;xi++){
    let column:FieldGeometryRegion|undefined;
    for(let yi=0;yi<ys.length-1;yi++){
      yield;
      const bounds={x:xs[xi]!,y:ys[yi]!,width:xs[xi+1]!-xs[xi]!,height:ys[yi+1]!-ys[yi]!};if(bounds.width<=0||bounds.height<=0)continue;
      const p={x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2},old=choose(oldModels,p),next=choose(newModels,p);if(!old&&!next)continue;
      const oldSupport=old?localSupport(old.model,p):{x:Infinity,y:Infinity},nextSupport=next?localSupport(next.model,p):{x:Infinity,y:Infinity};
      const source=Math.min(oldSupport.x,oldSupport.y)<Math.min(nextSupport.x,nextSupport.y)?old!.model:next?.model??old!.model,
        region={bounds,layout:terrainGridLayout(source.grid.view),oldSlot:old?.index??-1,newSlot:next?.index??-1};
      // Merge only adjacent rectangles with the complete same old/new owner
      // pair AND the same finer source layout. No hole, LOD or source boundary
      // can disappear; irrelevant cross-cuts from other children can disappear.
      if(column&&column.oldSlot===region.oldSlot&&column.newSlot===region.newSlot&&column.layout===region.layout&&column.bounds.y+column.bounds.height===bounds.y)column.bounds.height+=bounds.height;
      else{if(column)append(column);column=region;}
    }
    if(column)append(column);
  }
  for(const region of regions)yield* plan(region.bounds,region.layout,region.oldSlot,region.newSlot);
  const gpuGeometryBytes=totalVertices*budget.vertexStride+totalIndices*budget.indexStride,gpuDrawMetadataBytes=plans.length*budget.drawMetadataStride;
  // The worker budget charges both these originals and their real transport
  // copies. No shareable-but-unshared index layout is deducted from this count.
  allocation.reserve?.(gpuGeometryBytes+gpuDrawMetadataBytes,{vertexBytes:totalVertices*budget.vertexStride,indexBytes:totalIndices*budget.indexStride,geometryBytes:gpuGeometryBytes,drawMetadataBytes:gpuDrawMetadataBytes});
  const vertices=new Float32Array(totalVertices*4),indices=new Uint32Array(totalIndices),descriptors:AtlasTerrainFieldDraw[]=[];
  let v=0,i=0;
  for(const draw of plans){
    const seen=new Map<string,number>(),firstIndex=i,firstVertex=v;
    yield* visitFieldTriangles(draw.layout,draw.bounds,(a,b,c)=>{for(const p of [a,b,c]){
      const x=p.x-draw.origin.x,y=p.y-draw.origin.y,key=`${x}/${y}`;let index=seen.get(key);
      if(index===undefined){index=v++;seen.set(key,index);vertices.set([x,y,draw.oldSlot,draw.newSlot],index*4);}indices[i++]=index;
    }});
    if(v-firstVertex!==draw.vertices||i-firstIndex!==draw.indices)throw Error('Terrainfeld-Geometriezählung weicht beim Füllen ab.');
    descriptors.push({origin:draw.origin,bounds:draw.bounds,oldSlot:draw.oldSlot,newSlot:draw.newSlot,firstIndex,indexCount:i-firstIndex});
  }
  return {vertices,indices,draws:descriptors,gpuGeometryBytes,gpuDrawMetadataBytes,
    oldSourceCount:oldModels.length,newSourceCount:newModels.length,draftSourceCount};
}

export function prepareAtlasTerrainFieldGeometry(
  oldModels:readonly AtlasTerrainTileModel[],newModels:readonly AtlasTerrainTileModel[],
  draftSourceCount=0,retainedFieldGpuGeometryBytes=0,allocation:AtlasTerrainFieldAllocationBudget={}
):AtlasTerrainFieldGeometry{
  const steps=prepareAtlasTerrainFieldGeometrySteps(oldModels,newModels,draftSourceCount,retainedFieldGpuGeometryBytes,allocation);
  let step=steps.next();while(!step.done)step=steps.next();return step.value;
}

const fieldUniformBlock=`layout(std140) uniform atlasTerrainFieldUniforms {
  float alpha;
  float draft;
  float exaggeration;
  float frameHeight;
  float snowline;
  float mountains;
  float lightRadians;
  float lightStrength;
  float seaLevel;
  float heightMode;
  float newBase;
  float draftBase;
  vec2 drawOffset;
  float materialBand;
  vec4 drawBounds;
  vec2 frameHeightPair;
  float oldSlot;
  float newSlot;
} atlasTerrainField;`;
const fieldUniforms={name:'atlasTerrainField',vs:fieldUniformBlock,fs:fieldUniformBlock,uniformTypes:{
  alpha:'f32',draft:'f32',exaggeration:'f32',frameHeight:'f32',snowline:'f32',mountains:'f32',lightRadians:'f32',lightStrength:'f32',seaLevel:'f32',heightMode:'f32',newBase:'f32',draftBase:'f32',drawOffset:'vec2<f32>',materialBand:'f32',drawBounds:'vec4<f32>',frameHeightPair:'vec2<f32>',oldSlot:'f32',newSlot:'f32'
}} as const;

/** Fully linked production field shader. Height interpolation, morph, draft
 * delta and physical gradients share the same source slots as the CPU ray. */

export const ATLAS_TERRAIN_FIELD_VS=`#version 300 es
#define SHADER_NAME atlas-terrain-field-vs
precision highp float;
precision highp sampler2DArray;
precision highp usampler2D;
in vec2 terrainLocal;
in vec2 terrainSlots;
in vec3 instancePositions;
in vec3 instancePositions64Low;
uniform sampler2DArray atlasFieldHeight;
uniform sampler2D atlasFieldMeta;
uniform highp usampler2D atlasFieldEdgeOwners;
out vec3 fieldNormal;
out float fieldHeight;
out vec2 fieldWorld;
flat out ivec3 fieldSlots;

vec4 fieldMeta(int slot,int row){return texelFetch(atlasFieldMeta,ivec2(slot,row),0);}
float fieldAxis(int slot,float value,int firstRow){
  vec4 first=fieldMeta(slot,firstRow);
  if(first.w==64.0){float far=firstRow==1?fieldMeta(slot,20).x:fieldMeta(slot,20).y;return clamp(value-first.x<=far-value?(value-first.x)/first.y:64.0-(far-value)/first.y,0.0,64.0);}
  vec4 selected=fieldMeta(slot,firstRow+8);
  for(int row=0;row<9;row++){vec4 band=fieldMeta(slot,firstRow+row);if(band.w>=0.0){selected=band;if(value<band.x+band.y*band.w)break;}}
  return clamp(selected.z+(value-selected.x)/selected.y,0.0,64.0);
}
float fieldAxisStep(int slot,float value,int firstRow){
  vec4 first=fieldMeta(slot,firstRow);if(first.w==64.0)return first.y;
  vec4 selected=fieldMeta(slot,firstRow+8);
  for(int row=0;row<9;row++){vec4 band=fieldMeta(slot,firstRow+row);if(band.w>=0.0){selected=band;if(value<band.x+band.y*band.w)break;}}
  return selected.y;
}
int fieldBank(int slot){return (slot/32)*32;}
float fieldCut(int bank,int axis,int at){vec4 cuts=fieldMeta(bank+at/2,19);return axis==0?(at%2==0?cuts.x:cuts.y):(at%2==0?cuts.z:cuts.w);}
int fieldCell(int bank,int axis,float value,bool before){
  int encoded=int(round(fieldMeta(bank,23).w)),count=axis==0?encoded%128:encoded/128;int lo=0,hi=count;
  for(int i=0;i<7;i++){if(lo>=hi)break;int mid=(lo+hi)/2;float cut=fieldCut(bank,axis,mid);if(before?cut<value:cut<=value)lo=mid+1;else hi=mid;}
  int cell=lo-1;return cell<0||cell>=count-1?-1:cell;
}
int fieldCellOwner(int bank,int x,int y){return x<0||y<0?-1:int(texelFetch(atlasFieldEdgeOwners,ivec2(x,y+bank/32*64),0).r)-1;}
int fieldSelect(int a,int b,bool coarse){
  if(a<0)return b;if(b<0)return a;float sa=fieldMeta(a,0).z,sb=fieldMeta(b,0).z;
  return sa==sb?(fieldMeta(a,20).z<=fieldMeta(b,20).z?a:b):(coarse?(sa>sb?a:b):(sa<sb?a:b));
}
int fieldIncident(int slot,vec2 p,bool coarse){
  int bank=fieldBank(slot),xl=fieldCell(bank,0,p.x,true),xr=fieldCell(bank,0,p.x,false),yt=fieldCell(bank,1,p.y,true),yb=fieldCell(bank,1,p.y,false);
  return fieldSelect(fieldSelect(fieldCellOwner(bank,xl,yt),fieldCellOwner(bank,xr,yt),coarse),fieldSelect(fieldCellOwner(bank,xl,yb),fieldCellOwner(bank,xr,yb),coarse),coarse);
}
vec2 fieldSupport(int slot,vec2 p){
  if(slot<0)return vec2(0.0);int owner=fieldIncident(slot,p,true);vec2 own=vec2(fieldAxisStep(slot,p.x,1),fieldAxisStep(slot,p.y,10));
  return owner<0?own:max(own,vec2(fieldAxisStep(owner,p.x,1),fieldAxisStep(owner,p.y,10)));
}
int fieldResolve(int slot,vec2 p){return slot<0?-1:fieldIncident(slot,p,false);}
bool fieldOnBoundary(int slot,vec2 p){
  if(slot<0)return false;vec4 b=fieldMeta(slot,0),far=fieldMeta(slot,20);float tolerance=max(min(fieldAxisStep(slot,p.x,1),fieldAxisStep(slot,p.y,10))*1e-6,1e-9);
  return min(min(abs(p.x-b.x),abs(p.x-far.x)),min(abs(p.y-b.y),abs(p.y-far.y)))<=tolerance;
}
int fieldBoundaryOwner(int slot,vec2 p){
  if(!fieldOnBoundary(slot,p))return slot;int owner=fieldIncident(slot,p,true);return owner<0?slot:fieldSelect(slot,owner,true);
}
float fieldRawHeight(int slot,vec2 p){
  float gx=fieldAxis(slot,p.x,1),gy=fieldAxis(slot,p.y,10);ivec2 cell=ivec2(min(63.0,floor(gx)),min(63.0,floor(gy)));vec2 uv=vec2(gx,gy)-vec2(cell);
  float h00=texelFetch(atlasFieldHeight,ivec3(cell,slot),0).r,h10=texelFetch(atlasFieldHeight,ivec3(cell+ivec2(1,0),slot),0).r;
  float h01=texelFetch(atlasFieldHeight,ivec3(cell+ivec2(0,1),slot),0).r,h11=texelFetch(atlasFieldHeight,ivec3(cell+ivec2(1,1),slot),0).r;
  return uv.x+uv.y<=1.0?h00+uv.x*(h10-h00)+uv.y*(h01-h00):h11+(1.0-uv.x)*(h01-h11)+(1.0-uv.y)*(h10-h11);
}
vec2 fieldNodePosition(int slot,vec2 node){vec4 x=fieldMeta(slot,1),y=fieldMeta(slot,10),far=fieldMeta(slot,20);return vec2(node.x<=32.0?x.x+node.x*x.y:far.x-(64.0-node.x)*x.y,node.y<=32.0?y.x+node.y*y.y:far.y-(64.0-node.y)*y.y);}
float fieldNodeHeight(int slot,vec2 node){if(all(greaterThan(node,vec2(0.0)))&&all(lessThan(node,vec2(64.0))))return texelFetch(atlasFieldHeight,ivec3(ivec2(node),slot),0).r;vec2 p=fieldNodePosition(slot,node);int owner=fieldBoundaryOwner(slot,p);return owner==slot?texelFetch(atlasFieldHeight,ivec3(ivec2(node),slot),0).r:fieldRawHeight(owner,p);}
float fieldSampleDirect(int slot,vec2 p){
  vec2 g=vec2(fieldAxis(slot,p.x,1),fieldAxis(slot,p.y,10)),cell=min(vec2(63.0),floor(g)),uv=g-cell;
  if(uv.x==0.0&&uv.y==0.0)return fieldNodeHeight(slot,cell);
  if(uv.x==1.0&&uv.y==1.0)return fieldNodeHeight(slot,cell+vec2(1.0));
  float h10=fieldNodeHeight(slot,cell+vec2(1,0)),h01=fieldNodeHeight(slot,cell+vec2(0,1));
  return uv.x+uv.y<=1.0?fieldNodeHeight(slot,cell)*(1.0-uv.x-uv.y)+h10*uv.x+h01*uv.y:fieldNodeHeight(slot,cell+vec2(1.0))*(uv.x+uv.y-1.0)+h10*(1.0-uv.y)+h01*(1.0-uv.x);
}
float fieldSample(int slot,vec2 p,float fallback){int owner=fieldResolve(slot,p);return owner<0?fallback:fieldSampleDirect(owner,p);}
vec2 fieldSampleAvailable(int slot,vec2 p){int owner=fieldResolve(slot,p);return owner<0?vec2(0.0):vec2(fieldSampleDirect(owner,p),1.0);}
vec2 fieldGradient(int slot,vec2 p,vec2 support){
  float center=fieldSampleDirect(slot,p);vec2 left=fieldSampleAvailable(slot,p-vec2(support.x,0.0)),right=fieldSampleAvailable(slot,p+vec2(support.x,0.0));
  vec2 top=fieldSampleAvailable(slot,p-vec2(0.0,support.y)),bottom=fieldSampleAvailable(slot,p+vec2(0.0,support.y));
  float xCount=left.y+right.y,yCount=top.y+bottom.y;
  float sx=xCount>0.0?((right.y>0.0?right.x:center)-(left.y>0.0?left.x:center))/(support.x*xCount):0.0;
  float sy=yCount>0.0?((bottom.y>0.0?bottom.x:center)-(top.y>0.0?top.x:center))/(support.y*yCount):0.0;
  return vec2(sx,sy);
}
float fieldMixed(vec2 p,int oldSlot,int nextSlot,float alpha){
  if(nextSlot<0)return fieldSampleDirect(oldSlot,p);
  float n=fieldSampleDirect(nextSlot,p);return oldSlot<0||alpha>=1.0?n:mix(fieldSample(oldSlot,p,n),n,alpha);
}
vec3 fieldNodeNormal(vec2 p,int oldSlot,int nextSlot,int draftSlot){
  oldSlot=fieldResolve(oldSlot,p);nextSlot=fieldResolve(nextSlot,p);draftSlot=fieldResolve(draftSlot,p);
  if(oldSlot<0&&nextSlot<0)return vec3(0,0,1);
  vec2 support=nextSlot<0?fieldSupport(oldSlot,p):(oldSlot<0?fieldSupport(nextSlot,p):max(fieldSupport(oldSlot,p),fieldSupport(nextSlot,p)));
  vec2 oldGradient=oldSlot<0?fieldGradient(nextSlot,p,support):fieldGradient(oldSlot,p,support),nextGradient=nextSlot<0?oldGradient:fieldGradient(nextSlot,p,support);
  vec2 gradient=oldSlot<0||nextSlot<0?nextGradient:mix(oldGradient,nextGradient,atlasTerrainField.alpha);
  if(atlasTerrainField.draft>0.5&&nextSlot>=0&&draftSlot>=0)gradient+=fieldGradient(draftSlot,p,support)-nextGradient;
  return normalize(vec3(-gradient,1.0));
}
vec3 fieldPresentationNormal(vec2 p,int oldSlot,int nextSlot,int draftSlot){
  int source=nextSlot<0?oldSlot:(oldSlot<0?nextSlot:(fieldMeta(oldSlot,0).z<fieldMeta(nextSlot,0).z?oldSlot:nextSlot));
  // Fine intermediate edge nodes use the same coarse nodal normal segment as
  // the adjacent coarse triangle. No independent lighting seam at a T join.
  if(fieldOnBoundary(oldSlot,p)||fieldOnBoundary(nextSlot,p)){
    int oldBoundary=oldSlot<0?-1:fieldBoundaryOwner(oldSlot,p),nextBoundary=nextSlot<0?-1:fieldBoundaryOwner(nextSlot,p);source=fieldSelect(oldBoundary,nextBoundary,true);
  }
  vec2 g=vec2(fieldAxis(source,p.x,1),fieldAxis(source,p.y,10)),cell=min(vec2(63.0),floor(g)),uv=g-cell;
  if(uv.x==0.0&&uv.y==0.0)return fieldNodeNormal(p,oldSlot,nextSlot,draftSlot);
  if(uv.x==1.0&&uv.y==1.0)return fieldNodeNormal(p,oldSlot,nextSlot,draftSlot);
  vec2 a=uv.x+uv.y<=1.0?cell:cell+vec2(1.0),b=cell+vec2(1,0),c=cell+vec2(0,1);
  vec3 weights=uv.x+uv.y<=1.0?vec3(1.0-uv.x-uv.y,uv.x,uv.y):vec3(uv.x+uv.y-1.0,1.0-uv.y,1.0-uv.x);
  return fieldNodeNormal(fieldNodePosition(source,a),oldSlot,nextSlot,draftSlot)*weights.x+fieldNodeNormal(fieldNodePosition(source,b),oldSlot,nextSlot,draftSlot)*weights.y+fieldNodeNormal(fieldNodePosition(source,c),oldSlot,nextSlot,draftSlot)*weights.z;
}
void main(void){
  int oldSlot=int(round(terrainSlots.x)),nextSlot=int(round(terrainSlots.y));
  int draftSlot=nextSlot<0?-1:int(round(atlasTerrainField.draftBase))+nextSlot-int(round(atlasTerrainField.newBase));vec2 p=terrainLocal;
  float center=fieldMixed(p,oldSlot,nextSlot,atlasTerrainField.alpha);
  if(atlasTerrainField.draft>0.5&&nextSlot>=0)center+=fieldSampleDirect(draftSlot,p)-fieldSampleDirect(nextSlot,p);
  fieldHeight=center;fieldNormal=fieldPresentationNormal(p,oldSlot,nextSlot,draftSlot);fieldWorld=p;fieldSlots=ivec3(oldSlot,nextSlot,draftSlot);
  vec3 position=vec3(atlasTerrainField.drawOffset+p,(center-atlasTerrainField.frameHeight)*atlasTerrainField.exaggeration);
  geometry.worldPosition=position;geometry.normal=project_normal(vec3(fieldNormal.xy,fieldNormal.z/atlasTerrainField.exaggeration));geometry.pickingColor=picking_getPickingColorFromInstanceID();
  gl_Position=project_position_to_clipspace(position,vec3(0.0),vec3(0.0),geometry.position);DECKGL_FILTER_GL_POSITION(gl_Position,geometry);
}`;

/** Packed B graph with unchanged K4 material/lighting fragment shader. All
 * source heights and raw physical gradients arrive as immutable vertex data. */
export const ATLAS_TERRAIN_PREPARED_VS=`#version 300 es
#define SHADER_NAME atlas-terrain-prepared-vs
precision highp float;
in vec2 terrainLocal;
in vec2 terrainOldHeight;
in vec4 terrainOldGradient;
in vec2 terrainNewHeight;
in vec4 terrainNewGradient;
in vec2 terrainDraftHeight;
in vec4 terrainDraftGradient;
in vec3 instancePositions;
in vec3 instancePositions64Low;
out vec3 fieldNormal;
out float fieldHeight;
out vec2 fieldWorld;
flat out ivec3 fieldSlots;
${TERRAIN_PREPARED_GLSL}
void main(void) {
  float alpha=atlasTerrainField.alpha;
  bool hasDraft=atlasTerrainField.draft>0.5;
  vec2 height=terrainPreparedValue(terrainOldHeight,terrainNewHeight,terrainDraftHeight,alpha,hasDraft);
  vec2 gradientX=terrainPreparedValue(terrainOldGradient.xy,terrainNewGradient.xy,terrainDraftGradient.xy,alpha,hasDraft);
  vec2 gradientY=terrainPreparedValue(terrainOldGradient.zw,terrainNewGradient.zw,terrainDraftGradient.zw,alpha,hasDraft);
  float physicalX=gradientX.x+gradientX.y,physicalY=gradientY.x+gradientY.y;
  float relativeHeight=terrainPreparedRelative(height,atlasTerrainField.frameHeightPair);
  fieldNormal=vec3(-physicalX,-physicalY,1.0);
  fieldHeight=height.x+height.y;
  fieldWorld=terrainLocal;
  int oldSlot=int(round(atlasTerrainField.oldSlot)),newSlot=int(round(atlasTerrainField.newSlot));
  int draftSlot=hasDraft&&newSlot>=0?int(round(atlasTerrainField.draftBase))+newSlot-int(round(atlasTerrainField.newBase)):-1;
  fieldSlots=ivec3(oldSlot,newSlot,draftSlot);
  vec3 position=vec3(atlasTerrainField.drawOffset+terrainLocal,relativeHeight*atlasTerrainField.exaggeration);
  geometry.worldPosition=position;
  geometry.normal=project_normal(vec3(fieldNormal.xy,fieldNormal.z/atlasTerrainField.exaggeration));
  geometry.pickingColor=picking_getPickingColorFromInstanceID();
  gl_Position=project_position_to_clipspace(position,vec3(0.0),vec3(0.0),geometry.position);
  DECKGL_FILTER_GL_POSITION(gl_Position,geometry);
}`;

export const ATLAS_TERRAIN_FIELD_FS=`#version 300 es
#define SHADER_NAME atlas-terrain-field-fs
precision highp float;
precision highp sampler2DArray;
precision highp usampler2D;
uniform sampler2DArray atlasFieldBase;
uniform sampler2DArray atlasFieldMasks;
uniform sampler2DArray atlasFieldCover;
uniform sampler2DArray atlasFieldRelief;
uniform sampler2D atlasFieldMeta;
uniform highp usampler2D atlasFieldEdgeOwners;
in vec3 fieldNormal;
in float fieldHeight;
in vec2 fieldWorld;
flat in ivec3 fieldSlots;
out vec4 fragColor;
vec4 fieldMetaFs(int slot,int row){return texelFetch(atlasFieldMeta,ivec2(slot,row),0);}
vec2 fieldUv(int slot){vec4 b=fieldMetaFs(slot,0);return clamp((fieldWorld-b.xy)/b.zw,0.0,1.0);}
vec4 fieldTexRaw(sampler2DArray value,int slot){return texture(value,vec3(fieldUv(slot),float(slot)));}
void fieldRawMaterial(int slot,out vec4 base,out vec4 masks,out vec4 cover,out vec4 relief){base=fieldTexRaw(atlasFieldBase,slot);masks=fieldTexRaw(atlasFieldMasks,slot);cover=fieldTexRaw(atlasFieldCover,slot);relief=fieldTexRaw(atlasFieldRelief,slot);}
void fieldMaterial(int slot,out vec4 base,out vec4 masks,out vec4 cover,out vec4 relief){
  float radius=atlasTerrainField.materialBand;vec4 draw=atlasTerrainField.drawBounds;
  // The complete footprint stays in this known owner region. Keep every raw
  // authored texel and avoid all neighbour work outside the affected band.
  if(all(greaterThanEqual(fieldWorld-vec2(radius),draw.xy))&&all(lessThanEqual(fieldWorld+vec2(radius),draw.zw))){fieldRawMaterial(slot,base,masks,cover,relief);return;}
  int bank=(slot/32)*32,count=int(round(fieldMetaFs(bank,20).w));float weights[32];for(int i=0;i<32;i++)weights[i]=0.0;
  int node=0;
  // At most 63 balanced tree nodes for 32 sources. Empty subtrees are skipped;
  // this is a local footprint query, never a fragment-wide source bounds scan.
  for(int visit=0;visit<63;visit++){
    if(node>=count)break;vec4 b=fieldMetaFs(bank+node%32,21+node/32),meta=fieldMetaFs(bank+node%32,23+node/32);
    vec2 overlap=max(vec2(0.0),min(fieldWorld+vec2(radius),b.zw)-max(fieldWorld-vec2(radius),b.xy))/(2.0*radius);
    if(overlap.x<=0.0||overlap.y<=0.0){node=int(round(meta.z));continue;}
    int source=int(round(meta.x)),parent=int(round(meta.y));if(source>=0){float area=overlap.x*overlap.y;weights[source-bank]+=area;if(parent>=0)weights[parent-bank]-=area;}node++;
  }
  base=vec4(0.0);masks=vec4(0.0);cover=vec4(0.0);relief=vec4(0.0);float total=0.0;
  for(int i=0;i<32;i++){float weight=max(0.0,weights[i]);if(weight<=0.0)continue;vec4 b,m,c,r;fieldRawMaterial(bank+i,b,m,c,r);base+=b*weight;masks+=m*weight;cover+=c*weight;relief+=r*weight;total+=weight;}
  if(total>0.0){base/=total;masks/=total;cover/=total;relief/=total;}else fieldRawMaterial(slot,base,masks,cover,relief);
}
void main(void){
  int oldSlot=fieldSlots.x,nextSlot=fieldSlots.y,draftSlot=fieldSlots.z;float a=atlasTerrainField.alpha;
  vec4 baseNext,masksNext,coverNext,reliefNext;fieldMaterial(nextSlot<0?oldSlot:nextSlot,baseNext,masksNext,coverNext,reliefNext);
  vec4 base=baseNext,masks=masksNext,cover=coverNext,relief=reliefNext;
  if(oldSlot>=0&&nextSlot>=0){vec4 b,m,c,r;fieldMaterial(oldSlot,b,m,c,r);base=mix(b,baseNext,a);masks=mix(m,masksNext,a);cover=mix(c,coverNext,a);relief=mix(r,reliefNext,a);}
  if(atlasTerrainField.draft>0.5&&nextSlot>=0){vec4 b,m,c,r;fieldMaterial(draftSlot,b,m,c,r);base=clamp(base+(b-baseNext),0.0,1.0);masks=clamp(masks+(m-masksNext),0.0,1.0);cover=clamp(cover+(c-coverNext),0.0,1.0);relief=clamp(relief+(r-reliefNext),0.0,1.0);}
  vec3 physicalNormal=normalize(fieldNormal);
  float land=1.0-masks.r,slope=length(physicalNormal.xy)/max(physicalNormal.z,0.00001),rock=.85*smoothstep(.35,1.2,slope)*atlasTerrainField.mountains*land;
  float snow=smoothstep(atlasTerrainField.snowline,atlasTerrainField.snowline+300.0,fieldHeight)*(1.0-.8*smoothstep(1.0,2.5,slope))*atlasTerrainField.mountains*land;
  vec3 color=mix(base.rgb,vec3(144.0,139.0,129.0)/255.0,rock);color=mix(color,vec3(246.0,248.0,244.0)/255.0,snow);
  vec2 gradient=-physicalNormal.xy/max(physicalNormal.z,.00001);float light=1.0+atlasTerrainField.lightStrength*.55*((-gradient.x*sin(atlasTerrainField.lightRadians)+gradient.y*cos(atlasTerrainField.lightRadians)+1.0)/sqrt(1.0+dot(gradient,gradient))-1.0);color*=mix(1.0,light,land);
  if(atlasTerrainField.heightMode>.5){float q=clamp((fieldHeight-atlasTerrainField.seaLevel)/3000.0,0.0,1.0);color=mix(color,q<.4?mix(vec3(.74,.82,.58),vec3(.81,.69,.44),q/.4):mix(vec3(.81,.69,.44),vec3(.57,.41,.36),(q-.4)/.6),land);}
  fragColor=vec4(color,1.0);DECKGL_FILTER_COLOR(fragColor,geometry);
}`;

type FieldLayerProps={owner:AtlasTerrainFieldGpuOwner;tables:AtlasTerrainFieldTables;geometry:AtlasTerrainFieldGeometry;endFrameDraws?:AtlasTerrainFieldGeometry['draws'];oldModels:readonly AtlasTerrainTileModel[];newModels:readonly AtlasTerrainTileModel[];draftModels:readonly AtlasTerrainTileModel[];oldBase:number;newBase:number;draftBase:number;alpha:number;frameOrigin:{x:number;y:number;z:number};exaggeration:number;terrainStyle:Readonly<TerrainStyle>;seaLevelM:number;materialBand:number;onDrawSuccess?:(uploadedAlpha:number)=>void};
export class AtlasTerrainFieldLayer extends SimpleMeshLayer<unknown,FieldLayerProps>{
  static layerName='AtlasTerrainFieldLayer';
  getShaders(){const shaders=super.getShaders();return{...shaders,vs:'preparedBasis' in this.props.geometry?ATLAS_TERRAIN_PREPARED_VS:ATLAS_TERRAIN_FIELD_VS,fs:ATLAS_TERRAIN_FIELD_FS,modules:[...shaders.modules,fieldUniforms]};}
  protected getModel(_mesh:unknown){
    const source=this.props.geometry,device=this.context.device;
    let vertices:Buffer|undefined,draft:Buffer|undefined,indices:Buffer|undefined,model:Model|undefined;
    try{
      vertices=device.createBuffer({id:'atlas-terrain-field-vertices',data:source.vertices,usage:Buffer.VERTEX});
      indices=device.createBuffer({id:'atlas-terrain-field-indices',data:source.indices,usage:Buffer.INDEX});
      const prepared='preparedBasis' in source?source as AtlasTerrainPreparedLayerGeometry:null;
      if(prepared?.preparedDraft)draft=device.createBuffer({id:'atlas-terrain-field-draft',data:prepared.preparedDraft,usage:Buffer.VERTEX});
      const geometry=prepared?new GPUGeometry({topology:'triangle-list',vertexCount:source.indices.length,
        attributes:{terrainBasisVertices:vertices,terrainDraftVertices:draft??vertices},indices,
        bufferLayout:[
          {name:'terrainBasisVertices',stepMode:'vertex',byteStride:TERRAIN_PREPARED_LAYOUT.basisBytes,attributes:[
            {attribute:'terrainLocal',format:'float32x2',byteOffset:0},
            {attribute:'terrainOldHeight',format:'float32x2',byteOffset:8},
            {attribute:'terrainOldGradient',format:'float32x4',byteOffset:16},
            {attribute:'terrainNewHeight',format:'float32x2',byteOffset:32},
            {attribute:'terrainNewGradient',format:'float32x4',byteOffset:40}]},
          {name:'terrainDraftVertices',stepMode:'vertex',byteStride:draft?TERRAIN_PREPARED_LAYOUT.draftBytes:TERRAIN_PREPARED_LAYOUT.basisBytes,attributes:[
            {attribute:'terrainDraftHeight',format:'float32x2',byteOffset:draft?0:32},
            {attribute:'terrainDraftGradient',format:'float32x4',byteOffset:draft?8:40}]}
        ]}):new GPUGeometry({topology:'triangle-list',vertexCount:source.indices.length,attributes:{terrainFieldVertices:vertices},indices,bufferLayout:[{name:'terrainFieldVertices',stepMode:'vertex',byteStride:16,attributes:[{attribute:'terrainLocal',format:'float32x2',byteOffset:0},{attribute:'terrainSlots',format:'float32x2',byteOffset:8}]}]});
      model=new Model(device,{...this.getShaders(),id:this.props.id,bufferLayout:this.getAttributeManager()!.getBufferLayouts(),geometry,isInstanced:true});
      model.shaderInputs.setProps({simpleMesh:{sampler:this.state.emptyTexture,hasTexture:false}});return model;
    }catch(error){if(model)model.destroy();else{draft?.destroy();indices?.destroy();vertices?.destroy();}throw error;}
  }
  draw(options:Parameters<SimpleMeshLayer['draw']>[0]){
    const model=this.state.model,p=this.props;if(!model||!model.indexBuffer||this.getNumInstances()<1||model.instanceCount<1||!p.geometry.draws.length)return;
    const style=p.terrainStyle,alpha=Math.fround(p.alpha),picking=Boolean((options as {shaderModuleProps?:{picking?:{isActive?:number|boolean}}}).shaderModuleProps?.picking?.isActive);
    if(!Number.isFinite(alpha))throw Error('Terrainfeld-Screenalpha ungültig.');
    // SimpleMeshLayer.draw normally installs these uniforms before its own
    // Model.draw call. This field is always CARTESIAN, so composition is true.
    model.shaderInputs.setProps({simpleMesh:{sizeScale:p.sizeScale,composeModelMatrix:true,flatShading:!this.state.hasNormals}});
    model.setBindings({atlasFieldHeight:p.owner.arrays.height,atlasFieldBase:p.owner.arrays.base,atlasFieldMasks:p.owner.arrays.masks,atlasFieldCover:p.owner.arrays.cover,atlasFieldRelief:p.owner.arrays.relief,atlasFieldMeta:p.tables.slotMetadata,atlasFieldEdgeOwners:p.tables.edgeOwners});
    let covered=0,drawn=0;
    for(const draw of p.endFrameDraws??p.geometry.draws){
      if(draw.firstIndex!==covered||!Number.isSafeInteger(draw.indexCount)||draw.indexCount<3||draw.indexCount%3)throw Error('Terrainfeld-Screenpartition ungültig.');
      covered+=draw.indexCount;
      if(draw.oldSlot<0&&draw.newSlot<0){
        if(alpha!==1||!p.endFrameDraws)throw Error('Terrainfeld-Endpartition ohne Quelle.');
        continue; // An old-only region has disappeared at the confirmed endpoint.
      }
      p.owner.uploadSlotMetadata(draw.origin,p.oldModels,p.newModels,p.draftModels,{old:p.oldBase,new:p.newBase,draft:p.draftBase},p.tables);model.shaderInputs.setProps({atlasTerrainField:{alpha,draft:p.draftModels.length?1:0,exaggeration:p.exaggeration,frameHeight:p.frameOrigin.z,frameHeightPair:terrainSplit(p.frameOrigin.z),oldSlot:draw.oldSlot,newSlot:draw.newSlot,snowline:style.snowlineM??2500,mountains:style.mountains&&style.mode!=='height'?1:0,lightRadians:style.lightDegrees*Math.PI/180,lightStrength:style.strength,seaLevel:p.seaLevelM,heightMode:style.mode==='height'?1:0,newBase:p.newBase,draftBase:p.draftBase,drawOffset:[draw.origin.x-p.frameOrigin.x,draw.origin.y-p.frameOrigin.y],materialBand:p.materialBand,drawBounds:[draw.bounds.x-draw.origin.x,draw.bounds.y-draw.origin.y,draw.bounds.x+draw.bounds.width-draw.origin.x,draw.bounds.y+draw.bounds.height-draw.origin.y]}});model.setIndexCount(draw.indexCount);
      // luma's WebGL render pass feeds indexed byte offsets through firstVertex,
      // while WebGPU consumes the element offset as firstIndex.
      model.setDrawOffsets(atlasTerrainFieldDrawOffsets(draw));
      if(model.draw(this.context.renderPass)!==true){
        const state=model as unknown as {_drawBlockedReason?:string|false;_pipelineNeedsUpdate?:string|false};
        if(model.pipeline.isErrored||state._drawBlockedReason&&!state._pipelineNeedsUpdate)
          throw Error(`Terrainfeld-Screenpipeline fehlgeschlagen: ${state._drawBlockedReason||'Pipelinefehler'}.`);
        return;
      }
      drawn++;
    }
    if(covered!==p.geometry.indices.length)throw Error('Terrainfeld-Screenpartition unvollständig.');
    if(!picking&&drawn>0)p.onDrawSuccess?.(alpha);
  }
}
export type AtlasTerrainFieldLayerProps=SimpleMeshLayerProps<unknown>&FieldLayerProps;
