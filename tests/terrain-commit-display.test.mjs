import {atlasAuthorReferenceFixture} from './helpers/atlas-author-recovery.mjs';
import {atlasFixture,landscapeFixture} from './helpers/atlas-workbench.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({stdin:{contents:"export * from './src/app/campaign-atlas-ui';export * from './src/app/atlas-landscape-ui';",resolveDir:process.cwd()},outfile:'.build/terrain-commit-display-test.cjs',bundle:true,platform:'node',format:'cjs',external:['obsidian']});
const {CampaignAtlasWorkbench,LandscapeWorkbench}=createRequire(import.meta.url)('../.build/terrain-commit-display-test.cjs');
test('released direct strokes retain their author fence while releasing camera input',()=>{
 const ui=Object.assign(landscapeFixture(LandscapeWorkbench),{
  live:{},pointer:7,saving:false,tool:'height',points:[{x:0,y:0}],dirty:false,calibration:null,
 });
 assert.equal(ui.blocksNavigation(),true);assert.equal(ui.hasDraft(),true);
 ui.pointer=null;ui.saving=true;
 assert.equal(ui.blocksNavigation(),false);assert.equal(ui.hasDraft(),true);
 ui.live=null;
 assert.equal(ui.blocksNavigation(),true,'ordinary unfinished author drafts stay protected');
 ui.saving=false;ui.points=[];assert.equal(ui.blocksNavigation(),false);
 ui.routeOpening=true;assert.equal(ui.blocksNavigation(),true);assert.equal(ui.blocksNavigation(false),false);
});
test('hand mode during released direct writes preserves the author owner and bypasses draft flush',async()=>{
 let flushed=0,synced=0;
 const ui=Object.assign(atlasFixture(CampaignAtlasWorkbench),{
  root:{dataset:{family:'terrain'}},landscape:{livePainting:true,blocksNavigation:()=>false,setActive(active){assert.equal(active,false);}},camera:{redrawOverlay(){}},
  flush:async()=>{flushed++;return false;},layout:{sync(){synced++;}},
 });
 await ui.setNavigationMode(true);assert.equal(ui.root.dataset.panMode,'true');assert.equal(ui.root.dataset.family,'terrain');
 assert.equal(flushed,0);assert.equal(synced,1);
 ui.landscape.blocksNavigation=()=>true;await ui.setNavigationMode(true);assert.equal(flushed,1);
});
test('external refresh requests cannot read the full Atlas in the middle of a direct gesture',async()=>{
 const ui=Object.assign(atlasFixture(CampaignAtlasWorkbench),{landscape:{livePainting:true},terrainPresentation:{}});
 assert.equal(await ui.refresh(),false);
 assert.equal(await ui.refresh(true),false);
});
test('save-state rendering retains the GPU brush scene until the gesture finishes',()=>{
 const seen=[],sceneReached=Error('ordinary scene path');
 const ui=Object.assign(Object.assign(atlasFixture(CampaignAtlasWorkbench),{projection:{revision:10}}),{
  root:{hidden:false},owner:{token:'t'},landscape:{livePainting:true},terrainPresentation:{},spatial:{active:true},
  syncBrushSizes(){assert.fail('save-state updates must defer radius measurement to the shared frame');},renderPanel(){seen.push('panel');},renderTravel(){seen.push('travel');},
  layout:{sync(){seen.push('layout');}},territories:{sync(){seen.push('territories');}},
  camera:{redrawOverlay(){seen.push('overlay');},get view(){throw sceneReached;}},
 });
 ui.render();assert.deepEqual(seen,['overlay']);
ui.landscape.livePainting=false;assert.throws(()=>ui.render(),e=>e===sceneReached,'ordinary edits must rebuild');
});
test('commits advance author identity without relabelling the Atlas or awaiting display; finish refreshes once',async t=>{
 const old={document:global.document,window:global.window,CustomEvent:global.CustomEvent},status={dataset:{}},shown=[];
 global.CustomEvent=class extends Event {constructor(name,options){super(name);this.detail=options.detail;}};
 global.document={getElementById:()=>status,dispatchEvent(){}};
 let writes=0,refreshes=0,finishes=0;
 global.window={campaign:{executeAtlasCommit:async c=>({ok:true,value:{commandId:c.commandId,campaignId:'c',revision:++writes+10,sourceFence:'f'+writes,canUndo:true,canRedo:false}})}};
 t.after(()=>Object.assign(global,old));
 const references=atlasAuthorReferenceFixture(t);references.bind(global.window.campaign);
 const atlas={revision:10,workspace:references.workspace,region:{revision:10,fence:'original'}},owner=references.workspace;
 const ui=Object.assign(Object.assign(atlasFixture(CampaignAtlasWorkbench),{projection:atlas}),{
   owner,projection:atlas,svg:{dataset:{}},busy:false,opts:{status(){}},playback:{stop(){}},render(){},
   terrainPresentation:{update:s=>shown.push(s),async finish(){finishes++;},stop(){}},spatial:{gesture(){},pauseReads(){}},
   async refresh(){refreshes++;},error:e=>{throw e;},
 });
 const action={kind:'landscape-height-stroke',stroke:{}};
 const first=await ui.write(action,false,true,{id:'g',expectedRevision:10,sourceFence:'original'});
 assert.equal(first.ack.revision,11);assert.equal(ui.data,atlas);assert.equal(ui.data.region.revision,10);assert.equal(refreshes,0);
 const second=await ui.write(action,false,true,{id:'g',expectedRevision:11,sourceFence:'f1'});
 assert.equal(second.ack.revision,12);assert.deepEqual(ui.regions.authorSource,{revision:12,fence:'f2'});
 assert.equal(ui.data.revision,10);assert.equal(ui.busy,false);
 ui.spatial.active=true;ui.spatial.reconcile=(revision,fence)=>shown.push({revision,fence});ui.strokeOwner=owner.token;ui.strokeQueue={pending:false,failed:false,confirmedSource:{expectedRevision:12,sourceFence:'f2'}};
 await ui.terrainGesture(false);assert.deepEqual(shown,[{revision:12,fence:'f2'}]);assert.equal(refreshes,1);
});

test('a failed final display refresh releases the brush lock and preserves the saved-prefix status',async()=>{
 const errors=[],messages=[],locks=[];let redraws=0;
 const ui=Object.assign(landscapeFixture(LandscapeWorkbench),{
  token:'finish-test',live:{hasCommittedChanges:true,async finish(){}},saving:false,points:[{x:0,y:0}],brushStrokes:[],
  endLiveInput(){},sampleLive(){},clearMask(){},disable:value=>locks.push(value),say:text=>messages.push(text),
  host:{terrainGesture:async()=>{throw Error('Anzeige nicht erreichbar');},error:e=>errors.push(e.message),redraw(){redraws++;}},
 });
 await ui.finishLive();
 assert.equal(ui.livePainting,false);assert.equal(ui.saving,false);assert.deepEqual(ui.points,[]);assert.deepEqual(locks,[false]);
 assert.deepEqual(errors,['Anzeige nicht erreichbar']);assert.match(messages[0],/Gespeicherte Änderungen bleiben/);assert.equal(redraws,1);
});
