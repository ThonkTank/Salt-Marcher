import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const bindingKeys=['runId','frameId','generation','revision','content','alpha','fieldId','geometryId','tableIds','programExpectationId'];
const sameBinding=(a,b)=>!!a&&!!b&&bindingKeys.every(key=>JSON.stringify(a[key])===JSON.stringify(b[key]));
const integer=(value,min=0)=>Number.isSafeInteger(value)&&value>=min;
const positive=value=>integer(value,1);
const sha256=value=>createHash('sha256').update(value).digest('hex');

/** Supplied by the runtime owner before launch, never derived from the program
 * being observed. Full assembled sources include all library prologues/defines. */
export function bindTerrainFieldProgramExpectation(input,runtimeHashes){
 if(input?.schema!=='terrain-field-program-expectation/v1'||!input.candidate||
    !input.provenance?.manifestPath||!/^[a-f0-9]{64}$/.test(input.provenance.manifestSha256??''))throw Error('Missing independent program expectation/provenance.');
 const runtime=Object.entries(input.runtimeHashes??{}).sort();
 if(!runtime.length||runtime.some(([name,hash])=>!name||!/^[a-f0-9]{64}$/.test(hash)))throw Error('Missing bound runtime hashes.');
 if(runtimeHashes&&JSON.stringify(runtime)!==JSON.stringify(Object.entries(runtimeHashes).sort()))throw Error('Program expectation belongs to another runtime.');
 const shaders=input.shaders;
 if(!Array.isArray(shaders)||shaders.length!==2)throw Error('Expected exactly one vertex and one fragment source.');
 for(const [stage,type]of [['vertex',35633],['fragment',35632]]){
  const matches=shaders.filter(shader=>shader?.stage===stage&&shader.type===type);
  if(matches.length!==1||typeof matches[0].source!=='string'||!matches[0].source||sha256(matches[0].source)!==matches[0].sha256)throw Error('Missing or invalid typed expected shader source.');
 }
 const identity=sha256(JSON.stringify({candidate:input.candidate,provenance:input.provenance,runtime,shaders:shaders.map(({stage,type,sha256})=>({stage,type,sha256})).sort((a,b)=>a.type-b.type)}));
 return{...input,identity};
}

function programMatches(record,expected){
 return positive(record?.id)&&Array.isArray(record?.attachments)&&record.attachments.length===2&&
  new Set(record.attachments.map(shader=>shader.shaderId)).size===2&&new Set(record.attachments.map(shader=>shader.type)).size===2&&record.attachments.every(shader=>
   positive(shader.shaderId)&&shader.capturedBeforeCompile===true&&expected.shaders.some(wanted=>
    wanted.type===shader.type&&wanted.source===shader.source&&sha256(shader.source)===wanted.sha256));
}

/** Technical E preflight only. A file, callback or counter cannot substitute for
 * an actual complete field screen batch and a review of its exact image. */
export function evaluateTerrainFieldGate(evidence,{imageBytes,visualReview,programExpectation}={}){
 const reasons=[],reject=message=>reasons.push(message);
 if(evidence?.schema!=='terrain-field-screen-gate/v1')reject('Missing current field-screen evidence schema.');
 const expected=evidence?.expected,frame=evidence?.frame;
 let program=null;
 if(!evidence?.runtimeHashes)reject('Missing actual run runtime hashes.');
 try{program=bindTerrainFieldProgramExpectation(programExpectation,evidence?.runtimeHashes);}catch(error){reject(error.message);}
 const binding=expected?.binding;
 if(!binding||typeof binding.runId!=='string'||!binding.runId||!positive(binding.frameId)||
    !['generation','revision','content'].every(key=>integer(binding[key]))||
    !Number.isFinite(binding.alpha)||binding.alpha<0||binding.alpha>1||binding.alpha!==Math.fround(binding.alpha)||
    !binding.fieldId||!binding.geometryId||!Array.isArray(binding.tableIds)||binding.tableIds.length!==2||binding.tableIds.some(value=>!value))
  reject('Missing exact current run/frame/field/Float32-alpha/geometry/table binding.');
 if(binding?.alpha!==1)reject('This confirmed end-frame gate requires Alpha 1.');
 if(!program||binding?.programExpectationId!==program.identity)reject('Frame lacks the independent expected program binding.');
 if(!sameBinding(binding,frame?.binding)||!sameBinding(binding,frame?.snapshot?.binding))reject('Old or mismatched field frame/snapshot.');
 if(!Number.isFinite(expected?.afterAt)||!Number.isFinite(frame?.startedAt)||frame.startedAt<expected.afterAt||
    !Number.isFinite(frame?.finishedAt)||frame.finishedAt<frame.startedAt)reject('No fresh completed render interval.');
 if(frame?.snapshot?.complete!==true||frame?.afterRender!==true||!Number.isFinite(frame?.snapshot?.at)||
    frame.snapshot.at<frame.startedAt||frame.snapshot.at>frame.finishedAt)reject('No complete current afterRender snapshot.');
 if(frame?.contextLost!==false||frame?.glError!==0||!Array.isArray(frame?.errors)||frame.errors.length)reject('Lost/unknown context or GL/render error.');
 const partitions=expected?.partitions;
 if(!Array.isArray(partitions)||!partitions.length)reject('No required field partitions.');
 if(!Array.isArray(frame?.required)||JSON.stringify(partitions)!==JSON.stringify(frame.required))reject('Required partitions differ from the complete observed descriptor list.');
 if(!positive(expected?.indexCapacity)||frame?.indexCapacity!==expected.indexCapacity)reject('Missing common bound index capacity.');
 const partitionKeys=new Set();let covered=0;
 for(const partition of Array.isArray(partitions)?partitions:[]){
  const key=partition?.key;
  if(typeof key!=='string'||!key||partitionKeys.has(key))reject('Missing or duplicate required partition identity.');
  partitionKeys.add(key);
  if(!positive(partition?.indexCount)||partition.indexCount%3!==0||!integer(partition?.firstIndex)||
     !positive(partition?.vertexCount)||!positive(partition?.indexCapacity)||partition.firstIndex+partition.indexCount>partition.indexCapacity||
     !integer(partition?.maxIndex)||partition.maxIndex>=partition.vertexCount)reject('Empty or invalid required indexed geometry.');
  const stride=partition?.vertexLayout==='prepared14'?14:partition?.vertexLayout==='legacy4'?4:0;
  if(!stride||partition?.layoutValid!==true||!positive(partition?.vertexFloatCount)||partition.vertexFloatCount!==partition.vertexCount*stride)reject('Missing or invalid bound vertex layout.');
  if(typeof partition?.active!=='boolean'||!integer(partition?.oldSlot,-1)||!integer(partition?.newSlot,-1)||typeof partition?.endFrame!=='boolean'||
     partition.active!==(partition.oldSlot>=0||partition.newSlot>=0)||!partition.active&&(!partition.endFrame||binding?.alpha!==1))reject('Invalid active or absent endpoint partition.');
  if(partition?.indexCapacity!==expected?.indexCapacity||partition?.firstIndex!==covered)reject('Required index coverage is unordered, overlapping or has a gap.');
  covered+=positive(partition?.indexCount)?partition.indexCount:0;
 }
 if(covered!==expected?.indexCapacity)reject('Required partitions do not cover the full bound index capacity.');
 const draws=Array.isArray(frame?.draws)?frame.draws:[];
 const screen=draws.filter(draw=>draw?.target==='screen'&&draw.picking===false),relevant=screen.filter(draw=>draw.fieldProgram===true);
 if(screen.length!==relevant.length)reject('Scoped field screen dispatch used an unexpected program.');
 if(!relevant.length)reject('No actual fieldScreenDraws.');
 const active=Array.isArray(partitions)?partitions.filter(partition=>partition?.active===true):[];
 if(relevant.length!==active.length)reject('Incomplete or duplicate required field screen batch.');
 for(const partition of active){
  const matches=relevant.filter(draw=>draw.partitionKey===partition.key);
  if(matches.length!==1){reject('Required field partition missing or repeated.');continue;}
  const draw=matches[0];
  const records=Array.isArray(frame?.programs)?frame.programs.filter(record=>record.id===draw.programId):[];
  if(!program||records.length!==1||records[0].programObjectId!==draw.currentProgramId||!positive(draw.currentProgramId)||!programMatches(records[0],program))reject('Actual CURRENT_PROGRAM has missing, wrongly typed or different precompiled shader sources.');
  if(!sameBinding(binding,draw.binding)||draw.glDispatch!==true||draw.modelResult!==true||
     !positive(draw.indices)||draw.indices!==partition.indexCount||draw.byteOffset!==partition.firstIndex*4||
     !positive(draw.instances)||draw.mode!=='triangles'||draw.indexType!=='uint32'||
     draw.contextLost!==false||draw.glError!==0)reject('Field draw was false, stale, empty, partial or errored.');
 }
 const image=evidence?.image;
 let imageHash=null;
 if(imageBytes instanceof Uint8Array&&imageBytes.byteLength>8){
  const bytes=Buffer.from(imageBytes);
  try{const decoded=PNG.sync.read(bytes);if(decoded.width>0&&decoded.height>0)imageHash=createHash('sha256').update(bytes).digest('hex');}catch{}
 }
 if(!imageHash||!image?.path||image.sha256!==imageHash||!sameBinding(binding,image.binding)||
    !Number.isFinite(image.capturedAt)||image.capturedAt<frame?.finishedAt)reject('No verified image bound to this completed field frame.');
 if(visualReview?.kind!=='direct-terrain-image-review'||!sameBinding(binding,visualReview.binding)||
    visualReview.imageSha256!==imageHash||visualReview.visibleTerrain!==true||
    typeof visualReview.reviewer!=='string'||!visualReview.reviewer.trim()||
    typeof visualReview.observations!=='string'||!visualReview.observations.trim())reject('Missing direct visible-terrain review of this exact image/frame.');
 return{pass:reasons.length===0,fieldScreenDraws:relevant.length,positiveIndices:relevant.reduce((sum,draw)=>sum+(positive(draw.indices)?draw.indices:0),0),reasons:[...new Set(reasons)],scope:'Early field screen/image gate only; no complete E/Q/native product acceptance.'};
}

/** Serialized by Playwright before app initialization. Observe GL dispatch
 * independently of Surface's success callback; never query compile/link status. */
export function installTerrainFieldGateObserver({runId,programExpectation}){
 const ids=new WeakMap(),shaders=new WeakMap(),attachments=new WeakMap(),linked=new WeakMap(),wrappedLayers=new WeakSet();let serial=0,frameSerial=0,scope=null;
 const id=value=>value?(ids.has(value)?ids.get(value):(ids.set(value,++serial),serial)):null;
 const probe=window.__twFieldGate={runId,frames:[],fieldScreenDraws:0,programs:[]};
 const P=WebGL2RenderingContext.prototype;
 const create=P.createShader;P.createShader=function(type){const shader=create.call(this,type);if(shader)shaders.set(shader,{type,source:null,compiled:null});return shader;};
 const source=P.shaderSource;P.shaderSource=function(shader,text){const record=shaders.get(shader);if(record)record.source=text;return source.call(this,shader,text);};
 const compile=P.compileShader;P.compileShader=function(shader){const record=shaders.get(shader);if(record)record.compiled={shaderId:id(shader),type:record.type,source:record.source,capturedBeforeCompile:typeof record.source==='string'};return compile.call(this,shader);};
 const attach=P.attachShader;P.attachShader=function(program,shader){if(program){const list=attachments.get(program)??[];list.push(shader);attachments.set(program,list);}return attach.call(this,program,shader);};
 const detach=P.detachShader;P.detachShader=function(program,shader){const list=attachments.get(program);if(list)attachments.set(program,list.filter(value=>value!==shader));return detach.call(this,program,shader);};
 const link=P.linkProgram;P.linkProgram=function(program){if(program){const record={programObjectId:id(program),attachments:(attachments.get(program)??[]).map(shader=>shaders.get(shader)?.compiled??{shaderId:id(shader),type:null,source:null,capturedBeforeCompile:false})};record.id=id(record);linked.set(program,record);probe.programs.push(record);}return link.call(this,program);};
 const fieldProgram=record=>!!programExpectation&&record?.attachments?.length===2&&programExpectation.shaders.every(expected=>record.attachments.filter(shader=>shader.type===expected.type&&shader.source===expected.source&&shader.capturedBeforeCompile===true).length===1);
 for(const name of ['drawElements','drawElementsInstanced','drawRangeElements','drawArrays','drawArraysInstanced']){
  const call=P[name];P[name]=function(...args){
   if(!scope)return call.apply(this,args);
   const {frame,partitionKey,binding,model}=scope,isRange=name==='drawRangeElements',indexed=name.startsWith('drawElements')||isRange;
   const uniforms=model.shaderInputs?.getUniformValues?.(),picking=uniforms?.picking?.isActive;
   const activeProgram=this.getParameter(this.CURRENT_PROGRAM),program=linked.get(activeProgram);
   if(program&&!frame.programs.some(value=>value.id===program.id))frame.programs.push(program);
   const draw={binding:{...binding,alpha:Number.isFinite(uniforms?.atlasTerrainField?.alpha)?Math.fround(uniforms.atlasTerrainField.alpha):null},partitionKey,programId:program?.id??null,currentProgramId:id(activeProgram),target:this.getParameter(this.DRAW_FRAMEBUFFER_BINDING)===null?'screen':'offscreen',picking:picking===0||picking===false?false:true,fieldProgram:fieldProgram(program),glDispatch:false,modelResult:false,indices:indexed?args[isRange?3:1]:0,byteOffset:indexed?args[isRange?5:3]:null,instances:name.endsWith('Instanced')?args[indexed?4:3]:1,mode:args[0]===this.TRIANGLES?'triangles':'other',indexType:indexed&&args[isRange?4:2]===this.UNSIGNED_INT?'uint32':'other',contextLost:this.isContextLost(),glError:null};
   frame.draws.push(draw);scope.dispatched.push(draw);
   try{const result=call.apply(this,args);draw.glDispatch=true;return result;}
   catch(error){frame.errors.push(String(error));throw error;}
   finally{draw.contextLost ||= this.isContextLost();draw.glError=this.getError();if(draw.glError)frame.errors.push('GL '+draw.glError);if(draw.target==='screen'&&!draw.picking&&draw.fieldProgram&&draw.glDispatch&&draw.indices>0&&draw.instances>0)probe.fieldScreenDraws++;}
  };
 }
 window.__twObserveFieldSurface=surface=>{
  const deck=surface.deckValue,gl=surface.canvas.getContext('webgl2'),originalSetProps=deck.setProps;
  const binding=(field,frameId)=>({runId,frameId,generation:surface.generation,revision:surface.revision,content:surface.terrainContentRevision,alpha:Math.fround(surface.terrainAlpha),fieldId:field?.layerId??null,geometryId:id(field?.geometry),tableIds:[id(field?.tables.slotMetadata),id(field?.tables.edgeOwners)],programExpectationId:programExpectation?.identity??null});
  // Match the layer's ABI selector and effective draw list, not array-size
  // heuristics. End-frame descriptors still cover all indices when an old-only
  // partition disappears; only its actual Model.draw call is absent.
  const partitions=layer=>{
   const g=layer.props.geometry,prepared='preparedBasis' in g,stride=prepared?14:4,endFrame=layer.props.endFrameDraws!=null;
   const layoutValid=g.vertices instanceof Float32Array&&g.indices instanceof Uint32Array&&g.vertices.length%stride===0&&
    (!prepared||g.preparedBasis===g.vertices&&(!g.preparedDraft||g.preparedDraft instanceof Float32Array&&g.preparedDraft.length===g.vertices.length/14*6));
   return(layer.props.endFrameDraws??g.draws).map((draw,index)=>{let maxIndex=-1;for(let i=draw.firstIndex;i<draw.firstIndex+draw.indexCount;i++)maxIndex=Math.max(maxIndex,g.indices[i]??Infinity);
    return{key:layer.id+':'+index,firstIndex:draw.firstIndex,indexCount:draw.indexCount,vertexCount:g.vertices.length/stride,vertexFloatCount:g.vertices.length,vertexLayout:prepared?'prepared14':'legacy4',layoutValid,indexCapacity:g.indices.length,maxIndex,oldSlot:draw.oldSlot,newSlot:draw.newSlot,endFrame,active:!(draw.oldSlot<0&&draw.newSlot<0)};
   });
  };
  const fieldLayers=layers=>layers.filter(layer=>layer?.id?.startsWith('atlas-terrain-field:')&&layer.props.visible!==false);
  const wrapLayer=layer=>{
   if(wrappedLayers.has(layer))return;wrappedLayers.add(layer);const originalDraw=layer.draw;
   layer.draw=function(...args){
    const frame=probe.currentFrame,model=this.state.model;
    if(!frame||!model)return originalDraw.apply(this,args);
    const modelDraw=model.draw,required=partitions(this).filter(partition=>partition.active);let cursor=0;
    const actualBinding={...frame.binding,fieldId:this.id,geometryId:id(this.props.geometry),tableIds:[id(this.props.tables?.slotMetadata),id(this.props.tables?.edgeOwners)]};
    model.draw=function(...modelArgs){const previous=scope,local={frame,model,binding:actualBinding,partitionKey:required[cursor++]?.key??'unexpected-partition',dispatched:[]};scope=local;
     try{const result=modelDraw.apply(this,modelArgs);for(const draw of local.dispatched)draw.modelResult=result===true;return result;}
     catch(error){frame.errors.push(String(error));throw error;}
     finally{scope=previous;}
    };
    try{return originalDraw.apply(this,args);}finally{model.draw=modelDraw;}
   };
  };
  const wrapProps=props=>{
   const next={...props};if(next.layers)fieldLayers(next.layers).forEach(wrapLayer);
   if(next.onBeforeRender&&!next.onBeforeRender.__twFieldWrapped){const before=next.onBeforeRender;next.onBeforeRender=function(...args){const current=binding(surface.terrainField,++frameSerial);probe.currentFrame={binding:current,indexCapacity:surface.terrainField?.geometry.indices.length??null,startedAt:performance.now(),required:fieldLayers(deck.props.layers).flatMap(partitions),draws:[],programs:[],errors:[],afterRender:false,contextLost:gl.isContextLost(),glError:null};return before.apply(this,args);};next.onBeforeRender.__twFieldWrapped=true;}
   if(next.onAfterRender&&!next.onAfterRender.__twFieldWrapped){const after=next.onAfterRender;next.onAfterRender=function(...args){const current=probe.currentFrame;
    try{return after.apply(this,args);}catch(error){current?.errors.push(String(error));throw error;}
    finally{if(current){const snapshot=surface.terrainSnapshot;current.afterRender=true;current.finishedAt=performance.now();current.contextLost ||= gl.isContextLost();current.glError=gl.getError();current.snapshot=snapshot?{at:snapshot.at,binding:{...binding(snapshot.field,current.binding.frameId),content:snapshot.content,alpha:Math.fround(snapshot.alpha)},complete:snapshot.complete}:null;probe.frames.push(current);if(probe.frames.length>120)probe.frames.shift();probe.currentFrame=null;}}
   };next.onAfterRender.__twFieldWrapped=true;}
   return next;
  };
  deck.setProps=function(props){return originalSetProps.call(this,wrapProps(props));};
  deck.setProps({layers:deck.props.layers,onBeforeRender:deck.props.onBeforeRender,onAfterRender:deck.props.onAfterRender});
 };
}

// Reassess an already captured current run after a direct image review, without
// starting Electron or modifying its original evidence/result files.
export async function loadTerrainFieldProgramExpectation(filename,runtimeHashes){
 const input=JSON.parse(await readFile(filename,'utf8'));
 const expected=bindTerrainFieldProgramExpectation(input,runtimeHashes);
 const provenanceBytes=await readFile(path.resolve(path.dirname(filename),expected.provenance.manifestPath));
 if(sha256(provenanceBytes)!==expected.provenance.manifestSha256)throw Error('Program provenance manifest hash mismatch.');
 return expected;
}
export async function evaluateTerrainFieldGateFile(evidencePath,reviewPath,programPath){
 const evidence=JSON.parse(await readFile(evidencePath,'utf8'));
 const imageBytes=evidence.image?.path?await readFile(path.resolve(path.dirname(evidencePath),evidence.image.path)).catch(()=>null):null;
 const visualReview=reviewPath?JSON.parse(await readFile(reviewPath,'utf8')):undefined;
 const programExpectation=programPath?await loadTerrainFieldProgramExpectation(programPath,evidence.runtimeHashes):undefined;
 return evaluateTerrainFieldGate(evidence,{imageBytes,visualReview,programExpectation});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [evidencePath,reviewPath,programPath]=process.argv.slice(2);
 if(!evidencePath)throw Error('Usage: node tools/terrain-water-field-gate.mjs gate-evidence.json visual-review.json program-expectation.json');
 const answer=await evaluateTerrainFieldGateFile(evidencePath,reviewPath,programPath);console.log(JSON.stringify(answer,null,2));if(!answer.pass)process.exitCode=1;
}
