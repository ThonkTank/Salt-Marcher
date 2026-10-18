import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {parseHTML} from 'linkedom';
// Real workbench render/author layer. Only the independently owned drawing tool
// is replaced, to supply a draft without mounting its complete inspector.
await build({entryPoints:['src/app/campaign-atlas-ui.ts'],outfile:'.build/atlas-author-overlay.cjs',bundle:true,platform:'node',format:'cjs',plugins:[{name:'drawing-draft',setup(b){b.onLoad({filter:/\/drawing-ui\.ts$/},()=>({loader:'ts',contents:`
export function atlasDrawingDraft(){return globalThis.atlasAuthorDraft;}
export function drawingOverlay(root){globalThis.atlasOverlayCalls++;root.append(globalThis.atlasDraftNode);}
export const selectElement=()=>{},atlasDrawingPoint=p=>globalThis.atlasAuthorPoints.push(p),atlasDrawingScope=()=>{},atlasDrawingUndoPoint=()=>{},reloadDrawing=()=>{};`}));}}]});
const {CampaignAtlasWorkbench}=createRequire(import.meta.url)('../.build/atlas-author-overlay.cjs');
function fixture(t){
 const previous={window:global.window,document:global.document,atlasAuthorDraft:global.atlasAuthorDraft,atlasOverlayCalls:global.atlasOverlayCalls,atlasDraftNode:global.atlasDraftNode,atlasAuthorPoints:global.atlasAuthorPoints};t.after(()=>Object.assign(global,previous));
 const ids=['recover','placement','scale','undo','redo','connect-entrance','local-console','create-tools','create-city','create-dungeon','floor-field','building-interior','selection-title','room-draw'];
 const {window,document}=parseHTML('<html><body>'+ids.map(id=>`<div id="atlas-${id}"></div>`).join('')+'<label><input id="atlas-slice-enabled"></label><label><input id="atlas-slice"></label><label><input id="atlas-roofs"></label><input id="atlas-perception"><select id="atlas-floor"></select><select id="drawing-tool"><option value="room-polygon">Polygon</option></select></body></html>');Object.assign(global,{window,document,atlasAuthorDraft:{floor:{scopeId:'local',floorId:'ground'}},atlasOverlayCalls:0,atlasAuthorPoints:[]});
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.getAttribute('data-value')??this.querySelector('option')?.value??'';},set(value){this.setAttribute('data-value',value);}});
 const original={name:'Autorenraum',number:'1',id:'room',scopeId:'local',floorId:'ground',revision:7,polygons:[{outer:[{x:1,y:2},{x:9,y:2},{x:9,y:8},{x:1,y:8}],holes:[]}]},binding={id:'bind',kind:'dungeon',ownerId:'local',parent:'world',parentId:null,x:-100,y:50,angle:Math.PI/2,revision:0};
 let output,current=true;
 const ui=Object.assign(Object.create(CampaignAtlasWorkbench.prototype),{root:{hidden:false,dataset:{}},svg:{clientWidth:100,dataset:{}},camera:{view:{x:-110,y:40,width:20,height:20},render:draw=>{output={children:[],data:{mapScene:'true'},append(...nodes){this.children.push(...nodes);}};draw(output);}},family:'interior',scopeId:'local',floorId:'ground',selection:{kind:'room',id:'room'},draft:[],landscape:{draw(){}},opts:{roomDraft:()=>original},geometryCurrent:()=>current,selectedBinding:()=>null,renderTravel(){},drawTerrain(){},drawInteriorRuntime(){},drawParty(){}});
 // A raster region intentionally contains no author contours or display rooms.
 Object.defineProperty(ui,'data',{value:{campaignId:'campaign',revision:5,canUndo:true,canRedo:false,cities:[],bindings:[binding],workspace:{rooms:[],floors:[]},entrances:[],terrain:{hexMeters:100},region:{box:{x:-120,y:30,width:40,height:40},raster:{box:{x:-110,y:40,width:20,height:20},data:'raster'},frames:{bind:{x:-100,y:50,angle:Math.PI/2}}},geometry:{position:null,drawing:{styles:[]}}},writable:true});
 global.atlasDraftNode={kind:'polyline',geometry:{points:[{x:2,y:3},{x:4,y:5}]},style:{},data:{editorOnly:'true'},children:[]};
 return{ui,original,document,render(){ui.render();return output;},current(value){current=value;}};
}
const all=node=>[node,...(node.children??[]).flatMap(all)];
test('raster background preserves exact room grips and the open draft above the raster, including rotated negative coordinates',t=>{
 const f=fixture(t),before=structuredClone(f.original),scene=f.render(),author=scene.children.find(n=>n.data.editorOnly==='true');
 assert(author,'the real render path must publish a separate author layer');assert(scene.children.indexOf(author)>scene.children.findIndex(n=>n.kind==='image'));
 assert.deepEqual(author.geometry.matrix,[Math.cos(Math.PI/2),1,-1,Math.cos(Math.PI/2),10,10]);
 const grips=all(author).filter(n=>n.data.atlasVertex!==undefined);assert.equal(grips.length,4);assert.deepEqual(grips.map(n=>({x:n.geometry.x,y:n.geometry.y})),f.original.polygons[0].outer);assert.equal(atlasOverlayCalls,1);assert(author.children.includes(atlasDraftNode));assert.deepEqual(f.original,before);
 f.ui.vertexDrag={room:structuredClone(f.original),polygon:0,vertex:1,point:{x:12,y:4}};const moved=f.render();assert.deepEqual(all(moved).find(n=>n.data.atlasVertex==='1').geometry.x,12);assert.deepEqual(f.original,before,'preview must not mutate the author source');
});
test('loading retains the confirmed scene instead of drawing old data under new filters, and respects confirmed floor/slice/perception context',t=>{
 const f=fixture(t);let scene=f.render();const confirmed=scene;f.current(false);f.document.getElementById('atlas-slice-enabled').checked=true;scene=f.render();assert.equal(scene,confirmed,'loading must retain the complete confirmed scene');assert(all(scene).includes(atlasDraftNode));
 f.current(true);f.document.getElementById('atlas-slice-enabled').checked=true;scene=f.render();assert.equal(all(scene).filter(n=>n.data.atlasVertex!==undefined).length,0);
 f.document.getElementById('atlas-slice-enabled').checked=false;f.ui.floorId='upper';scene=f.render();assert.equal(all(scene).filter(n=>n.data.editorOnly==='true').length,0,'a ground-floor draft must not appear upstairs');
 f.ui.floorId='ground';f.document.getElementById('atlas-perception').checked=true;scene=f.render();assert.equal(all(scene).filter(n=>n.data.editorOnly==='true').length,0,'GM author contours must not overlay party knowledge');
});
test('detail and raster backgrounds share exactly one draft overlay; drawing does not start author reads',t=>{
 const f=fixture(t);window.campaign=new Proxy({},{get(){throw Error('author drawing must not read');}});f.ui.data.region.raster=undefined;f.ui.drawInterior=()=>{};const scene=f.render();assert.equal(atlasOverlayCalls,1);assert.equal(all(scene).filter(n=>n===atlasDraftNode).length,1);
});

for(const [width,height]of [[1200,300],[300,1200]])test(`object focus fits both original extents at ${width}x${height}`,()=>{
 let view;const ui=Object.assign(Object.create(CampaignAtlasWorkbench.prototype),{svg:{clientWidth:width,clientHeight:height},camera:{set:box=>view=box}});
 ui.focus({x:-150,y:75},140,280);
 assert(view.width>=140&&view.height>=280);assert.equal(view.width/view.height,width/height);
 assert.equal(view.x+view.width/2,-150);assert.equal(view.y+view.height/2,75);
});

test('a detailed original retains bounded, exact-index grips instead of rebuilding thousands of overlapping handles',t=>{
 const f=fixture(t);f.original.polygons[0].outer=Array.from({length:10000},(_,i)=>({x:5+4*Math.cos(i/10000*Math.PI*2),y:5+4*Math.sin(i/10000*Math.PI*2)}));
 const before=structuredClone(f.original),scene=f.render(),grips=all(scene).filter(n=>n.data.atlasVertex!==undefined);
 assert(grips.length>1&&grips.length<=1500);for(const grip of grips){const source=f.original.polygons[Number(grip.data.polygon)].outer[Number(grip.data.atlasVertex)];assert.deepEqual({x:grip.geometry.x,y:grip.geometry.y},source);}
 assert.match(scene.children.find(n=>n.data.editorOnly==='true').title,/10000 Eckpunkten.*heranzoomen/);assert.deepEqual(f.original,before);
});

test('close zoom keeps distinct original vertices reachable with constant-pixel grips',t=>{
 const f=fixture(t);f.ui.camera.view={x:-100.02,y:49.98,width:.04,height:.04};f.ui.data.region.box={x:-100.04,y:49.96,width:.08,height:.08};f.original.polygons[0].outer=[{x:0,y:0},{x:.004,y:0},{x:.004,y:.004},{x:0,y:.004}];
 const grips=all(f.render()).filter(n=>n.data.atlasVertex!==undefined);assert.equal(grips.length,4);for(const g of grips)assert.equal(g.geometry.radius/(.04/100),4);
});

test('draft and vertex previews retain background nodes and floor controls; buffered pan rebases them',t=>{
 const f=fixture(t);const first=f.render(),base=first.children.find(n=>n.data.atlasBase==='true'),node=base.children[0];
 const floor=f.document.getElementById('atlas-floor');const sentinel=f.document.createElement('option');floor.append(sentinel);
 f.ui.vertexDrag={room:structuredClone(f.original),polygon:0,vertex:1,point:{x:12,y:4}};
 const moved=f.render();assert.equal(moved.children.find(n=>n.data.atlasBase==='true').children[0],node);assert.equal(floor.firstChild,sentinel,'pointer previews must not rebuild the panel');
 f.ui.camera.view={...f.ui.camera.view,x:-108,y:42};const pan=f.render().children.find(n=>n.data.atlasBase==='true');assert.equal(pan.children[0],node);assert.deepEqual(pan.geometry.matrix,[1,0,0,1,-2,-2]);
 f.ui.floorId='upper';assert.notEqual(f.render().children.find(n=>n.data.atlasBase==='true').children[0],node,'confirmed context changes invalidate background geometry');
});
test('detail preview replaces only its face slot and preserves object painter order',t=>{
 const f=fixture(t);f.ui.data.region.raster=undefined;f.ui.drawInterior=root=>{
  const room={kind:'group',geometry:{},style:{},data:{authorRoomFace:'room'},children:[],append(...n){this.children.push(...n);}};
  root.append(room,{kind:'rect',geometry:{x:1,y:2,width:1,height:1},style:{},data:{id:'glyph'},children:[]});
 };
 const scene=f.render(),base=scene.children.find(n=>n.data.atlasBase==='true').children[0],first=all(base).find(n=>n.kind==='polygons'&&n.data.id==='room');assert(first);assert(all(base).indexOf(first)<all(base).findIndex(n=>n.data.id==='glyph'),'objects must stay above the selected fill');
 f.ui.vertexDrag={room:structuredClone(f.original),polygon:0,vertex:1,point:{x:12,y:4}};const changed=f.render().children.find(n=>n.data.atlasBase==='true').children[0];assert.equal(changed.children[1],base.children[1]);assert.notEqual(all(changed).find(n=>n.kind==='polygons').geometry.polygons,first.geometry.polygons);assert.equal(f.original.polygons[0].outer[1].x,9);
});

test('a polygon tool continues its draft in a dense raster instead of triggering an object read',async t=>{
 const f=fixture(t),errors=[];Object.assign(f.ui,{owner:{token:'t'},loadedRegionQuery:{},entranceDraft:null,point:()=>({x:-103,y:52}),error:e=>errors.push(e),camera:{...f.ui.camera,ready:true,hitAt:()=>null}});
 window.campaign=new Proxy({},{get(){throw Error('A drawing click must not query a raster object');}});await f.ui.click({button:0,altKey:false});assert.deepEqual(errors,[]);assert.equal(atlasAuthorPoints.length,1);assert(Math.abs(atlasAuthorPoints[0].x-2)<1e-8&&Math.abs(atlasAuthorPoints[0].y-3)<1e-8);
});
test('an active point tool owns the press instead of dragging an existing room grip or party marker',t=>{
 const f=fixture(t);Object.assign(f.ui,{entranceDraft:null,camera:{...f.ui.camera,ready:true,hitAt(){throw Error('Point tools must not start semantic drags');}}});
 f.ui.down({button:0,altKey:false,pointerId:1});assert.equal(f.ui.vertexDrag,undefined);assert.equal(f.ui.partyDrag,undefined);
});

test('an object-only interior paints its geometry instead of reducing it to an empty dungeon marker',t=>{
 const f=fixture(t);f.ui.selection=null;f.ui.opts.roomDraft=()=>null;f.ui.data.region.raster=undefined;f.ui.data.region.scopeBounds={local:{x:1,y:2,width:4,height:1}};f.ui.data.geometry.drawing={elements:[{id:'wall',kind:'wall',scopeId:'local',floorId:'ground',archived:false,points:[{x:1,y:2},{x:5,y:2}],color:'#123456',width:.2,height:6}]};
 const scene=f.render(),base=scene.children.find(n=>n.data.atlasBase==='true');assert(all(base).some(n=>n.data.kind==='element'&&n.data.id==='wall'));
});

function rectangleGesture(t){
 const f=fixture(t),writes=[],selected=[],captures=[];
 for(const id of ['atlas-new-name','atlas-draft-cancel','drawing-cancel']){const n=f.document.createElement(id==='atlas-new-name'?'input':'button');n.id=id;f.document.body.append(n);}
 f.document.getElementById('atlas-new-name').value='Zollhaus';
 Object.assign(f.ui,{root:{hidden:false,dataset:{roomDraw:'true'}},brushId:null,roomDrag:null,entranceDraft:null,point:e=>({x:e.clientX,y:e.clientY}),render(){},refresh:async()=>selected.push("refreshed"),write:async a=>{writes.push(a);return{result:{id:'created'}};},opts:{selectRoom:async id=>selected.push(id),status(){}},error:e=>{throw e;}});
 f.ui.camera.ready=true;f.ui.svg.setPointerCapture=id=>captures.push(id);
 const event=(x,y)=>({button:0,pointerId:3,clientX:x,clientY:y,altKey:false});
 return{...f,writes,selected,captures,event};
}
for(const reverse of [false,true])test(`room rectangle drag previews and commits once in a rotated frame (${reverse?'reverse':'forward'})`,async t=>{
 const f=rectangleGesture(t),a=f.event(-100,50),b=f.event(-106,62),[start,end]=reverse?[b,a]:[a,b];
 f.ui.down(start);f.ui.move(end);assert.equal(f.writes.length,0);assert(f.ui.roomDrag.moved);assert.deepEqual(f.captures,[3]);
 await f.ui.up(end);assert.equal(f.writes.length,1);const action=f.writes[0];assert.equal(action.kind,'room-create');assert.equal(action.scopeId,'local');assert.equal(action.floorId,'ground');assert.equal(action.name,'Zollhaus');
 const points=action.polygons[0].outer;assert(Math.abs(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x))-12)<1e-9);assert(Math.abs(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))-6)<1e-9);
 assert.deepEqual(f.selected,['created','refreshed'],'next editing commands must use the frame published after room selection');assert.equal(f.ui.roomDrag,null);assert.equal(f.ui.root.dataset.roomDraw,'false');assert.equal(f.ui.ignoreClick,true);await f.ui.click(end);assert.equal(f.writes.length,1,'the synthetic release click cannot draw a second room');
});
test('stationary room presses keep two-click authoring and an invalid second corner remains correctable',async t=>{
 const f=rectangleGesture(t),a=f.event(-100,50),b=f.event(-106,62);f.ui.camera.hitAt=()=>null;
 f.ui.down(a);await f.ui.up(a);await f.ui.click(a);assert.equal(f.writes.length,0);assert.equal(f.ui.draft.length,1);
 await assert.rejects(()=>f.ui.click(a),/Raum benötigt eine Fläche/);assert.equal(f.ui.draft.length,1);
 f.ui.down(b);await f.ui.up(b);await f.ui.click(b);assert.equal(f.writes.length,1);
});
test('cancelled, stale and switched-floor room gestures cannot write into another context',async t=>{
 for(const mode of ['cancel','stale','floor']){
 const f=rectangleGesture(t),a=f.event(-100,50),b=f.event(-106,62);f.ui.down(a);f.ui.move(b);
 if(mode==='cancel')f.ui.cancel();if(mode==='stale')f.current(false);if(mode==='floor')f.ui.floorId='upper';
 await f.ui.up(b);assert.equal(f.writes.length,0,mode);assert.equal(f.ui.roomDrag,null,mode);
 }
});

test('landscape callers receive the original save failure instead of losing the reason in a null acknowledgement',async t=>{
 const f=fixture(t),messages=[],status=f.document.createElement('p'),previousEvent=global.Event;t.after(()=>global.Event=previousEvent);global.Event=f.document.defaultView.Event;status.id='atlas-save-status';f.document.body.append(status);
 f.ui.owner={token:'token',campaign:{id:'campaign'}};f.ui.render=()=>{};f.ui.error=e=>messages.push(e.message);window.campaign={executeAtlasCommit:async()=>({ok:false,error:'Atlas inzwischen geändert. Ausschnitt erneut laden.'})};
 await assert.rejects(()=>f.ui.write({kind:'undo'},false,true),/Atlas inzwischen geändert/);assert.equal(f.ui.busy,false);assert.equal(messages.length,1);
 assert.equal(await f.ui.write({kind:'undo'}),null,'other author paths keep their existing nullable failure contract');assert.equal(f.ui.busy,false);
});

test('a wall grip previews and commits both endpoints in one shape write, preserving source, holes and room identity',async t=>{
 const f=fixture(t),source=f.original;
 source.polygons[0].holes=[[{x:3,y:3},{x:4,y:3},{x:4,y:4}]];
 const before=structuredClone(source),writes=[];
 Object.assign(f.ui,{brushId:null,owner:{campaign:{id:'campaign'},token:'token'},suppressClick(){},write:async action=>writes.push(action),render(){}});
 f.ui.vertexDrag={id:4,room:structuredClone(source),polygon:0,vertex:1,edge:true,start:{x:9,y:5},point:{x:12,y:6}};
 const preview=f.ui.roomPreview(source);
 assert.deepEqual(preview.polygons[0].outer,[{x:1,y:2},{x:12,y:2},{x:12,y:8},{x:1,y:8}]);
 assert.deepEqual(preview.polygons[0].holes,before.polygons[0].holes);assert.deepEqual(source,before);
 await f.ui.up({pointerId:4});assert.equal(writes.length,1);
 const command=writes[0].command;assert.equal(command.action.kind,'shape');assert.equal(command.action.roomId,'room');assert.equal(command.action.expectedRevision,7);assert.deepEqual(command.action.polygons,preview.polygons);
});
test('wall handles use local edge normals and preserve nonadjacent vertices; no movement creates no history entry',async t=>{
 const f=fixture(t),writes=[];f.original.polygons[0].outer=[{x:0,y:0},{x:4,y:4},{x:4,y:8},{x:0,y:8}];
 f.ui.vertexDrag={id:3,room:structuredClone(f.original),polygon:0,vertex:0,edge:true,start:{x:2,y:2},point:{x:4,y:2}};
 const p=f.ui.roomPreview(f.original).polygons[0].outer;
 for(const [i,want] of [[0,{x:1,y:-1}],[1,{x:5,y:3}]]){assert(Math.abs(p[i].x-want.x)<1e-9);assert(Math.abs(p[i].y-want.y)<1e-9);}
 assert.deepEqual(p.slice(2),f.original.polygons[0].outer.slice(2));
 Object.assign(f.ui,{brushId:null,suppressClick(){},write:async a=>writes.push(a),render(){}});
 f.ui.vertexDrag.point={x:2,y:2};await f.ui.up({pointerId:3});assert.equal(writes.length,0);
});
test('wall handles are available on room edges but absent in stale, slice or public contexts',t=>{
 const f=fixture(t);let scene=f.render(),edges=all(scene).filter(n=>n.data.atlasEdge!==undefined);assert.equal(edges.length,4);
 assert.deepEqual(edges.map(n=>({x:n.geometry.x,y:n.geometry.y})),[{x:5,y:2},{x:9,y:5},{x:5,y:8},{x:1,y:5}]);
 f.document.getElementById('atlas-slice-enabled').checked=true;scene=f.render();assert.equal(all(scene).filter(n=>n.data.atlasEdge!==undefined).length,0);
 f.document.getElementById('atlas-slice-enabled').checked=false;f.document.getElementById('atlas-perception').checked=true;scene=f.render();assert.equal(all(scene).filter(n=>n.data.atlasEdge!==undefined).length,0);
 f.current(false);f.ui.svg.dataset.atlasGeometryStale='true';f.ui.camera.ready=true;f.ui.camera.hitAt=()=>{throw Error('stale handles must not be hit');};f.ui.down({button:0,altKey:false,pointerId:9});assert.equal(f.ui.vertexDrag,undefined);
});
test('core drawing controls dock before details without cloning handlers and return intact to their source',t=>{
 const f=fixture(t),doc=f.document,source=doc.createElement('section'),target=doc.createElement('section');target.id='atlas-drawing-tools';doc.body.append(source,target);
 const ids=['map-hint','drawing-toolbar','drawing-path-status','drawing-tool-options'];
 const nodes=ids.map(id=>{const n=doc.createElement('div');n.id=id;source.append(n);return n;});const tail=doc.createElement('p');source.append(tail);let clicks=0;nodes[0].onclick=()=>clicks++;
 f.ui.drawingDock=[];f.ui.dockDrawingTools(true);assert.equal(target.children.length,nodes.length);nodes.forEach((n,i)=>assert.equal(target.children[i],n));assert.equal(target.hidden,false);nodes[0].click();assert.equal(clicks,1);
 f.ui.dockDrawingTools(false);assert.equal(source.children.length,nodes.length+1);[...nodes,tail].forEach((n,i)=>assert.equal(source.children[i],n));assert.equal(target.hidden,true);f.ui.dockDrawingTools(true);assert.equal(target.children.length,nodes.length);nodes.forEach((n,i)=>assert.equal(target.children[i],n));
});

function doorResolver(t,rooms){
 const f=fixture(t);f.ui.owner={token:'t'};f.ui.loadedRegionQuery={};f.ui.data.region.fence='source';f.ui.opts.roomDraft=()=>null;
 window.campaign={atlasRegionCandidates:async()=>({ok:true,value:{items:rooms.map(r=>({kind:'room',id:r.id,scopeId:r.scopeId,floorId:r.floorId})),total:rooms.length,next:null}}),atlasRoom:async(token,id)=>({ok:true,value:rooms.find(r=>r.id===id)})};return f;
}
test('a door on a shared wall resolves original rooms without changing the selected room or using display contours',async t=>{
 const a={id:'a',scopeId:'local',floorId:'ground',revision:8,polygons:[{outer:[{x:1,y:2},{x:9,y:2},{x:9,y:8},{x:1,y:8}],holes:[]}]},b={...a,id:'b',polygons:[{outer:[{x:9,y:2},{x:15,y:2},{x:15,y:8},{x:9,y:8}],holes:[]}]};
 const f=doorResolver(t,[a,b]),target=await f.ui.doorRoomAt({x:-105,y:59});assert(['a','b'].includes(target.room.id));assert.equal(target.room.revision,8);assert.equal(f.ui.selection.id,'room');
 f.ui.data.region.fence='old';window.campaign.atlasRoom=async()=>{f.ui.data.region.fence='new';return{ok:true,value:a};};await assert.rejects(f.ui.doorRoomAt({x:-105,y:59}),/inzwischen geändert/);
});
test('distinct crossing walls require a room choice instead of silently binding a door',async t=>{
 const a={id:'a',scopeId:'local',floorId:'ground',revision:0,polygons:[{outer:[{x:1,y:2},{x:9,y:2},{x:9,y:8},{x:1,y:8}],holes:[]}]},b={...a,id:'b',polygons:[{outer:[{x:7,y:5},{x:11,y:5},{x:11,y:9},{x:7,y:9}],holes:[]}]};
 const f=doorResolver(t,[a,b]);await assert.rejects(f.ui.doorRoomAt({x:-105,y:59}),/Mehrere Wände/);
});

test('direct door mode has no inactive corner or wall grips competing with placement',t=>{
 const f=fixture(t);f.document.getElementById('drawing-tool').innerHTML='<option value="door" selected>Tür</option>';const scene=f.render();assert.equal(all(scene).filter(n=>n.data.atlasEdge!==undefined||n.data.atlasVertex!==undefined).length,0);
});
