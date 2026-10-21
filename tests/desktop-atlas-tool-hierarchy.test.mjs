import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from './helpers/dom.mjs';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/atlas-tool-catalog';export {BrushSizeControl} from './src/app/atlas-brush-size';export {LandscapeToolSettings} from './src/app/landscape-tool-settings';export {AtlasWorkspaceLayout} from './src/app/atlas-workspace-layout';export {CampaignAtlasWorkbench} from './src/app/campaign-atlas-ui';",resolveDir:process.cwd()},outfile:'.build/atlas-tool-hierarchy.cjs',bundle:true,platform:'node',format:'cjs'});
const {BrushSizeControl,LandscapeToolSettings,atlasToolGroups,availableAtlasGroups,atlasToolMatches,AtlasWorkspaceLayout,CampaignAtlasWorkbench}=require('../.build/atlas-tool-hierarchy.cjs');
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
test('every native tool has a route, with global selection and a dedicated vegetation filter',t=>{
 const {document}=fixture(t);
 for(const [section,id]of [['terrain','land-tool'],['city','city-tool'],['interior','drawing-tool']]){
  const groups=availableAtlasGroups(document,section),routes=new Set(groups.flatMap(g=>g.tools.map(t=>t.value)));
  for(const option of document.getElementById(id).options)assert(routes.has(option.value)||['select','measure'].includes(option.value),section+': '+option.value);
  assert(groups.every(g=>g.tools.length));assert(!groups.some(g=>g.tools.some(t=>t.value==='measure')));
 }
 assert.deepEqual(availableAtlasGroups(document,'terrain').map(g=>g.label),['Land','Bewuchs & Felsen','Geländedaten','Wasser','Wege & Flächen','Objekte']);
 assert(availableAtlasGroups(document,'terrain').find(g=>g.id==='vegetation').tools.some(t=>t.id==='vegetation-select'&&t.value==='select'));
 assert.deepEqual(availableAtlasGroups(document,'terrain')[0].tools.map(t=>t.label),['Land formen','Land bemalen','Glätten']);
 assert.equal(availableAtlasGroups(document,'city').some(g=>g.id==='objects'),false);
});
test('switching to a different group recalls its last tool; rejected switches preserve both memories and controls',async t=>{
 const x=fixture(t),water=availableAtlasGroups(x.document,'terrain').find(g=>g.id==='water'),river=water.tools.find(t=>t.id==='river'),land=availableAtlasGroups(x.document,'terrain')[0];
 await x.layout.activateTool('terrain','water',river);assert.equal(x.layout.groupMemory.get('terrain'),'water');
 await x.layout.chooseGroup('terrain',land);assert.equal(x.document.getElementById('land-tool').value,'height');
 await x.layout.chooseGroup('terrain',water);assert.equal(x.document.getElementById('land-tool').value,'river');
 x.allow(false);await x.layout.chooseGroup('terrain',land);assert.equal(x.layout.groupMemory.get('terrain'),'water');assert.equal(x.document.getElementById('land-tool').value,'river');assert.equal(x.layout.changingTool,false);
});
test('section return restores the last group and tool without disturbing option values',async t=>{
 const x=fixture(t),water=availableAtlasGroups(x.document,'terrain').find(g=>g.id==='water');await x.layout.activateTool('terrain','water',water.tools.find(t=>t.id==='river'));
 x.document.getElementById('land-width').value='31';await x.layout.chooseSection('city');assert.equal(x.layout.family,'city');await x.layout.chooseSection('terrain');assert.equal(x.layout.family,'terrain');assert.equal(x.layout.groupMemory.get('terrain'),'water');assert.equal(x.document.getElementById('land-tool').value,'river');assert.equal(x.document.getElementById('land-width').value,'31');
});
test('three land tools and water routes apply their complete operation only after acceptance',async t=>{
 const x=fixture(t),groups=availableAtlasGroups(x.document,'terrain'),tools=groups.flatMap(g=>g.tools);
 for(const id of ['land-shape','land-smooth','land-color','water-add','water-erase','water-color','water-color-erase']){
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

test('global Dungeon selection reaches the existing author tool and respects a rejected switch',async t=>{
 const x=fixture(t),navigation=[];x.layout.host.navigation=async pan=>navigation.push(pan);x.layout.family='interior';x.document.getElementById('drawing-tool').value='door';
 await x.layout.select();assert.equal(x.document.getElementById('drawing-tool').value,'select');assert.deepEqual(x.calls,[{section:'interior',id:'drawing-tool',value:'select',settings:undefined}]);assert.deepEqual(navigation,[]);
 x.document.getElementById('drawing-tool').value='door';x.allow(false);await x.layout.select();assert.equal(x.document.getElementById('drawing-tool').value,'door');assert.equal(x.layout.changingTool,false);
 for(const section of ['terrain','city']){x.layout.family=section;await x.layout.select();}assert.deepEqual(navigation,[false,false]);assert.equal(x.calls.length,2);
});

test('the real family switch releases an idle rectangle cursor but preserves a started rectangle and a rejected flush',async t=>{
 const {document,root}=fixture(t);for(const id of ['atlas-families','atlas-tool-fields']){const node=document.createElement('div');node.id=id;root.append(node);}
 const statuses=[],events=[],layoutStates=[];let allow=true;
 const editor=Object.assign(Object.create(CampaignAtlasWorkbench.prototype),{root,territories:{hasDraft:()=>false},family:'interior',draft:[],roomDrag:null,camera:{stopZoom(){}},reference:{active:false},opts:{flush:async()=>allow,status:message=>statuses.push(message)},landscape:{hasDraft:()=>false,setActive:value=>events.push(value)},layout:{beforeTool(){},setFamily:family=>layoutStates.push([family,root.dataset.family])},dockDrawingTools(){},render(){},scheduleRegion(){}});
 root.dataset.roomDraw='true';await editor.setFamily('navigation');assert.equal(root.dataset.roomDraw,'false');assert.equal(editor.family,'navigation');
 root.dataset.roomDraw='true';editor.draft=[{x:1,y:2}];await editor.setFamily('city');assert.equal(root.dataset.roomDraw,'true');assert.equal(editor.family,'navigation');assert.deepEqual(editor.draft,[{x:1,y:2}]);assert.equal(statuses.length,1);
 editor.draft=[];allow=false;await editor.setFamily('city');assert.equal(root.dataset.roomDraw,'true');assert.equal(editor.family,'navigation');
 allow=true;await editor.setFamily('city');assert.equal(root.dataset.roomDraw,'false');assert.equal(editor.family,'city');assert.equal(events.length,2);
 assert.deepEqual(layoutStates,[['navigation','navigation'],['city','city']],'layout observes the accepted family, never a stale mode that can change the remembered group');
});


test('a room created while drawing records its selection without opening an obstructing inspector',t=>{
 const {layout}=fixture(t),opened=[];layout.openSelection=()=>opened.push(layout.selectionKey);
 layout.selectionChanged('room:Torhalle',false,false);
 layout.selectionChanged('room:Wachstube',false,false);
 assert.deepEqual(opened,[]);assert.equal(layout.selectionKey,'room:Wachstube');
 layout.selectionChanged('room:Wachstube',true);
 assert.deepEqual(opened,['room:Wachstube'],'explicit Details/selection still opens the same room');
 layout.selectionChanged('room:Archiv');assert.deepEqual(opened,['room:Wachstube','room:Archiv']);
});


test('entering rectangle drawing hides existing properties only after the tool switch succeeds',async t=>{
 const {layout,allow}=fixture(t),tool=atlasToolGroups.interior.find(g=>g.id==='rooms').tools[0];
 layout.auxiliary='selection';layout.contextVisible=true;layout.applyWidth=()=>{};
 allow(false);await layout.activateTool('interior','rooms',tool);assert.equal(layout.contextVisible,true);
 allow(true);await layout.activateTool('interior','rooms',tool);assert.equal(layout.contextVisible,false);
 assert.equal(layout.auxiliary,'selection','Details can restore the existing properties');
});

test('land settings retain independent size and strength, optional target and color eraser',t=>{
 const {document}=fixture(t),panel=document.createElement('div');document.body.append(panel);
 panel.innerHTML='<label>Width<input id="land-width"></label><label>Radius<input id="land-radius" value="500"></label>';
 const settings=new LandscapeToolSettings(panel,()=>{}),f=id=>panel.querySelector('#'+id);
 const size=new BrushSizeControl(f('land-radius'),()=>{});t.after(()=>size.dispose());
 const show=tool=>{settings.show(tool);size.sync('test:'+tool,10,false);};
 const radius=pixels=>{f('land-radius-value').value=String(pixels);f('land-radius-value').dispatchEvent(new Event('change'));};
 show('height');assert.equal(settings.height().targetM,undefined);assert.equal(settings.height().mode,'raise');
 radius(80);f('land-height-mode').value='lower';f('land-height-strength').value='750';f('land-coast-roughness').value='1.5';
 f('land-height-target-enabled').checked=true;f('land-height-target').value='-50';show('height');assert.equal(settings.height().targetM,-50);
 f('land-height-direction').querySelector('[data-direction=roughen]').click();assert.equal(settings.height().mode,'roughen');assert.equal(settings.height().targetM,undefined);assert.equal(settings.height().roughness,undefined);assert(f('land-shape-options').hidden);
 f('land-height-direction').querySelector('[data-direction=lower]').click();assert.equal(settings.height().targetM,-50);assert(!f('land-shape-options').hidden);
 show('smooth');assert.equal(f('land-radius').value,'480');assert.equal(settings.height().strength,300);assert.equal(settings.height().mode,'smooth');
 assert.equal(settings.height().targetM,undefined);assert.equal(settings.height().roughness,undefined);assert(f('land-shape-options').hidden);
 radius(15);f('land-height-strength').value='90';show('color');f('land-color-operation').value='erase';assert.equal(settings.mode(),'color-erase');
 show('height');assert.equal(f('land-radius').value,'800');assert.equal(settings.height().strength,750);assert.equal(settings.height().mode,'lower');assert.equal(settings.height().roughness,1.5);assert.equal(settings.height().targetM,-50);
 show('smooth');assert.equal(f('land-radius').value,'150');assert.equal(settings.height().strength,90);
 show('color');assert.equal(settings.mode(),'color-erase');
});


test('a found place selects the generic object context while vegetation retains its dedicated tools',t=>{
 const {layout}=fixture(t),opened=[];layout.openSelection=()=>opened.push(layout.selectionKey);
 layout.groupMemory.set('terrain','vegetation');layout.landscapeSelectionChanged('ferry','place');
 assert.equal(layout.groupMemory.get('terrain'),'objects');assert.equal(layout.toolList.dataset.group,'objects');assert.deepEqual([...layout.toolList.querySelectorAll('button')].map(b=>b.textContent.replace(/\s+/g,' ').trim()),['↖Objekt auswählen','⚑Ort platzieren']);
 assert.deepEqual(opened,['landscape:ferry']);layout.landscapeSelectionChanged('wood','vegetation');assert.equal(layout.groupMemory.get('terrain'),'vegetation');assert.equal(layout.toolList.dataset.group,'vegetation');
});

test('narrow selected-object properties share space with the map and restore the preferred palette on close or resize',t=>{
 const {layout,root,document}=fixture(t);let width=700;Object.defineProperty(root,'clientWidth',{get:()=>width});
 Object.assign(layout,{toolSettings:document.createElement('aside'),secondary:document.createElement('aside'),width:240,detailWidth:340,toolSettingsVisible:true,contextVisible:true,auxiliary:'selection',selectionKey:'path:access'});
 layout.applyWidth();assert.equal(root.dataset.compactSelection,'true');assert.equal(root.style.getPropertyValue('--atlas-left-space'),'48px');assert.equal(root.style.getPropertyValue('--atlas-details-width'),'315px');assert.equal(root.dataset.overlay,'false');assert(layout.toolSettings.hidden);assert(!layout.secondary.hidden);
 width=1400;layout.applyWidth();assert.equal(root.dataset.compactSelection,'false');assert.equal(root.style.getPropertyValue('--atlas-left-space'),'288px');assert.equal(root.style.getPropertyValue('--atlas-details-width'),'340px');assert(!layout.toolSettings.hidden);
 width=700;layout.applyWidth();layout.hideContext();assert(!layout.toolSettings.hidden);assert(layout.secondary.hidden);assert.equal(layout.selectionKey,'path:access');assert.equal(layout.detailWidth,340);assert.equal(layout.width,240);assert(layout.toolSettingsVisible);
});

test('only an accepted explicit tool switch restores tools from compact selection',async t=>{
 const x=fixture(t);Object.defineProperty(x.root,'clientWidth',{get:()=>700});Object.assign(x.layout,{toolSettings:x.document.createElement('aside'),secondary:x.document.createElement('aside'),width:240,detailWidth:340,toolSettingsVisible:true,contextVisible:true,auxiliary:'selection',selectionKey:'path:access'});delete x.layout.showToolSettings;
 x.layout.applyWidth();const wall=atlasToolGroups.interior.find(g=>g.id==='walls').tools[0];x.allow(false);await x.layout.activateTool('interior','walls',wall);assert(x.layout.contextVisible);assert(x.layout.toolSettings.hidden);
 x.allow(true);await x.layout.activateTool('interior','walls',wall);assert(!x.layout.contextVisible);assert(!x.layout.toolSettings.hidden);assert.equal(x.layout.selectionKey,'path:access');
 const heading=x.document.createElement('strong');heading.id='atlas-secondary-title';x.root.append(heading);x.layout.selection=x.document.createElement('section');
 x.layout.openSelection();assert(x.layout.contextVisible);assert(x.layout.toolSettings.hidden);
 x.layout.showPane('tool');assert(x.layout.contextVisible,'ordinary domain redraw must not dismiss selected properties');assert(x.layout.toolSettings.hidden);
});

test('main-camera pose is locked during room, city and output gestures, and released after cancellation',()=>{
 const editor=Object.assign(Object.create(CampaignAtlasWorkbench.prototype),{
  busy:false,landscape:{hasDraft:()=>false},territories:{hasDraft:()=>false},draft:[],brushId:null,
  drag:null,vertexDrag:null,pathDrag:null,roomDrag:null,partyDrag:null,entranceDraft:null,
  placeIntent:null,exportDrag:null,exportCorner:null,
 });
 assert.equal(editor.cameraDraftPending(),false);
 for(const key of ['drag','vertexDrag','pathDrag','roomDrag','partyDrag','entranceDraft','placeIntent','exportDrag','exportCorner']){
  editor[key]={};assert.equal(editor.cameraDraftPending(),true,key);editor[key]=null;
 }
 editor.draft=[{x:1,y:2}];assert.equal(editor.cameraDraftPending(),true);editor.draft=[];
 assert.equal(editor.cameraDraftPending(),false);
});

test('graphics recovery clears only the failure that belongs to the recovered presentation',t=>{
 const {document}=fixture(t),local=document.createElement('p');local.id='atlas-save-status';document.body.append(local);
 const global=document.getElementById('status'),calls=[],workbench=Object.assign(Object.create(CampaignAtlasWorkbench.prototype),{opts:{status(text,error){calls.push({text,error});global.textContent=text;global.dataset.error=String(error);}}});
 for(const [a,b]of [['graphics','graphics'],['write pending','graphics'],['graphics','other failure']]){
  local.textContent=a;global.textContent=b;local.dataset.error=global.dataset.error='true';calls.length=0;
  workbench.recoverPresentation('graphics');
  assert.equal(local.dataset.error,a==='graphics'?'false':'true');assert.equal(global.dataset.error,b==='graphics'?'false':'true');assert.equal(calls.length,b==='graphics'?1:0);
  if(a!=='graphics')assert.equal(local.textContent,a);if(b!=='graphics')assert.equal(global.textContent,b);
 }
});
