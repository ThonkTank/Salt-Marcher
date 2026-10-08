import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Checks provenance and mapping consistency, never decides visual completeness.
export function validateInventory(document, options = {}) {
  const catalog = document.wonderdraftParity || document;
  const readFile = typeof options === 'function' ? options : file => fs.readFileSync(file);
  const allowOpen = document.wonderdraftParity ? options.allowOpen === true : true;
  const groups = catalog.groups || [];
  const requiredFields = catalog.uiInventoryFields || ['id','version','exactUiPath','context','commandOrControl','controlType',
    'default','rangeOrChoices','validation','gesture','previewOrCommit','stateScope','caseIds','phase','directEvidence','classification'];
  const errors = [], pending = [], uiIds = new Set(), caseIds = new Set(catalog.cases.map(c => c.id));
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
        pending.push(`${owner}: imported source receipt lacks pinned frame/process metadata; separate verification required`);
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
    } catch (error) { errors.push(`${owner}: ${error.message}`); }
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
    if (u.observationLimits?.length) pending.push(`${u.id}: ${u.observationLimits.join('; ')}`);
  }
  const classified = new Set();
  for (const c of classifications) {
    if (!hints.has(c.path)) errors.push(`unknown package hint ${c.path}`);
    if (classified.has(c.path)) errors.push(`duplicate package classification ${c.path}`); classified.add(c.path);
    if (c.state === 'pending') { pending.push(`${c.path}: classification pending`); continue; }
    if (!['user_function', 'internal_helper', 'program_service'].includes(c.classification) || !c.reason?.trim()) errors.push(`${c.path}: missing classification/reason`);
    if (c.classification === 'user_function' && (!c.uiIds?.length || c.uiIds.some(id => !uiIds.has(id)))) errors.push(`${c.path}: no valid UI mapping`);
    if (!c.directEvidence?.length) errors.push(`${c.path}: classification lacks original evidence`);
    else for (const e of c.directEvidence) evidence(e, c.path);
  }
  for (const hint of hints) if (!classified.has(hint)) pending.push(`${hint}: classification missing`);
  const unmappedCases = [...caseIds].filter(id => !catalog.uiInventory.some(u => u.caseIds.includes(id)));
  for (const id of unmappedCases) pending.push(`${id}: no direct UI mapping`);
  for (const g of groups) if (!g.caseIds.every(id => caseIds.has(id))) errors.push(`${g.id}: orphan case mapping`);
  if (catalog.inventoryGate.state !== 'passed') pending.push('HEX-00 reference gate open');
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
    try {
      if (!o.savedEffect?.file || !o.savedEffect?.sha256 ||
        createHash('sha256').update(readFile(o.savedEffect.file)).digest('hex') !== o.savedEffect.sha256)
        throw new Error('saved raw map missing or changed');
    } catch (error) { errors.push(`${c.id}: ${error.message}`); }
  }
  if (catalog.inventoryComplete) {
    if (pending.length || catalog.inventoryGate.state !== 'passed' || !catalog.inventoryGate.steps.every(s => s.state === 'passed' && s.evidence.length))
      errors.push('inventoryComplete cannot be asserted with open mapping or unreviewed gate');
    for (const id of catalog.inventoryGate.initialProbeCases) {
      const original = cases.get(id)?.original;
      if (original?.state !== 'verified_direct_probe')
        errors.push(`${id}: initial original sequence not proved`);
    }
  }
  return { valid: errors.length === 0, role: 'provenance_and_mapping_check_only', errors, pending, uiEntries: uiIds.size,
    stats: { uiEntries: uiIds.size, cases: caseIds.size, classifiedHints: classifications.filter(c => c.state !== 'pending').length,
      packageHints: hints.size }, visualCompleteness: 'requires separate original review' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), file = args.find(a => !a.startsWith('--'));
  if (!file) throw new Error('Usage: validate-inventory.mjs acceptance.json [--require-complete]');
  const result = validateInventory(JSON.parse(fs.readFileSync(file, 'utf8')), { allowOpen: args.includes('--allow-open') });
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid || (args.includes('--require-complete') && result.pending.length)) process.exitCode = 1;
}
