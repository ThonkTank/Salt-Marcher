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
export const selectElement=()=>{},atlasDrawingPoint=()=>{},atlasDrawingScope=()=>{},reloadDrawing=()=>{};`}));}}]});
const {CampaignAtlasWorkbench}=createRequire(import.meta.url)('../.build/atlas-author-overlay.cjs');
function fixture(t){
 const previous={window:global.window,document:global.document,atlasAuthorDraft:global.atlasAuthorDraft,atlasOverlayCalls:global.atlasOverlayCalls,atlasDraftNode:global.atlasDraftNode};t.after(()=>Object.assign(global,previous));
 const ids=['recover','placement','scale','undo','redo','connect-entrance','local-console','create-tools','floor-field','building-interior','selection-title'];
 const {window,document}=parseHTML('<html><body>'+ids.map(id=>`<div id="atlas-${id}"></div>`).join('')+'<label><input id="atlas-slice-enabled"></label><label><input id="atlas-slice"></label><label><input id="atlas-roofs"></label><input id="atlas-perception"><select id="atlas-floor"></select></body></html>');Object.assign(global,{window,document,atlasAuthorDraft:{floor:{scopeId:'local',floorId:'ground'}},atlasOverlayCalls:0});
 const original={id:'room',scopeId:'local',floorId:'ground',revision:7,polygons:[{outer:[{x:1,y:2},{x:9,y:2},{x:9,y:8},{x:1,y:8}],holes:[]}]},binding={id:'bind',kind:'dungeon',ownerId:'local',parent:'world',parentId:null,x:-100,y:50,angle:Math.PI/2,revision:0};
 let output,current=true;
 const ui=Object.assign(Object.create(CampaignAtlasWorkbench.prototype),{root:{hidden:false,dataset:{}},svg:{clientWidth:100,dataset:{}},camera:{view:{x:-110,y:40,width:20,height:20},render:draw=>{output={children:[],data:{mapScene:'true'},append(...nodes){this.children.push(...nodes);}};draw(output);}},family:'interior',scopeId:'local',floorId:'ground',selection:{kind:'room',id:'room'},draft:[],landscape:{draw(){}},opts:{roomDraft:()=>original},geometryCurrent:()=>current,selectedBinding:()=>null,renderTravel(){},drawTerrain(){},drawInteriorRuntime(){},drawParty(){}});
 // A raster region intentionally contains no author contours or display rooms.
 Object.defineProperty(ui,'data',{value:{campaignId:'campaign',revision:5,canUndo:true,canRedo:false,cities:[],bindings:[binding],workspace:{rooms:[],floors:[]},entrances:[],terrain:{hexMeters:100},region:{box:{x:-120,y:30,width:40,height:40},raster:{box:{x:-110,y:40,width:20,height:20},data:'raster'},frames:{bind:{x:-100,y:50,angle:Math.PI/2}}},geometry:{position:null}},writable:true});
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
test('author overlay retains the draft during loading but revokes grips, and respects floor/slice/perception context',t=>{
 const f=fixture(t);f.current(false);let scene=f.render();assert.equal(all(scene).filter(n=>n.data.atlasVertex!==undefined).length,0);assert(all(scene).includes(atlasDraftNode));
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
