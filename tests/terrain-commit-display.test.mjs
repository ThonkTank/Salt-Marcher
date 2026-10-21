import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({stdin:{contents:"export * from './src/app/campaign-atlas-ui';export * from './src/app/atlas-landscape-ui';",resolveDir:process.cwd()},outfile:'.build/terrain-commit-display-test.cjs',bundle:true,platform:'node',format:'cjs',external:['obsidian']});
const {CampaignAtlasWorkbench,LandscapeWorkbench}=createRequire(import.meta.url)('../.build/terrain-commit-display-test.cjs');
test('external refresh requests cannot read the full Atlas in the middle of a direct gesture',async()=>{
 const ui=Object.assign(Object.create(CampaignAtlasWorkbench.prototype),{landscape:{livePainting:true},terrainPresentation:{}});
 assert.equal(await ui.refresh(),false);
 assert.equal(await ui.refresh(true),false);
});
test('commits advance author identity without relabelling the Atlas or awaiting display; finish refreshes once',async t=>{
 const old={document:global.document,window:global.window,CustomEvent:global.CustomEvent},status={dataset:{}},shown=[];
 global.CustomEvent=class extends Event {constructor(name,options){super(name);this.detail=options.detail;}};
 global.document={getElementById:()=>status,dispatchEvent(){}};
 let writes=0,refreshes=0;
 global.window={campaign:{executeAtlasCommit:async c=>({ok:true,value:{commandId:c.commandId,campaignId:'c',revision:++writes+10,sourceFence:'f'+writes,canUndo:true,canRedo:false}})}};
 t.after(()=>Object.assign(global,old));
 const atlas={revision:10,region:{revision:10,fence:'original'}},owner={token:'token',campaign:{id:'c'}};
 const ui=Object.assign(Object.defineProperty(Object.create(CampaignAtlasWorkbench.prototype),'data',{value:atlas,writable:true}),{
   owner,data:atlas,svg:{dataset:{}},busy:false,opts:{status(){}},playback:{stop(){}},render(){},
   terrainPresentation:{update:s=>shown.push(s),stop(){}},spatial:{gesture(){}},
   async refresh(){refreshes++;},error:e=>{throw e;},
 });
 const action={kind:'landscape-height-stroke',stroke:{}};
 const first=await ui.write(action,false,true,{id:'g',expectedRevision:10,sourceFence:'original'});
 assert.equal(first.ack.revision,11);assert.equal(ui.data,atlas);assert.equal(ui.data.region.revision,10);assert.equal(refreshes,0);
 const second=await ui.write(action,false,true,{id:'g',expectedRevision:11,sourceFence:'f1'});
 assert.equal(second.ack.revision,12);assert.deepEqual(shown,[{revision:11,fence:'f1'},{revision:12,fence:'f2'}]);
 assert.equal(ui.data.revision,10);assert.equal(ui.busy,false);
 await ui.terrainGesture(false);assert.equal(refreshes,1);assert.equal(ui.terrainPresentation,null);
});

test('a failed final display refresh releases the brush lock and preserves the saved-prefix status',async()=>{
 const errors=[],messages=[],locks=[];let redraws=0;
 const ui=Object.assign(Object.create(LandscapeWorkbench.prototype),{
  token:'finish-test',live:{hasCommittedChanges:true,async finish(){}},saving:false,points:[{x:0,y:0}],brushStrokes:[],
  endLiveInput(){},sampleLive(){},clearMask(){},disable:value=>locks.push(value),say:text=>messages.push(text),
  host:{terrainGesture:async()=>{throw Error('Anzeige nicht erreichbar');},error:e=>errors.push(e.message),redraw(){redraws++;}},
 });
 await ui.finishLive();
 assert.equal(ui.livePainting,false);assert.equal(ui.saving,false);assert.deepEqual(ui.points,[]);assert.deepEqual(locks,[false]);
 assert.deepEqual(errors,['Anzeige nicht erreichbar']);assert.match(messages[0],/Gespeicherte Änderungen bleiben/);assert.equal(redraws,1);
});
