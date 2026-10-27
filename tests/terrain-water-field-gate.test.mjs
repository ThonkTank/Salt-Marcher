import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {bindTerrainFieldProgramExpectation,evaluateTerrainFieldGate,evaluateTerrainFieldGateFile,installTerrainFieldGateObserver} from '../tools/terrain-water-field-gate.mjs';

// Explicitly synthetic logic data; its positive decision is no native/UI proof.
function fixture(){
 const png=new PNG({width:2,height:2});png.data.set([50,80,20,255,90,100,40,255,80,75,20,255,100,90,30,255]);
 const imageBytes=PNG.sync.write(png),imageSha256=createHash('sha256').update(imageBytes).digest('hex');
 const runtimeHashes={'ui/atlas-deck-runtime.js':'a'.repeat(64)},manifestBytes=Buffer.from('Synthetic logic provenance, no native runtime.');
 const shaders=[['vertex',35633,'#define SHADER_NAME atlas-terrain-field-vs\nvoid main(){gl_Position=vec4(1.0);}'],['fragment',35632,'#define SHADER_NAME atlas-terrain-field-fs\nvoid main(){fragColor=vec4(1.0);}']].map(([stage,type,source])=>({stage,type,source,sha256:createHash('sha256').update(source).digest('hex')}));
 const programExpectation=bindTerrainFieldProgramExpectation({schema:'terrain-field-program-expectation/v1',candidate:'synthetic-prebound-pair',provenance:{manifestPath:'synthetic-manifest.json',manifestSha256:createHash('sha256').update(manifestBytes).digest('hex')},runtimeHashes,shaders});
 const binding={runId:'synthetic-logic-only',frameId:7,generation:1,revision:3,content:2,alpha:1,fieldId:'field-2',geometryId:14,tableIds:[20,21],programExpectationId:programExpectation.identity};
 const descriptor={vertexFloatCount:24,vertexLayout:'legacy4',layoutValid:true,oldSlot:0,newSlot:32,endFrame:false,active:true};
 const partitions=[{...descriptor,key:'field-2:0',firstIndex:0,indexCount:6,vertexCount:6,indexCapacity:9,maxIndex:3},{...descriptor,key:'field-2:1',firstIndex:6,indexCount:3,vertexCount:6,indexCapacity:9,maxIndex:5}];
 const draw=(partition)=>({binding:{...binding},partitionKey:partition.key,programId:30,currentProgramId:31,target:'screen',picking:false,fieldProgram:true,glDispatch:true,modelResult:true,indices:partition.indexCount,byteOffset:partition.firstIndex*4,instances:1,mode:'triangles',indexType:'uint32',contextLost:false,glError:0});
 const programs=[{id:30,programObjectId:31,attachments:shaders.map((shader,index)=>({shaderId:40+index,type:shader.type,source:shader.source,capturedBeforeCompile:true}))}];
 const evidence={schema:'terrain-field-screen-gate/v1',runtimeHashes,expected:{binding,afterAt:100,indexCapacity:9,partitions},frame:{binding:{...binding},indexCapacity:9,required:structuredClone(partitions),programs,startedAt:101,finishedAt:104,afterRender:true,contextLost:false,glError:0,errors:[],snapshot:{at:103,binding:{...binding},complete:true},draws:partitions.map(draw)},image:{path:'synthetic.png',sha256:imageSha256,binding:{...binding},capturedAt:105}};
 const visualReview={kind:'direct-terrain-image-review',binding:{...binding},imageSha256,visibleTerrain:true,reviewer:'Synthetic fixture only',observations:'Synthetic positive branch; no actual terrain session or native acceptance.'};
 return{evidence,imageBytes,visualReview,programExpectation,manifestBytes};
}
const decide=f=>evaluateTerrainFieldGate(f.evidence,{imageBytes:f.imageBytes,visualReview:f.visualReview,programExpectation:f.programExpectation});

test('only a full fresh indexed field screen batch plus its exact reviewed image takes the positive branch (logic fixture only)',()=>{
 const f=fixture(),answer=decide(f);assert.equal(answer.pass,true);assert.equal(answer.fieldScreenDraws,2);assert.equal(answer.positiveIndices,9);assert.match(answer.scope,/no complete E\/Q\/native/);
});

test('old five-sample/allocated-array/frame/file evidence cannot qualify as field screen or image proof',()=>{
 assert.equal(evaluateTerrainFieldGate({firstShaderDrawGate:true,drawSamples:Array.from({length:5},()=>({drawCalls:0,indices:0})),arrays:Array(5).fill({depth:128}),frames:100,screenshot:'exists.png'}).pass,false);
});

for(const [name,mutate]of [
 ['null result',f=>f.evidence=null],
 ['zero relevant draws',f=>f.evidence.frame.draws=[]],
 ['only picker draws',f=>f.evidence.frame.draws.forEach(d=>{d.target='picker';d.picking=true;})],
 ['only other scene draws',f=>f.evidence.frame.draws.forEach(d=>d.fieldProgram=false)],
 ['extra scoped draw using another program',f=>f.evidence.frame.draws.push({...structuredClone(f.evidence.frame.draws[0]),fieldProgram:false})],
 ['zero draw indices',f=>f.evidence.frame.draws[0].indices=0],
 ['zero required geometry',f=>f.evidence.expected.partitions[0].vertexCount=0],
 ['empty required partition',f=>f.evidence.expected.partitions[0].indexCount=0],
 ['partial batch',f=>f.evidence.frame.draws.pop()],
 ['truncated expectation and matching draw',f=>{f.evidence.expected.partitions.pop();f.evidence.frame.draws.pop();}],
 ['overlapping index intervals',f=>{f.evidence.expected.partitions[1].firstIndex=3;f.evidence.frame.draws[1].byteOffset=12;}],
 ['out-of-order complete partitions',f=>f.evidence.expected.partitions.reverse()],
 ['different partition capacity',f=>f.evidence.expected.partitions[1].indexCapacity=12],
 ['duplicate partition pretending complete',f=>f.evidence.frame.draws[1]=structuredClone(f.evidence.frame.draws[0])],
 ['false model draw',f=>f.evidence.frame.draws[0].modelResult=false],
 ['callback without GL dispatch',f=>f.evidence.frame.draws[0].glDispatch=false],
 ['zero instances',f=>f.evidence.frame.draws[0].instances=0],
 ['wrong GL index offset',f=>f.evidence.frame.draws[1].byteOffset=0],
 ['GL error',f=>f.evidence.frame.draws[0].glError=1282],
 ['context loss',f=>f.evidence.frame.contextLost=true],
 ['old frame',f=>f.evidence.frame.startedAt=99],
 ['old snapshot',f=>f.evidence.frame.snapshot.binding.content--],
 ['old snapshot with same content',f=>f.evidence.frame.snapshot.at=99],
 ['wrong alpha',f=>f.evidence.frame.draws[0].binding.alpha=.5],
 ['complete at consistent alpha zero',f=>{for(const b of [f.evidence.expected.binding,f.evidence.frame.binding,f.evidence.frame.snapshot.binding,f.evidence.image.binding,f.visualReview.binding,...f.evidence.frame.draws.map(d=>d.binding)])b.alpha=0;}],
 ['complete at consistent half alpha',f=>{for(const b of [f.evidence.expected.binding,f.evidence.frame.binding,f.evidence.frame.snapshot.binding,f.evidence.image.binding,f.visualReview.binding,...f.evidence.frame.draws.map(d=>d.binding)])b.alpha=.5;}],
 ['same shader marker but different vertex source',f=>f.evidence.frame.programs[0].attachments[0].source+='\n// changed VS'],
 ['same shader marker but different fragment source',f=>f.evidence.frame.programs[0].attachments[1].source+='\n// changed FS'],
 ['missing shader attachment',f=>f.evidence.frame.programs[0].attachments.pop()],
 ['wrongly typed shader attachment',f=>f.evidence.frame.programs[0].attachments[1].type=35633],
 ['wrong CURRENT_PROGRAM association',f=>f.evidence.frame.draws[0].currentProgramId++],
 ['missing independent program expectation',f=>f.programExpectation=undefined],
 ['program expectation from another runtime',f=>f.evidence.runtimeHashes['ui/atlas-deck-runtime.js']='b'.repeat(64)],
 ['source was not captured before compile',f=>f.evidence.frame.programs[0].attachments[0].capturedBeforeCompile=false],
 ['different tables',f=>f.evidence.frame.snapshot.binding.tableIds=[98,99]],
 ['no image',f=>f.imageBytes=undefined],
 ['corrupt PNG',f=>f.imageBytes=Buffer.from([137,80,78,71,13,10,26,10,1,2])],
 ['filename without visual review',f=>f.visualReview=undefined],
 ['no visible terrain',f=>f.visualReview.visibleTerrain=false],
 ['review of another image',f=>f.visualReview.imageSha256='0'.repeat(64)],
 ['image from another frame',f=>f.evidence.image.binding.frameId--]
])test(`negative gate: ${name}`,()=>{const f=fixture();mutate(f);const answer=decide(f);assert.equal(answer.pass,false);assert(answer.reasons.length>0);});

function withObservedField(options,check){
 const savedWindow=globalThis.window,savedGL=globalThis.WebGL2RenderingContext;
 class FakeGL{
  DRAW_FRAMEBUFFER_BINDING=1;CURRENT_PROGRAM=2;TRIANGLES=4;UNSIGNED_INT=5125;
  createShader(){return{};}shaderSource(){}compileShader(){}attachShader(){}detachShader(){}linkProgram(){}drawElements(){}drawElementsInstanced(){}drawRangeElements(){}drawArrays(){}drawArraysInstanced(){}
  getParameter(key){return key===this.DRAW_FRAMEBUFFER_BINDING?null:this.program;}
  getError(){return 0;}isContextLost(){return false;}
 }
 try{
  const input=fixture();globalThis.window={};globalThis.WebGL2RenderingContext=FakeGL;installTerrainFieldGateObserver({runId:'observer-logic-only',programExpectation:input.programExpectation});
  const gl=new FakeGL(),vs=gl.createShader(35633),fs=gl.createShader(35632);gl.program={};gl.shaderSource(vs,input.programExpectation.shaders[0].source);gl.shaderSource(fs,input.programExpectation.shaders[1].source);gl.compileShader(vs);gl.compileShader(fs);gl.attachShader(gl.program,vs);gl.attachShader(gl.program,fs);gl.linkProgram(gl.program);
  const vertices=new Float32Array(options.prepared?84:24);
  const geometry={vertices,indices:new Uint32Array([0,1,2,2,3,0,3,4,5]),draws:options.endFrame?
   [0,3,6].map(firstIndex=>({firstIndex,indexCount:3,oldSlot:0,newSlot:firstIndex===3?-1:32})):
   [{firstIndex:0,indexCount:6,oldSlot:0,newSlot:32},{firstIndex:6,indexCount:3,oldSlot:0,newSlot:32}]};
  if(options.prepared)geometry.preparedBasis=options.wrongBasis?vertices.slice():vertices;
  if(options.invalidIndex)geometry.indices[8]=6;
  const model={succeeds:true,shaderInputs:{getUniformValues:()=>({picking:{isActive:0},atlasTerrainField:{alpha:1}})},draw(){if(!this.succeeds)return false;gl.drawElementsInstanced(gl.TRIANGLES,this.indexCount,gl.UNSIGNED_INT,this.offset,1);return true;}};
  const layer={id:'atlas-terrain-field:test',props:{geometry,visible:true,alpha:1},state:{model},draw(){for(const [index,d] of (this.props.endFrameDraws??geometry.draws).entries()){
   if(d.oldSlot<0&&d.newSlot<0||options.missing===index)continue;
   model.indexCount=d.indexCount;model.offset=d.firstIndex*4;model.draw();if(options.duplicate===index)model.draw();
  }}};
  if(options.endFrame)layer.props.endFrameDraws=geometry.draws.map(draw=>({...draw,oldSlot:-1}));
  const field={layerId:layer.id,geometry,tables:{slotMetadata:{},edgeOwners:{}}};
  layer.props.tables=field.tables;
  const surface={generation:1,revision:3,terrainContentRevision:2,terrainAlpha:1,terrainField:field,canvas:{getContext:()=>gl}};
  const deck=surface.deckValue={props:{layers:[layer],onBeforeRender(){},onAfterRender(){surface.terrainSnapshot={at:performance.now(),field,content:2,alpha:1,complete:true};}},setProps(props){Object.assign(this.props,props);}};
  window.__twObserveFieldSurface(surface);
  const render=()=>{deck.props.onBeforeRender();layer.draw();deck.props.onAfterRender();return window.__twFieldGate.frames.at(-1);};
  const makeEvidence=frame=>{const f=fixture();f.evidence.expected={binding:frame.binding,afterAt:frame.startedAt-1,indexCapacity:frame.indexCapacity,partitions:frame.required};f.evidence.frame=frame;f.evidence.image.binding={...frame.binding};f.evidence.image.capturedAt=frame.finishedAt+1;f.visualReview.binding={...frame.binding};return f;};
  check({render:()=>makeEvidence(render()),model});
 }finally{if(savedWindow===undefined)delete globalThis.window;else globalThis.window=savedWindow;if(savedGL===undefined)delete globalThis.WebGL2RenderingContext;else globalThis.WebGL2RenderingContext=savedGL;}
}

test('observer binds historical four-float GL partitions and preserves a false Model.draw failure',()=>{
 withObservedField({},({render,model})=>{
  const good=render();assert.equal(decide(good).pass,true);assert.equal(good.evidence.frame.required[0].vertexCount,6);assert.equal(good.evidence.frame.required[0].vertexLayout,'legacy4');
  model.succeeds=false;const bad=render();assert.equal(bad.evidence.frame.snapshot.complete,true);assert.equal(decide(bad).pass,false);assert.equal(bad.evidence.frame.draws.length,0);
 });
});

test('observer binds prepared fourteen-float geometry to its real six vertices',()=>{
 withObservedField({prepared:true},({render})=>{
  const good=render();assert.equal(decide(good).pass,true);assert.equal(good.evidence.frame.required[0].vertexCount,6);assert.equal(good.evidence.frame.required[0].vertexLayout,'prepared14');
 });
});

test('end-frame absence keeps full descriptor coverage and skips only its actual middle Model draw',()=>{
 withObservedField({prepared:true,endFrame:true},({render})=>{
  const good=render(),frame=good.evidence.frame;assert.equal(decide(good).pass,true);
  assert.equal(frame.required.length,3);assert.equal(frame.required[1].active,false);assert.equal(frame.indexCapacity,9);
  assert.deepEqual(frame.draws.map(draw=>[draw.partitionKey,draw.byteOffset]),[['atlas-terrain-field:test:0',0],['atlas-terrain-field:test:2',24]]);
  assert.equal(decide({...good,evidence:{...good.evidence,expected:{...good.evidence.expected,partitions:frame.required.filter(partition=>partition.active)}}}).pass,false);
 });
});

for(const [name,options] of [
 ['prepared marker references a different basis',{prepared:true,wrongBasis:true}],
 ['prepared index beyond the actual vertex count',{prepared:true,invalidIndex:true}],
 ['legacy index beyond the actual vertex count',{invalidIndex:true}],
 ['missing active draw beside inactive endpoint',{prepared:true,endFrame:true,missing:2}],
 ['duplicate active draw beside inactive endpoint',{prepared:true,endFrame:true,duplicate:0}]
])test(`observer rejects ${name}`,()=>withObservedField(options,({render})=>assert.equal(decide(render()).pass,false)));

test('shortened expected capacity cannot hide observed active descriptors',()=>{
 const f=fixture();f.evidence.expected.partitions.pop();f.evidence.frame.draws.pop();
 f.evidence.expected.indexCapacity=6;f.evidence.frame.indexCapacity=6;f.evidence.expected.partitions[0].indexCapacity=6;
 assert.match(decide(f).reasons.join(' '),/complete observed descriptor list/);
});

test('offline assessment reads the bound actual PNG and requires its review; it never starts a native session',async()=>{
 const f=fixture(),dir=await mkdtemp(path.join(os.tmpdir(),'field-gate-logic-'));
 try{
  const evidencePath=path.join(dir,'gate-evidence.json'),reviewPath=path.join(dir,'review.json'),programPath=path.join(dir,'program.json');
  await writeFile(path.join(dir,'synthetic.png'),f.imageBytes);await writeFile(evidencePath,JSON.stringify(f.evidence));await writeFile(reviewPath,JSON.stringify(f.visualReview));await writeFile(programPath,JSON.stringify(f.programExpectation));await writeFile(path.join(dir,'synthetic-manifest.json'),f.manifestBytes);
  assert.equal((await evaluateTerrainFieldGateFile(evidencePath,reviewPath,programPath)).pass,true);
  assert.equal((await evaluateTerrainFieldGateFile(evidencePath,undefined,programPath)).pass,false);
  await rm(path.join(dir,'synthetic.png'));assert.equal((await evaluateTerrainFieldGateFile(evidencePath,reviewPath,programPath)).pass,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
