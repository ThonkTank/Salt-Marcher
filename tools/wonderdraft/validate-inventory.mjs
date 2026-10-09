import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const INITIAL_PROBE_REQUIREMENTS = {
  'WD-001.01': ['new', 'cancel'],
  'WD-001.02': ['templates', 'dimensions', 'orientation', 'coupling', 'defaults'],
  'WD-002.01': ['pan', 'space', 'zoom-anchor', 'zoom-dialog', 'fit-100'],
  'WD-002.02': ['first-load', 'first-pan', 'first-tool'],
  'WD-003.01': ['save', 'save-as', 'cancel', 'ordinary-save'],
  'WD-003.02': ['new-unsaved', 'exit-unsaved', 'automatic-backup'],
  'WD-003.03': ['map-states', 'ground-values', 'palette', 'symbol-values'],
  'WD-004.01': ['click', 'stroke', 'path', 'tool-default'],
  'WD-004.02': ['stroke', 'preview', 'path', 'dialog', 'tool-switch'],
  'WD-005.01': ['brush', 'range'],
  'WD-007.01': ['paint', 'erase', 'history', 'controls'],
  'WD-021.01': ['hex', 'rgba', 'pipette', 'dialog-contexts'],
  'WD-026.01': ['theme-list', ...['Adventure', 'Eastward', 'Black & White', 'Feudal', 'Imagination', 'Paper', 'Pastel', 'Terra', 'Worn'].map(t => `theme:${t}`)],
};
const PHASES = Array.from({ length: 29 }, (_, i) => `HEX-${String(i).padStart(2, '0')}`);
const QUESTION_KINDS = ['inventory', 'initial_sequence', 'original_effect', 'host_pair', 'physical_input'];
const equalIds = (a, b) => Array.isArray(a) && a.length === new Set(a).size &&
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

export function deriveGroupUiIds(group, uiInventory) {
  return uiInventory.filter(u => u.caseIds?.some(id => group.caseIds.includes(id))).map(u => u.id).sort();
}

// Checks provenance and mapping consistency, never decides visual completeness.
export function validateInventory(document, options = {}) {
  const catalog = document.wonderdraftParity || document;
  const readFile = typeof options === 'function' ? options : options.readFile || (file => fs.readFileSync(file));
  const allowOpen = document.wonderdraftParity ? options.allowOpen === true : true;
  const groups = catalog.groups || [];
  const requiredFields = catalog.uiInventoryFields || ['id','version','exactUiPath','context','commandOrControl','controlType',
    'default','rangeOrChoices','validation','gesture','previewOrCommit','stateScope','caseIds','phase','directEvidence','classification'];
  const errors = [], pending = [], earlyBlocking = [], beforeImplementation = [], acceptanceBlocking = [], deferred = [], historicalEvidenceIssues = [];
  const uiIds = new Set(), caseIds = new Set(catalog.cases.map(c => c.id));
  const scoped = catalog.scopeContractVersion === 1;
  const phase = options.phase || 'HEX-00', phaseIndex = PHASES.indexOf(phase);
  if (phaseIndex < 0) errors.push(`unknown requested phase ${phase}`);
  if (catalog.scopeContractVersion !== undefined && !scoped) errors.push('unknown scope contract version');
  if (scoped && JSON.stringify(catalog.scopeContract?.phaseOrder) !== JSON.stringify(PHASES)) errors.push('invalid roadmap phase order');
  if (scoped && (!/^[a-f0-9]{64}$/.test(catalog.reference.executableSha256 || '') || !/^[a-f0-9]{64}$/.test(catalog.reference.packageSha256 || '')))
    errors.push('scoped reference requires pinned executable and package hashes');
  if (options.requireComplete && !catalog.inventoryComplete) errors.push('complete reference inventory not asserted');
  const questionIds = new Set();
  function open(message, kind = 'inventory', duePhase = 'HEX-00') {
    pending.push(message);
    if (duePhase === 'HEX-00' && !['host_pair', 'physical_input'].includes(kind)) earlyBlocking.push(message);
    if (PHASES.indexOf(duePhase) <= phaseIndex) {
      (['host_pair', 'physical_input'].includes(kind) ? acceptanceBlocking : beforeImplementation).push(message);
    } else deferred.push({ message, kind, duePhase });
  }
  const cases = new Map(catalog.cases.map(c => [c.id, c]));
  if (caseIds.size !== catalog.cases.length) errors.push('duplicate case id');
  const phases = new Set(groups.length ? groups.flatMap(g => g.phases) : catalog.cases.flatMap(c => [c.phase, ...(c.relatedPhases || [])]));
  const hints = new Set(groups.flatMap(g => [...g.tools, ...g.ui]));
  const classifications = catalog.packageClassification || [];
  function evidence(e, owner) {
    try {
      if (e.role === 'original_gui_screenshot') {
        if (e.version !== catalog.reference.version) throw new Error('wrong original version');
        const source = readFile(e.session).toString();
        if (!/app_pid=\d+/.test(source) || !/started_at=/.test(source)) throw new Error('Originalsitzung fehlt.');
        let bytes;
        try { bytes = readFile(e.path); } catch { throw new Error('Belegdatei fehlt.'); }
        if (!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('not an original PNG frame');
        if (e.sha256 && createHash('sha256').update(bytes).digest('hex') !== e.sha256) throw new Error('changed imported image');
        open(`${owner}: imported source receipt lacks pinned frame/process metadata; separate verification required`);
        return undefined;
      }
      if (e.role !== 'actual_original_runtime' || !e.observation?.trim()) throw new Error('not a direct original observation; kein Originalbeleg');
      const s = JSON.parse(readFile(e.session).toString()), m = JSON.parse(readFile(e.metadata).toString());
      const screenshot = readFile(e.screenshot);
      if (s.role !== 'actual_original_runtime' || s.product !== 'Wonderdraft' || m.role !== s.role || m.sessionId !== s.id)
        throw new Error('wrong original session or role');
      if (s.executableSha256 !== catalog.reference.executableSha256 || s.packageSha256 !== catalog.reference.packageSha256 || m.executableSha256 !== s.executableSha256)
        throw new Error('wrong reference hash');
      if (m.screenshot !== e.screenshot || createHash('sha256').update(screenshot).digest('hex') !== m.screenshotSha256 ||
        !screenshot.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('missing or changed original image');
      if (!Number.isFinite(Date.parse(s.startedAt)) || !Number.isFinite(Date.parse(m.capturedAt)) || Date.parse(m.capturedAt) < Date.parse(s.startedAt) ||
        (s.endedAt && Date.parse(m.capturedAt) > Date.parse(s.endedAt))) throw new Error('image outside session interval');
      if (m.inputKind !== s.inputKind || m.width !== s.width || m.height !== s.height ||
        screenshot.length < 24 || screenshot.readUInt32BE(16) !== m.width || screenshot.readUInt32BE(20) !== m.height) throw new Error('frame/input provenance changed');
      return s;
    } catch (error) {
      const message = `${owner}: ${error.message}`;
      errors.push(message);
      if (e?.role === 'original_gui_screenshot') historicalEvidenceIssues.push({ owner, source: e.path, message, state: 'still_blocks_active_evidence' });
    }
  }
  function directList(list, owner) {
    if (!Array.isArray(list) || !list.length) { errors.push(`${owner}: direct original frames required`); return []; }
    return list.map(e => evidence(e, owner)).filter(Boolean);
  }
  function rawMap(map, owner) {
    try {
      if (!map?.file || !map.sha256 || createHash('sha256').update(readFile(map.file)).digest('hex') !== map.sha256)
        throw new Error('saved raw map missing or changed');
    } catch (error) { errors.push(`${owner}: ${error.message}`); }
  }
  function questions(owner, limits, list, mappedCases) {
    if (!scoped) { if (limits?.length) open(`${owner}: ${limits.join('; ')}`); return; }
    if (!Array.isArray(list)) { if (limits?.length) errors.push(`${owner}: unclassified observation questions`); return; }
    if (limits !== undefined && !Array.isArray(limits)) { errors.push(`${owner}: invalid question source list`); return; }
    for (const [index, text] of (limits || []).entries())
      if (!list.some(q => q.sourceIndex === index && q.sourceText === text)) errors.push(`${owner}: missing question for source ${index}`);
    for (const q of list) {
      const name = `${owner} ${q.id}`;
      if (!q.id || questionIds.has(q.id)) errors.push(`${name}: missing or duplicate question id`);
      questionIds.add(q.id);
      if (!Number.isInteger(q.sourceIndex) || q.sourceIndex < 0 || q.sourceIndex >= (limits?.length || 0) ||
        typeof q.sourceText !== 'string' || !q.sourceText.trim() || limits?.[q.sourceIndex] !== q.sourceText)
        errors.push(`${name}: changed or orphan question source`);
      if (!QUESTION_KINDS.includes(q.kind) || !PHASES.includes(q.duePhase) || !q.reason?.trim() || !q.probe?.trim())
        errors.push(`${name}: missing question kind, phase, reason or concrete probe`);
      if (!Array.isArray(q.caseIds) || !q.caseIds.length || q.caseIds.some(id => !cases.has(id)) || !q.caseIds.some(id => mappedCases.includes(id)))
        errors.push(`${name}: invalid question case mapping`);
      if (['inventory', 'initial_sequence'].includes(q.kind) && q.duePhase !== 'HEX-00') errors.push(`${name}: early obligation cannot be deferred`);
      if (q.kind === 'original_effect' && q.duePhase !== 'HEX-00' && !q.caseIds?.some(id => [cases.get(id)?.phase, ...(cases.get(id)?.relatedPhases || [])].includes(q.duePhase)))
        errors.push(`${name}: effect due phase has no mapped case`);
      if (!['open', 'resolved'].includes(q.state)) errors.push(`${name}: unknown question state`);
      if (q.state === 'resolved') {
        const sessions = directList(q.evidence, name);
        if (!sessions.length) errors.push(`${name}: resolved question lacks current direct proof`);
        if (q.kind === 'host_pair') errors.push(`${name}: original frames cannot approve a host pair`);
        if (q.kind === 'physical_input' && sessions.some(s => s.inputKind !== 'physical_mouse_touchpad')) errors.push(`${name}: synthetic input cannot approve physical input`);
      } else open(`${name}: ${q.probe}`, q.kind, q.duePhase);
    }
  }
  for (const u of catalog.uiInventory) {
    if (uiIds.has(u.id)) errors.push(`${u.id}: duplicate UI id`); uiIds.add(u.id);
    for (const field of requiredFields) if (!(field in u)) errors.push(`${u.id}: missing ${field}`);
    if (u.version !== catalog.reference.version) errors.push(`${u.id}: wrong version`);
    if (!u.exactUiPath?.trim() || !u.commandOrControl?.trim()) errors.push(`${u.id}: missing literal UI path/control`);
    if (!Array.isArray(u.caseIds) || !u.caseIds.length) errors.push(`${u.id}: no case mapping`);
    else for (const id of u.caseIds) {
      if (!cases.has(id)) errors.push(`${u.id}: orphan ${id}`);
      else if (![cases.get(id).phase, ...(cases.get(id).relatedPhases || [])].includes(u.phase)) errors.push(`${u.id}: phase differs from ${id}`);
    }
    if (!phases.has(u.phase)) errors.push(`${u.id}: unknown phase`);
    if (!Array.isArray(u.directEvidence) || !u.directEvidence.length) errors.push(`${u.id}: no direct original evidence`);
    else for (const e of u.directEvidence) evidence(e, u.id);
    questions(u.id, u.observationLimits, u.observationQuestions, u.caseIds || []);
  }
  const classified = new Set();
  for (const c of classifications) {
    if (!hints.has(c.path)) errors.push(`unknown package hint ${c.path}`);
    if (classified.has(c.path)) errors.push(`duplicate package classification ${c.path}`); classified.add(c.path);
    if (c.state === 'pending') { open(`${c.path}: classification pending`); continue; }
    if (!['user_function', 'internal_helper', 'program_service'].includes(c.classification) || !c.reason?.trim()) errors.push(`${c.path}: missing classification/reason`);
    if (c.classification === 'user_function' && (!c.uiIds?.length || c.uiIds.some(id => !uiIds.has(id)))) errors.push(`${c.path}: no valid UI mapping`);
    if (!c.directEvidence?.length) errors.push(`${c.path}: classification lacks original evidence`);
    else for (const e of c.directEvidence) evidence(e, c.path);
  }
  for (const hint of hints) if (!classified.has(hint)) open(`${hint}: classification missing`);
  const unmappedCases = [...caseIds].filter(id => !catalog.uiInventory.some(u => u.caseIds.includes(id)));
  for (const id of unmappedCases) open(`${id}: no direct UI mapping`);
  for (const g of groups) {
    if (!g.caseIds.every(id => caseIds.has(id))) errors.push(`${g.id}: orphan case mapping`);
    if (scoped && !equalIds(g.uiInventoryIds, deriveGroupUiIds(g, catalog.uiInventory))) errors.push(`${g.id}: inconsistent group UI index`);
    const crossIds = new Set();
    for (const cross of g.crossReferenceUi || []) {
      if (!uiIds.has(cross.uiId) || crossIds.has(cross.uiId) || !cross.reason?.trim()) errors.push(`${g.id}: invalid or unexplained cross reference`);
      crossIds.add(cross.uiId); directList(cross.evidence, `${g.id} cross ${cross.uiId}`);
    }
  }
  if (catalog.inventoryGate.state !== 'passed') open('HEX-00 reference gate open');
  if (!allowOpen && (!catalog.inventoryComplete || catalog.inventoryGate.state !== 'passed')) errors.push('Inventartor noch offen.');
  for (const c of catalog.cases.filter(c => c.original?.state === 'verified_direct_probe')) {
    const o = c.original;
    const initialSessions = (Array.isArray(o.evidence) ? o.evidence : []).map(e => evidence(e, c.id)).filter(Boolean);
    if (!initialSessions.length || !Array.isArray(o.reopen?.evidence) || !o.reopen.evidence.length) {
      errors.push(`${c.id}: direct sequence and fresh original frames required`);
      continue;
    }
    const reopened = o.reopen.evidence.map(e => evidence(e, `${c.id} reopen`)).filter(Boolean);
    if (!reopened.length || reopened.some(s => initialSessions.some(first => first.id === s.id)))
      errors.push(`${c.id}: reopen must use a different original process session`);
    rawMap(o.savedEffect, c.id);
  }
  const initialProofs = new Set();
  if (scoped) {
    if (!equalIds(catalog.inventoryGate.initialProbeCases, Object.keys(INITIAL_PROBE_REQUIREMENTS))) errors.push('incomplete initial probe case contract');
    for (const [id, required] of Object.entries(INITIAL_PROBE_REQUIREMENTS)) {
      const p = cases.get(id)?.original?.initialProbe, owner = `${id} initial`;
      if (!p) { open(`${owner}: scoped initial probe missing`, 'initial_sequence'); continue; }
      const count = errors.length;
      if (p.state !== 'recorded_direct_probe' || !p.scope?.trim()) errors.push(`${owner}: missing recorded scope`);
      const initial = directList(p.evidence, owner);
      if (!equalIds(p.requirements?.map(r => r.id), required)) errors.push(`${owner}: incomplete initial requirement contract`);
      for (const r of p.requirements || []) {
        if (!r.description?.trim()) errors.push(`${owner} ${r.id}: no concrete requirement`);
        directList(r.evidence, `${owner} ${r.id}`);
        if (r.id.startsWith('theme:') && !p.savedEffects?.some(map => map.file === r.savedEffectFile))
          errors.push(`${owner} ${r.id}: theme requires its own saved effect`);
      }
      if (id === 'WD-026.01' && new Set((p.requirements || []).filter(r => r.id.startsWith('theme:')).map(r => r.savedEffectFile)).size !== 9)
        errors.push(`${owner}: nine distinct theme maps required`);
      const reopened = directList(p.reopen?.evidence, `${owner} reopen`);
      if (!reopened.length || reopened.some(s => initial.some(first => first.id === s.id))) errors.push(`${owner}: reopen must use a different original process session`);
      if (!Array.isArray(p.savedEffects) || !p.savedEffects.length) errors.push(`${owner}: no saved effects`);
      for (const map of p.savedEffects || []) {
        rawMap(map, owner);
        const saved = directList(map.evidence, `${owner} map save`), fresh = directList(map.reopenEvidence, `${owner} map reopen`);
        const identity = s => s.processes?.find(p => p.name === 'wonderdraft');
        if (!saved.length || !fresh.length || fresh.some(s => !s.endedAt || s.state !== 'stopped' || saved.some(first => {
          const a = identity(first), b = identity(s);
          return first.id === s.id || !a || !b || !Number.isInteger(a.pid) || !Number.isInteger(b.pid) || !a.startTicks || !b.startTicks ||
            (a.pid === b.pid && a.startTicks === b.startTicks) || Date.parse(s.startedAt) <= Date.parse(first.startedAt);
        }))) errors.push(`${owner}: saved map requires a fresh stopped original process`);
      }
      if (p.review?.state !== 'passed' || !p.review.run || !p.review.evidence?.length) open(`${owner}: scoped review pending`, 'initial_sequence');
      else for (const path of p.review.evidence) {
        try {
          const receipt = JSON.parse(readFile(path).toString());
          if (receipt.run !== p.review.run || receipt.state !== 'passed' || !receipt.initialCases?.includes(id) ||
            (catalog.inventoryComplete && catalog.coverageReview?.run !== p.review.run)) throw new Error('wrong scoped review receipt');
        } catch (error) { errors.push(`${owner}: ${error.message}`); }
      }
      if (errors.length === count && initial.length && reopened.length) initialProofs.add(id);
      questions(id, p.deferredSourceStatements, p.observationQuestions, [id]);
    }
  }
  if (catalog.inventoryComplete) {
    if (!scoped || earlyBlocking.length || errors.length || catalog.inventoryGate.state !== 'passed' ||
      !equalIds(catalog.inventoryGate.steps.map(s => s.id), ['HEX-00-A', 'HEX-00-B', 'HEX-00-C']) ||
      !catalog.inventoryGate.steps.every(s => s.state === 'passed' && s.evidence.length) ||
      catalog.coverageReview?.state !== 'passed' || !catalog.coverageReview.run || !catalog.coverageReview.evidence?.length)
      errors.push('inventoryComplete cannot be asserted with open mapping or unreviewed gate');
    for (const path of catalog.coverageReview?.evidence || []) {
      try { readFile(path); } catch { errors.push('coverage review evidence missing'); }
    }
    for (const id of catalog.inventoryGate.initialProbeCases) {
      if (!initialProofs.has(id))
        errors.push(`${id}: initial original sequence not proved`);
    }
  }
  const blocking = [...errors, ...beforeImplementation];
  return { valid: errors.length === 0, role: 'provenance_and_mapping_check_only', phase, errors, pending, blocking, deferred, historicalEvidenceIssues,
    phaseRequirements: { beforeImplementation: blocking, acceptance: [...blocking, ...acceptanceBlocking] },
    initialProofs: [...initialProofs], uiEntries: uiIds.size,
    stats: { uiEntries: uiIds.size, cases: caseIds.size, classifiedHints: classifications.filter(c => c.state !== 'pending').length,
      packageHints: hints.size }, visualCompleteness: 'requires separate original review' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), file = args[0];
  if (!file || file.startsWith('--')) throw new Error('Usage: validate-inventory.mjs acceptance.json [--allow-open] [--require-complete] [--phase HEX-xx]');
  let phase = 'HEX-00';
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--phase') { phase = args[++i]; if (!PHASES.includes(phase)) throw new Error('unknown or missing phase'); }
    else if (!['--allow-open', '--require-complete'].includes(args[i])) throw new Error(`unknown argument ${args[i]}`);
  }
  const result = validateInventory(JSON.parse(fs.readFileSync(file, 'utf8')), { allowOpen: args.includes('--allow-open'), requireComplete: args.includes('--require-complete'), phase });
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid || (args.includes('--require-complete') && result.blocking.length)) process.exitCode = 1;
}
