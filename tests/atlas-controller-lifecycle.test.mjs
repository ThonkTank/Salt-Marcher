import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {parseHTML} from './helpers/dom.mjs';

await build({stdin:{contents:`export {AtlasRegions} from './src/app/atlas-regions';
export {AtlasOutput} from './src/app/atlas-output';
export {LandscapeRoutes} from './src/app/landscape-routes';`,resolveDir:process.cwd()},
 outfile:'.build/atlas-controller-lifecycle.cjs',bundle:true,platform:'node',format:'cjs',
 plugins:[{name:'controlled-route-session',setup(build){build.onLoad({filter:/\/terrain-route-ui\.ts$/},()=>({contents:'export const openTerrainRoute = options => globalThis.openTestRoute(options);',loader:'ts'}));}}]});
const {AtlasRegions,AtlasOutput,LandscapeRoutes}=createRequire(import.meta.url)('../.build/atlas-controller-lifecycle.cjs');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
function dom(t,extra=''){
 const previous={document:global.document,window:global.window,openTestRoute:global.openTestRoute};
 const {document,window}=parseHTML('<p id="atlas-save-status"></p>'+extra);
 Object.assign(global,{document,window});t.after(()=>Object.assign(global,previous));
 return{document,window};
}

test('hiding a region owner cancels its read lane and rejects a late first surface',async t=>{
 const {window}=dom(t),read=deferred(),cancelled=[],published=[];
 const owner={token:'old'};
 window.campaign={atlasTerrainSource:()=>read.promise,cancelAtlasRegion:token=>cancelled.push(token)};
 const regions=new AtlasRegions({owner,root:{hidden:false},spatial:{needsTerrainRaster:false,openSurface:(...args)=>published.push(args)},camera:{view:{}},landscape:{contours:()=>0}});
 const pending=regions.openTerrain(owner);
 regions.regionTimer=setTimeout(()=>assert.fail('cancelled read timer fired'),25);
 regions.loadedRegionQuery={};regions.regionReading=1;regions.regionReadingQuery={};
 regions.cancel();
 read.resolve({ok:true,value:{revision:4}});await pending;
 assert.deepEqual(cancelled,['old']);assert.deepEqual(published,[]);
 assert.equal(regions.regionTimer,null);assert.equal(regions.loadedRegionQuery,null);
 assert.equal(regions.regionReading,null);assert.equal(regions.regionReadingQuery,null);
 assert.equal(regions.openingSurface,null);
});

test('closing an output owner cancels only its export lane and retains the session cancellation',t=>{
 const {window}=dom(t),cancelled=[];
 window.campaign={cancelAtlasRegion:(...args)=>cancelled.push(args)};
 const output=new AtlasOutput({owner:{token:'campaign'}}),session={cancelled:false};
 output.outputRun=session;output.cancel();
 assert.equal(session.cancelled,true);assert.equal(output.outputRun,session);
 assert.deepEqual(cancelled,[['campaign','export']]);
});

test('A–B–A region activation rejects both retired replies even when A reuses its owner object',async t=>{
 const {window,document}=dom(t,'<p id="atlas-hint"></p><button id="atlas-region-retry"></button>'),reads=[],cancelled=[],errors=[],loads=[];
 const a={token:'a'},b={token:'b'},root=document.createElement('section'),canvas=document.createElement('canvas');
 const host={owner:a,root,canvas,invalidateHits(){},landscape:{load:async()=>loads.push('load')},
  journey:{travelReadState:'ready',previewRequest:0,localPreview:null,playback:{stop(){}},renderTravel(){}},
  render(){},error:e=>errors.push(e),opts:{status(){}}};
 window.campaign={cancelAtlasRegion:token=>cancelled.push(token),atlasRegion:token=>{const read=deferred();reads.push({...read,token});return read.promise;}};
 const regions=new AtlasRegions(host),q={box:{x:0,y:0,width:10,height:10},width:100,height:100,scopeId:null,floorId:'ground',terrainRaster:false};
 regions.regionQuery=()=>q;
 const first=regions.refresh();regions.cancel();host.owner=b;
 const second=regions.refresh();regions.cancel();host.owner=a;
 const current=regions.refresh(),request=regions.request;
 const reply=revision=>({ok:true,value:{workspace:{rooms:[]},geometry:{drawing:{elements:[],hiddenRooms:[]}},region:{revision,coverage:{mode:'detail',unreadable:0}}}});
 reads[0].resolve(reply(1));await first;reads[1].resolve(reply(2));await second;
 assert.deepEqual(reads.map(r=>r.token),['a','b','a']);assert.deepEqual(cancelled,['a','b']);
 assert.equal(regions.data,null);assert.equal(regions.regionReading,request);assert.equal(root.dataset.regionState,'loading');assert.deepEqual(loads,[]);
 reads[2].resolve(reply(9));await current;
 assert.equal(regions.data.region.revision,9);assert.equal(canvas.dataset.atlasRegionRevision,'9');
 assert.equal(root.dataset.regionState,'ready');assert.equal(regions.regionReading,null);assert.deepEqual(loads,['load']);assert.deepEqual(errors,[]);
});

test('an old route completion and close cannot clear the next route session or preview',async t=>{
 dom(t);const opened=[];
 global.openTestRoute=options=>{const ready=deferred(),session={ready:ready.promise,close(){options.closed();},gesturing:()=>false};opened.push({options,ready,session});return session;};
 const routes=new LandscapeRoutes({tool:'road',hasDraft:()=>false,say(){},selected:null,selectionRecords:new Map(),inspectorRoot:{replaceChildren(){}},effects:{planning(){},box:()=>({}),redraw(){}},token:'first',panel:{},canvas:{},point:e=>e,hit:()=>null,spacePan:false,commit:async()=>{}});
 const first=routes.openRoute();routes.close();const second=routes.openRoute();
 const current=opened[1];current.options.preview([{id:'new'}],[{x:1,y:2}]);
 opened[0].options.preview([{id:'old'}],[]);opened[0].options.closed();opened[0].ready.resolve();await first;
 assert.equal(routes.routeSession,current.session);assert.equal(routes.routeOpening,true);
 assert.deepEqual(routes.routeRecords,[{id:'new'}]);assert.deepEqual(routes.routeAnchors,[{x:1,y:2}]);
 current.ready.resolve();await second;assert.equal(routes.routeOpening,false);
 routes.close();assert.equal(routes.routeSession,undefined);assert.equal(routes.routeRecords,undefined);assert.deepEqual(routes.routeAnchors,[]);
});
