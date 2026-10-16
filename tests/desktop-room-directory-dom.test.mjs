import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {parseHTML} from 'linkedom';
buildSync({entryPoints:['src/app/room-directory-ui.ts'],outfile:'.build/room-directory-dom.cjs',bundle:true,platform:'node',format:'cjs'});
const require=createRequire(import.meta.url),{RoomDirectoryView}=require('../.build/room-directory-dom.cjs');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const entry=(id)=>({id,name:id,number:id,revision:0,scopeId:'local',floorId:'ground'});
function setup(){const {document}=parseHTML('<main id="list"></main>'),root=document.getElementById('list'),calls=[],opens=[],api={roomDirectory:(token,q)=>new Promise(resolve=>calls.push({token,q,resolve})),cancelRoomDirectory:async()=>({ok:true})};return{root,calls,opens,view:new RoomDirectoryView(root,id=>opens.push(id),api)};}
const response=(call,items,next=null)=>call.resolve({ok:true,value:{token:call.token,campaignId:'c',items,total:81,unreadable:0,next}});
test('directory discards late A to B to A responses by request identity, not only token',async()=>{
 const x=setup();x.view.context('A','',null);x.view.context('B','',null);x.view.context('A','',null);
 response(x.calls[2],[entry('latest')]);await turn();response(x.calls[0],[entry('stale')]);response(x.calls[1],[entry('foreign')]);await turn();
 assert.match(x.root.textContent,/latest/);assert(!x.root.textContent.includes('stale'));assert(!x.root.textContent.includes('foreign'));
});
test('page continuation is explicit; invalidated cursor gives one manual refresh, no retry loop',async()=>{
 const x=setup();x.view.context('A','',null);const cursor={token:'A',fence:'0',text:'',after:{number:'40',id:'40'}};response(x.calls[0],[entry('40')],cursor);await turn();x.root.querySelector('#rooms-more').click();assert.deepEqual(x.calls[1].q.cursor,cursor);
 x.calls[1].resolve({ok:false,error:'Raumsuche inzwischen geändert.'});await turn();assert.match(x.root.textContent,/inzwischen/);assert.equal(x.calls.length,2);x.root.querySelector('button').click();assert.equal(x.calls.length,3);assert.equal(x.calls[2].q.cursor,undefined);
 response(x.calls[2],[entry('last')]);await turn();x.root.querySelector('button').click();assert.deepEqual(x.opens,['last']);
});
test('a new Markdown query replaces the previous request without bringing text into list entries',async()=>{
 const x=setup();x.view.context('A','GM Geheimtext',null);x.view.context('A','andere Spur',null);assert.equal(x.calls[0].q.text,'GM Geheimtext');response(x.calls[1],[entry('81')]);await turn();response(x.calls[0],[entry('wrong')]);await turn();assert.match(x.root.textContent,/81/);assert(!x.root.textContent.includes('wrong'));assert(!x.root.textContent.includes('Geheimtext'));
});
test('selection redraw retains search completeness and unreadable-text feedback',async()=>{
 const x=setup();x.view.context('A','Spur',null);
 x.calls[0].resolve({ok:true,value:{token:'A',campaignId:'c',items:[entry('1')],total:81,unreadable:2,next:null}});await turn();
 x.view.context('A','Spur','1');
 assert.match(x.root.textContent,/1 von 81 Räumen angezeigt/);
 assert.match(x.root.textContent,/2 Raumtexte konnten nicht durchsucht werden/);
 assert.equal(x.calls.length,1);assert.equal(x.root.querySelector('button').getAttribute('aria-pressed'),'true');
});

buildSync({entryPoints:['src/app/atlas-landscape-ui.ts'],outfile:'.build/room-landscape-dom.cjs',bundle:true,platform:'node',format:'cjs'});
const {LandscapeWorkbench}=require('../.build/room-landscape-dom.cjs');
test('a confirmed room revision retires old raster failures and waits for the matching map snapshot',async t=>{
 const {document}=parseHTML('<select id="land-object"></select><button id="land-reload"></button>'),old={window:globalThis.window,document:globalThis.document,Option:globalThis.Option};let resolveImage,regions=0,images=0;const errors=[],box={x:0,y:0,width:10,height:10},data={revision:0};
 Object.defineProperty(document.getElementById('land-object'),'value',{value:'',writable:true});
 globalThis.document=document;globalThis.Option=function(text,value){const o=document.createElement('option');o.textContent=text;o.value=value;return o;};globalThis.window={campaign:{landscapeRegion:async()=>{regions++;return{ok:true,value:{revision:data.revision,records:[]}};},landscapeRaster:()=>{images++;return new Promise(resolve=>resolveImage=resolve);}}};t.after(()=>Object.assign(globalThis,old));
 const view=Object.create(LandscapeWorkbench.prototype);Object.assign(view,{token:'A',request:0,key:'',minimumRevision:0,assets:new Map(),records:[],svg:{clientWidth:100},host:{box:()=>box,data:()=>data,error:e=>errors.push(e),redraw:()=>{}}});
 const before=view.load();await turn();assert.equal(images,1);view.invalidate(1);resolveImage({ok:false,error:'Atlasstand inzwischen geändert.'});await before;assert.deepEqual(errors,[]);
 await view.load();assert.equal(regions,1,'the old map must not start a new raster');data.revision=1;const after=view.load();await turn();resolveImage({ok:true,value:{revision:1,box,width:100,height:100,data:'data:image/png;base64,AA=='}});await after;assert.equal(view.raster.revision,1);assert.equal(regions,2);assert.deepEqual(errors,[]);
});
test('confirmed edits refresh the same directory once and replace stale matches without losing selection',async()=>{
 const x=setup();x.view.context('A','Spur','1');response(x.calls[0],[entry('1')]);await turn();
 x.view.context('A','Spur','1',[],true);assert.equal(x.calls.length,2);assert.equal(x.calls[1].q.cursor,undefined);response(x.calls[1],[{...entry('1'),name:'Neue Spur',revision:1}]);await turn();
 assert.match(x.root.textContent,/Neue Spur/);assert.equal(x.root.querySelector('button').getAttribute('aria-pressed'),'true');
 x.view.context('A','Spur','1');assert.equal(x.calls.length,2,'selection alone retains the loaded page');
 x.view.context('A','Spur','1',[],true);assert.equal(x.calls.length,3);response(x.calls[2],[]);await turn();assert.equal(x.root.querySelector('button'),null);
 x.view.context('A','Spur','1',[],true);assert.equal(x.calls.length,4,'an empty result has one intentional refresh');response(x.calls[3],[entry('2')]);await turn();assert.match(x.root.textContent,/2\. 2/);
 x.view.context('B','Spur',null,[],true);assert.equal(x.calls.length,5,'a new context and explicit refresh share one request');response(x.calls[4],[entry('3')]);await turn();assert.match(x.root.textContent,/3\. 3/);
});
