import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {schedule, conflicts, conditionalScenario, renderPlan} from './render-atlas-performance-plan.mjs';

const graph = JSON.parse(fs.readFileSync(new URL('../docs/atlas/architecture/performance/work-packages.json', import.meta.url)));
const minimal = {capacity:3,resourceCapacity:{'native-host':1},estimateProfiles:{test:{activeHours:[1,1],waitHours:[0,0],reserveHours:0}}};
const node = (id, extra={}) => ({id,requires:[],resources:[],writeScopes:[],writesBuildInputs:false,nativeBuild:false,estimate:{profile:'test'},...extra});
const byId = rows => new Map(rows.map(row=>[row.id,row]));
const overlaps = (a,b) => a.start < b.end && b.start < a.end;

test('independent owners overlap; folder/file owners remain exclusive across unequal durations',()=>{
 const rows=byId(schedule([node('long',{writeScopes:['src/app/'],writesBuildInputs:true,estimate:{profile:'test',activeHours:[1,4]}}),node('same',{writeScopes:['src/app/view.ts'],writesBuildInputs:true}),node('other',{writeScopes:['desktop/main.ts'],writesBuildInputs:true})],minimal));
 assert.equal(rows.get('other').start,0);assert.equal(rows.get('same').start,4);
 assert.equal(conflicts(node('a',{writeScopes:['src/app/x.ts']}),node('b',{writeScopes:['src/app/x.ts.bak']})),false);
});

test('native runs freeze all build writers but permit independent documentation work',()=>{
 const rows=byId(schedule([node('native',{nativeBuild:true,resources:['native-host'],estimate:{profile:'test',waitHours:[0,3]}}),node('writer',{writeScopes:['desktop/main.ts'],writesBuildInputs:true}),node('docs',{writeScopes:['docs/']})],minimal));
 assert.equal(rows.get('docs').start,0);assert.equal(rows.get('writer').start,4);
 const reversed=byId(schedule([node('writer',{writesBuildInputs:true}),node('native',{nativeBuild:true,resources:['native-host']})],minimal));
 assert.equal(reversed.get('native').start,1);
});

test('native host, agent capacity and dependencies constrain actual intervals',()=>{
 const rows=byId(schedule([node('a',{resources:['native-host']}),node('b',{resources:['native-host']}),node('c'),node('d'),node('after',{requires:['a','b']})],{...minimal,capacity:2}));
 assert.equal(rows.get('c').start,0);assert.equal(rows.get('b').start,1);assert(rows.get('after').start>=rows.get('b').end);
 for(let time=0;time<4;time++)assert([...rows.values()].filter(n=>n.start<=time&&n.end>time).length<=2);
 assert.throws(()=>schedule([node('bad',{resources:['typo']})],minimal),/Unknown resource/);
 assert.throws(()=>schedule([node('a',{requires:['b']}),node('b',{requires:['a']})],minimal),/Cycle/);
});

test('real graph prevents reviewed A0 and A1 collisions',()=>{
 const rows=byId(schedule(graph.packages.filter(n=>!n.conditional),graph));
 for(const [a,b] of [['A1.04','A1.07'],['A1.04','A1.08'],['A0.06','A0.10'],['A0.09','A0.13'],['A0.07','A0.08']])assert(!overlaps(rows.get(a),rows.get(b)),`${a} overlaps ${b}`);
 for(const id of ['A0.10','A0.11','A0.14']){
  const native=rows.get(id);assert(native.nativeBuild && native.resources.includes('native-host'));
  for(const writer of rows.values())if(writer.id!==id && writer.writesBuildInputs)assert(!overlaps(native,writer),`${id} overlaps build writer ${writer.id}`);
 }
 for(const id of ['A0.07','A0.08']){
  assert(!rows.get(id).nativeBuild);
  assert(rows.get(id).start>=rows.get('A0.13').end,'owner integration needs durable receipt contract');
  assert(rows.get('A0.14').start>=rows.get(id).end,'restart qualification needs both owners');
 }
 assert(rows.get('A0.11').start>=rows.get('A0.14').end,'combined qualification needs verified restart');
 for(const id of ['A0.16','A0.17']){
  assert(rows.get(id).start>=rows.get('A0.15').end,'preview consumers need the stable owner contract');
  assert(rows.get('A0.09').start>=rows.get(id).end,'projection requalification needs both preview integrations');
 }
 assert(overlaps(rows.get('A0.16'),rows.get('A0.17')),'separate preview persistence and UI owners can work in parallel');
 assert(overlaps(rows.get('A2.03'),rows.get('A2.05')),'separate candidate owners should remain parallel');
});

test('B4 computes a complete short compute route without scheduling renderer ports',()=>{
 const compute=conditionalScenario(graph,'B4','compute'),render=conditionalScenario(graph,'B4','render');
 assert.deepEqual(compute.entries.map(n=>n.id),['B4.01','B4.07','B4.05']);
 assert(compute.externalRequirements.includes('A6.08'));
 assert.deepEqual(compute.returnGates,['A6.09','A6.10']);
 assert.deepEqual(render.entries.map(n=>n.id),['B4.01','B4.02','B4.03','B4.06','B4.04','B4.05']);
 assert(render.inactive.includes('B4.07'));assert(compute.inactive.includes('B4.04'));
 assert.deepEqual(render.returnGates,['A2.11','A2.12','A3.12']);
 assert(compute.entries.at(-1).end<render.entries.at(-1).end);
});

test('B3 can finish after bounded parallelism without pretending WASM is mandatory',()=>{
 assert.deepEqual(conditionalScenario(graph,'B3','parallel').entries.map(n=>n.id),['B3.01','B3.02']);
 assert.deepEqual(conditionalScenario(graph,'B3','wasm').entries.map(n=>n.id),['B3.01','B3.02','B3.03','B3.04']);
});

test('timeline has exactly one row per package and exposes estimates, inactive variants and unknown acceptance wait',()=>{
 const html=renderPlan(graph),ids=[...html.matchAll(/data-package="([A-Z0-9.]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,graph.packages.length);assert.equal(new Set(ids).size,ids.length);
 assert.match(html,/Inaktive Alternative/);assert.match(html,/Warten unbekannt/);assert.match(html,/zuzüglich unbekannter Abnahmewartezeit/);
 assert.match(html,/Beginn des Planreviews/);assert(!html.includes('Slots relativ'));
});
