import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const directory = 'docs/atlas/architecture/performance';
const dependencyFields = ['requires', 'alternativeRequires', 'activationRequires', 'returnGates'];
const overlap = (a, b) => a === b || a.endsWith('/') && b.startsWith(a) || b.endsWith('/') && a.startsWith(b);

export function estimate(node, graph) {
  const profile = graph.estimateProfiles[node.estimate.profile];
  assert(profile, `Missing estimate profile: ${node.id}`);
  const value = {...profile, ...node.estimate};
  assert(value.activeHours.length === 2 && value.activeHours[0] > 0 && value.activeHours[1] >= value.activeHours[0], `Invalid active estimate: ${node.id}`);
  assert(value.waitHours === null || value.waitHours.length === 2 && value.waitHours[0] >= 0 && value.waitHours[1] >= value.waitHours[0], `Invalid waiting estimate: ${node.id}`);
  assert(value.reserveHours >= 0, `Invalid reserve: ${node.id}`);
  return {...value, duration: value.activeHours[1] + (value.waitHours?.[1] ?? 0) + value.reserveHours};
}

export function conflicts(a, b) {
  if (a.writeScopes.some(x => b.writeScopes.some(y => overlap(x, y)))) return true;
  // The shared checkout/build is frozen for a native qualification package.
  return a.nativeBuild && b.writesBuildInputs || b.nativeBuild && a.writesBuildInputs;
}

/** Earliest event scheduling with whole-package ownership. Unknown human waits
 * are shown separately; no elapsed-time estimate grants an acceptance gate. */
export function schedule(input, graph) {
  assert(Number.isInteger(graph.capacity) && graph.capacity > 0, 'Invalid agent capacity');
  const remaining = new Map(input.map(node => [node.id, node]));
  assert.equal(remaining.size, input.length, 'Duplicate scheduled ID');
  for (const node of input) for (const r of node.resources)
    assert(Number.isInteger(graph.resourceCapacity[r]) && graph.resourceCapacity[r] > 0, `Unknown resource ${r}`);
  const done = new Map(), active = [], result = [];
  let time = 0;
  while (remaining.size || active.length) {
    for (let i = active.length - 1; i >= 0; i--) if (active[i].end <= time) {
      const [finished] = active.splice(i, 1); done.set(finished.id, finished.end);
    }
    for (const node of [...remaining.values()]) {
      if (active.length >= graph.capacity) break;
      if (!node.requires.every(id => done.has(id))) continue;
      if (active.some(other => conflicts(node, other))) continue;
      if (node.resources.some(r => active.filter(other => other.resources.includes(r)).length >= graph.resourceCapacity[r])) continue;
      const planned = {...node, start: time, end: time + estimate(node, graph).duration};
      remaining.delete(node.id); active.push(planned); result.push(planned);
    }
    if (!remaining.size && !active.length) break;
    assert(active.length, `Cycle or unavailable prerequisite: ${[...remaining.keys()].join(', ')}`);
    time = Math.min(...active.map(node => node.end));
  }
  for (const node of result) for (const id of node.requires)
    assert(done.get(id) <= node.start, `Dependency overlap ${id} -> ${node.id}`);
  return result;
}

export function conditionalScenario(graph, lane, routeId) {
  const route = graph.conditionalRoutes[lane]?.find(r => r.id === routeId);
  assert(route, `Unknown conditional scenario ${lane}/${routeId}`);
  const all = graph.packages.filter(node => node.lane === lane);
  const selected = all.filter(node => !node.variant || node.variant === route.variant).map(node => ({...node,
    requires: route.variant === 'compute' && node.alternativeRequires.length ? node.alternativeRequires : node.requires
  }));
  const external = new Set(route.activationRequires);
  for (const node of selected) for (const id of node.activationRequires) external.add(id);
  // Any-of activators are recorded failures/reviews, not successfully completed
  // gates. They are inputs to this relative scenario and never fabricated as done.
  return {...route, externalRequirements: [...external], entries: schedule(selected, graph),
    inactive: all.filter(node => !selected.some(n => n.id === node.id)).map(n => n.id)};
}

export function validateGraph(graph, root) {
  const nodes = graph.packages, byId = new Map(nodes.map(node => [node.id, node]));
  assert.equal(byId.size, nodes.length, 'Duplicate package ID');
  const definitions = new Map();
  for (const file of fs.readdirSync(path.join(root, directory)).filter(name => name.endsWith('.md'))) {
    const document = `${directory}/${file}`, content = fs.readFileSync(path.join(root, document), 'utf8');
    for (const match of content.matchAll(/^### ([ABPRC]\d\.\d{2}) — (.+)\n([\s\S]*?)(?=^### |$(?![\s\S]))/gm)) {
      assert(!definitions.has(match[1]), `Duplicate definition ${match[1]}`);
      const marker = match[3].match(/<!-- atlas-dependencies (\{[^\n]+\}) -->/);
      assert(marker, `Missing machine-readable dependencies: ${match[1]}`);
      definitions.set(match[1], {title: match[2], document, dependencies: JSON.parse(marker[1])});
    }
  }
  assert.equal(definitions.size, nodes.length, 'Every defined package needs one timeline row');
  for (const node of nodes) {
    const definition = definitions.get(node.id);
    assert(definition && definition.title === node.title && definition.document === node.document, `Stale package ${node.id}`);
    for (const field of dependencyFields) {
      assert.deepEqual(definition.dependencies[field], node[field], `Dependency text differs: ${node.id}/${field}`);
      for (const id of node[field]) assert(byId.has(id), `Missing prerequisite/gate ${id}`);
    }
    assert.equal(node.slots, 1, 'Each package remains one agent run');
    assert(Array.isArray(node.writeScopes) && node.writeScopes.every(s => s && !s.startsWith('/') && !s.includes('..')), `Invalid write scope: ${node.id}`);
    assert.equal(typeof node.writesBuildInputs, 'boolean'); assert.equal(typeof node.nativeBuild, 'boolean');
    assert(!node.nativeBuild || node.resources.includes('native-host'), `Native host missing: ${node.id}`);
    estimate(node, graph);
  }
  for (const [lane, routes] of Object.entries(graph.conditionalRoutes)) for (const route of routes) {
    assert(route.activationAnyOf.length, `Missing activating finding: ${lane}/${route.id}`);
    for (const id of [...route.activationAnyOf, ...route.activationRequires, ...route.returnGates]) assert(byId.has(id), `Unknown activation/return gate ${id}`);
    assert(route.returnGates.length || route.decisionGate, `Missing return/decision gate: ${lane}`);
    conditionalScenario(graph, lane, route.id);
  }
}

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug = value => value.toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/\s/g, '-');
const range = values => values === null ? 'unbekannt' : values.join('–') + ' h';

export function renderPlan(graph) {
  const normal = schedule(graph.packages.filter(node => !node.conditional), graph);
  const branches = Object.keys(graph.conditionalRoutes).map(lane => ({lane,
    scenarios: graph.conditionalRoutes[lane].map(route => conditionalScenario(graph, lane, route.id))}));
  function chart(all, scenarios, label) {
    const end = Math.ceil(Math.max(...scenarios.flatMap(s => s.entries.map(n => n.end))) / 4) * 4;
    const first = scenarios[0], rows = new Map(first.entries.map(n => [n.id, n]));
    const options = scenarios.length > 1 ? `<label>Route <select class="route">${scenarios.map(s => `<option value="${esc(s.id)}">${esc(s.id)}</option>`).join('')}</select></label>` : '';
    const gateText = s => s.activationAnyOf ? `Aktivierung: dokumentierter Befund aus ${s.activationAnyOf.join(' / ')}. Benötigte Eingänge: ${s.externalRequirements.join(', ') || 'gewählter Pfad und belegter Engpass'}. Rückkehr: ${s.returnGates.join(' → ') || s.decisionGate}. ${s.decisionGate}` : 'Zeitnull ist der Beginn des Planreviews; A0 beginnt erst nach P0.03. Meilensteinreviews bleiben verbindliche Gates.';
    return `<section data-chart="${esc(label)}"><h2>${esc(label)}</h2>${options}<p class="gates">${esc(gateText(first))}</p>
<div class="scroll"><div class="chart" style="--hours:${end}"><div class="axis"><span>Paket / Voraussetzungen / Aufwand</span><div class="ticks">${Array.from({length:end/4},(_,i)=>`<span>${i*4} h</span>`).join('')}</div></div>
${all.map(row => {
      const planned = rows.get(row.id), e = estimate(row, graph), offset = planned?.start ?? 0, length = planned ? planned.end - planned.start : 0;
      const precedingUnknown = planned && first.entries.some(n => n.end <= planned.start && estimate(n, graph).waitHours === null);
      return `<div class="row${planned ? '' : ' inactive'}" data-package="${row.id}"><div class="label"><a href="${esc(path.basename(row.document))}#${slug(row.id+' — '+row.title)}">${row.id} · ${esc(row.title)}</a><small class="dependencies">${planned ? 'Nach: '+esc(planned.requires.join(', ') || 'Freigabe / Aktivierungsbefund') : 'In dieser Route inaktiv'}</small><small>Aktiv ${range(e.activeHours)} · Warten ${range(e.waitHours)} · Reserve ${e.reserveHours} h${row.nativeBuild?' · nativer Prüfbuild exklusiv':''}${precedingUnknown?' · zuzüglich unbekannter Abnahmewartezeit':''}</small></div><div class="track"><span class="bar ${row.lane.startsWith('R')||row.lane==='P0'?'review':''}" style="left:${offset/end*100}%;width:${length/end*100}%" title="${esc(e.basis)}" ${planned?'':'hidden'}>${row.id}</span><span class="inactive-note" ${planned?'hidden':''}>Inaktive Alternative</span></div></div>`;
    }).join('\n')}
</div></div><script type="application/json" class="scenario-data">${JSON.stringify({end,scenarios:scenarios.map(s=>({id:s.id,gates:gateText(s),entries:s.entries.map(n=>({id:n.id,start:n.start,end:n.end,requires:n.requires}))}))}).replace(/</g,'\\u003c')}</script></section>`;
  }
  return `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Atlas – Paket-Timeline</title><style>
:root{color-scheme:light dark;--bg:#f8f9fb;--fg:#17212b;--line:#d8e0e8;--bar:#176b78;--review:#5c527d;--muted:#536270}@media(prefers-color-scheme:dark){:root{--bg:#151c22;--fg:#edf3f7;--line:#34414e;--bar:#246c79;--review:#675987;--muted:#b1bdc8}}
*{box-sizing:border-box}body{font:15px/1.5 system-ui,sans-serif;margin:0;background:var(--bg);color:var(--fg)}main{max-width:1600px;margin:auto;padding:28px}h1{font-size:28px}h2{font-size:20px;margin:28px 0 4px}p{max-width:1050px}a{color:inherit}small{display:block;color:var(--muted);font-size:12px}.scroll{overflow:auto;max-height:75vh;border-top:1px solid var(--line)}.chart{min-width:calc(460px + var(--hours)*24px)}.axis,.row{display:grid;grid-template-columns:460px 1fr}.axis{position:sticky;top:0;z-index:3;background:var(--bg);font-size:12px;font-weight:600;border-bottom:1px solid var(--line)}.axis>span{padding:10px}.ticks{display:grid;grid-template-columns:repeat(calc(var(--hours)/4),1fr)}.ticks span{padding:10px 0}.label{position:sticky;left:0;z-index:1;background:var(--bg);padding:8px 10px;border-bottom:1px solid var(--line)}.track{position:relative;border-bottom:1px solid var(--line);background:repeating-linear-gradient(to right,transparent 0,transparent 95px,var(--line) 95px,var(--line) 96px)}.bar{position:absolute;top:50%;transform:translateY(-50%);padding:5px 2px;background:var(--bar);color:#fff;text-align:center;font-size:11px;border-radius:3px;overflow:hidden}.bar.review{background:var(--review)}.inactive{opacity:.55}.inactive-note{padding:10px;display:inline-block}[hidden]{display:none!important}summary{font-weight:600;cursor:pointer;padding:12px 0}nav{display:flex;gap:20px;flex-wrap:wrap}select{font:inherit;margin:8px;padding:4px}@media(max-width:600px){main{padding:16px}.chart{min-width:calc(300px + var(--hours)*24px)}.axis,.row{grid-template-columns:300px 1fr}}@media print{.scroll{max-height:none}}
</style><main><h1>Atlas: Arbeitspakete und Abhängigkeiten</h1><nav><a href="../performance-roadmap.md">Roadmap</a><a href="handbook.md">Projekthandbuch</a><a href="work-packages.json">Paketgraph</a></nav>
<p><strong>${graph.packages.length} Pakete, jeweils eine Zeile.</strong> Relative Planstunden ab Beginn des Planreviews: obere Erstschätzung einschließlich Warteannahme und Reserve. Keine Kalenderzusage. Native und CI-Wartezeiten können die Annahme überschreiten; menschliche Abnahme bleibt ohne Zeitannahme. Nach A0/A2 und jedem weiteren Gate gegen Ist neu planen.</p><p>Maximal ${graph.capacity} Agenten. Gemeinsame Schreibpfade sind exklusiv; native Prüfungen sperren parallel veränderte Buildinputs. Jeder Balken bleibt ein Agentenlauf. Inaktive Varianten sind gekennzeichnet und belegen keine Zeit oder Ressourcen.</p><p>Planstand: <strong>${esc(graph.planVersion)}</strong> · ${esc(graph.status)}. Balken zeigen Planzeiten; Istwerte stehen im Paketgraphen und Projekthandbuch. Neue Fixes erhalten eigene Pakete.</p>
${chart(normal,[{id:'standard',entries:normal}], 'Standardweg mit Reviews und Übergabe')}
<details open><summary>Bedingte Wege – nur nach dokumentiertem Befund</summary><p>Die folgenden Zeitachsen beginnen relativ zur jeweiligen Aktivierung. Der betreffende reguläre Gate-Übergang bleibt bis zum Vergleich und zur erneuten Prüfung gesperrt. B3 und B4 bieten getrennt berechnete Alternativen.</p>${branches.map(b=>chart(graph.packages.filter(n=>n.lane===b.lane),b.scenarios,b.lane)).join('\n')}</details></main>
<script>for(const section of document.querySelectorAll('section')){const select=section.querySelector('.route');if(!select)continue;const data=JSON.parse(section.querySelector('.scenario-data').textContent);select.addEventListener('change',()=>{const scenario=data.scenarios.find(s=>s.id===select.value),entries=new Map(scenario.entries.map(n=>[n.id,n]));section.querySelector('.gates').textContent=scenario.gates;for(const row of section.querySelectorAll('[data-package]')){const entry=entries.get(row.dataset.package),bar=row.querySelector('.bar');row.classList.toggle('inactive',!entry);bar.hidden=!entry;row.querySelector('.inactive-note').hidden=!!entry;row.querySelector('.dependencies').textContent=entry?'Nach: '+(entry.requires.join(', ')||'Aktivierungsbefund'):'In dieser Route inaktiv';if(entry){bar.style.left=entry.start/data.end*100+'%';bar.style.width=(entry.end-entry.start)/data.end*100+'%';}}});}</script></html>\n`;
}

export function main(root = process.cwd(), check = process.argv.includes('--check')) {
  const graph = JSON.parse(fs.readFileSync(path.join(root, directory, 'work-packages.json'), 'utf8'));
  validateGraph(graph, root);
  const html = renderPlan(graph), output = path.join(root, directory, 'timeline.html');
  if (check) assert.equal(fs.readFileSync(output, 'utf8'), html, 'Timeline is stale; regenerate');
  else fs.writeFileSync(output, html);
  console.log(`Atlas plan PASS: ${graph.packages.length} package rows; text dependencies, scenarios, resources and relative estimates validated.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
