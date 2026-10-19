import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/atlas-tool-catalog';export {AtlasWorkspaceLayout} from './src/app/atlas-workspace-layout';",resolveDir:process.cwd()},outfile:'.build/atlas-tool-hierarchy.cjs',bundle:true,platform:'node',format:'cjs'});
const {atlasToolGroups,availableAtlasGroups,atlasToolMatches,AtlasWorkspaceLayout}=require('../.build/atlas-tool-hierarchy.cjs');
function fixture(t){
 const {window,document}=parseHTML(readFileSync('src/app/index.html','utf8'));
 const original={document:global.document,Event:global.Event};global.document=document;global.Event=window.Event;t.after(()=>Object.assign(global,original));
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.getAttribute('data-value')??this.querySelector('option')?.value??'';},set(value){this.setAttribute('data-value',value);}});
 // Use the domain-owned form markup so a new native tool cannot disappear from the hierarchy unnoticed.
 for(const [file,pattern]of [['atlas-landscape-ui.ts',/this\.panel\.innerHTML = `([^`]+)`/],['landscape-tool-settings.ts',/this\.brushRoot\.innerHTML=`([^`]+)`/]]){
  const holder=document.createElement('div');holder.innerHTML=readFileSync('src/app/'+file,'utf8').match(pattern)[1];document.body.append(holder);
 }
 const root=document.createElement('section');document.body.append(root);
 const element=()=>document.createElement('div'),panels=[],calls=[];let allowed=true,release=null;
 const layout=Object.assign(Object.create(AtlasWorkspaceLayout.prototype),{root,family:'terrain',groupMemory:new Map(),toolMemory:new Map(),changingTool:false,groups:element(),toolList:element(),sectionSelect:document.createElement('select'),sync(){},showToolSettings(){},async requestContext(kind){panels.push(kind);},async openGeneration(){panels.push('generation');}});
 layout.host={error(error){throw error;},async tool(section,id,value,settings){calls.push({section,id,value,settings});if(release)await new Promise(r=>release=r);if(!allowed)return false;layout.family=section;document.getElementById(id).value=value;for(const [key,v]of Object.entries(settings??{}))document.getElementById(key).value=v;return true;}};
 return {layout,document,root,panels,calls,allow(v){allowed=v;},defer(){release=true;},release(){release();release=null;}};
}
test('every native tool has a route, with selection and measuring kept global',t=>{
 const {document}=fixture(t);
 for(const [section,id]of [['terrain','land-tool'],['city','city-tool'],['interior','drawing-tool']]){
  const groups=availableAtlasGroups(document,section),routes=new Set(groups.flatMap(g=>g.tools.map(t=>t.value)));
  for(const option of document.getElementById(id).options)assert(routes.has(option.value)||['select','measure'].includes(option.value),section+': '+option.value);
  assert(groups.every(g=>g.tools.length));assert(!groups.some(g=>g.tools.some(t=>t.value==='measure')));
 }
 assert.deepEqual(availableAtlasGroups(document,'terrain').map(g=>g.label),['Land','Wasser','Wege & Flächen','Objekte']);
 assert.equal(availableAtlasGroups(document,'city').some(g=>g.id==='objects'),false);
});
test('switching to a different group recalls its last tool; rejected switches preserve both memories and controls',async t=>{
 const x=fixture(t),water=availableAtlasGroups(x.document,'terrain').find(g=>g.id==='water'),river=water.tools.find(t=>t.id==='river'),land=availableAtlasGroups(x.document,'terrain')[0];
 await x.layout.activateTool('terrain','water',river);assert.equal(x.layout.groupMemory.get('terrain'),'water');
 await x.layout.chooseGroup('terrain',land);assert.equal(x.document.getElementById('land-tool').value,'paint');
 await x.layout.chooseGroup('terrain',water);assert.equal(x.document.getElementById('land-tool').value,'river');
 x.allow(false);await x.layout.chooseGroup('terrain',land);assert.equal(x.layout.groupMemory.get('terrain'),'water');assert.equal(x.document.getElementById('land-tool').value,'river');assert.equal(x.layout.changingTool,false);
});
test('section return restores the last group and tool without disturbing option values',async t=>{
 const x=fixture(t),water=availableAtlasGroups(x.document,'terrain')[1];await x.layout.activateTool('terrain','water',water.tools.find(t=>t.id==='river'));
 x.document.getElementById('land-width').value='31';await x.layout.chooseSection('city');assert.equal(x.layout.family,'city');await x.layout.chooseSection('terrain');assert.equal(x.layout.family,'terrain');assert.equal(x.layout.groupMemory.get('terrain'),'water');assert.equal(x.document.getElementById('land-tool').value,'river');assert.equal(x.document.getElementById('land-width').value,'31');
});
test('land/water color and add/erase routes apply their complete operation only after acceptance',async t=>{
 const x=fixture(t),groups=availableAtlasGroups(x.document,'terrain'),tools=groups.flatMap(g=>g.tools);
 for(const id of ['land-add','land-erase','land-color','land-color-erase','water-add','water-erase','water-color','water-color-erase']){
  const entry=tools.find(t=>t.id===id),group=groups.find(g=>g.tools.includes(entry));await x.layout.activateTool('terrain',group.id,entry);assert(atlasToolMatches(x.document,entry));assert.equal(tools.filter(t=>atlasToolMatches(x.document,t)).length,1);
 }
 const old=x.document.getElementById('land-color-target').value;x.allow(false);await x.layout.activateTool('terrain','land',tools.find(t=>t.id==='land-color'));assert.equal(x.document.getElementById('land-color-target').value,old);
});
test('only an accepted explicit tool action opens a library; repeated render does not reopen it',async t=>{
 const x=fixture(t),entry=atlasToolGroups.interior.find(g=>g.id==='objects').tools[0];x.allow(false);await x.layout.activateTool('interior','objects',entry);assert.deepEqual(x.panels,[]);
 x.allow(true);await x.layout.activateTool('interior','objects',entry);assert.deepEqual(x.panels,['library']);x.layout.renderGroups();x.layout.renderGroups();assert.deepEqual(x.panels,['library']);
 await x.layout.activateTool('interior','objects',entry);assert.deepEqual(x.panels,['library','library']);
});
test('a second click cannot race a pending section change',async t=>{
 const x=fixture(t);x.defer();const pending=x.layout.chooseSection('city');await x.layout.chooseSection('interior');assert.equal(x.calls.length,1);x.release();await pending;assert.equal(x.layout.family,'city');assert.equal(x.layout.changingTool,false);
});
