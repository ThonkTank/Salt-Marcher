import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { validateInventory, INITIAL_PROBE_REQUIREMENTS, deriveGroupUiIds, evidenceRecordHash } from '../tools/wonderdraft/validate-inventory.mjs';

function sample() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-inventory-'));
  const screenshot = path.join(directory, 'screen.png');
  const session = path.join(directory, 'session.txt');
  fs.writeFileSync(screenshot, PNG.sync.write(new PNG({ width: 2, height: 2 })));
  fs.writeFileSync(session, 'app_pid=123\nstarted_at=2026-10-08T21:00:00+02:00\n');
  const entry = {
    id: 'WD-UI-0001', version: '1.1.8.2', exactUiPath: 'Land > Landmass Brush',
    context: 'QA map', commandOrControl: 'Landmass Brush', controlType: 'tool_button',
    default: null, rangeOrChoices: null, validation: 'open', gesture: 'click',
    previewOrCommit: 'surface observed', stateScope: 'open', caseIds: ['WD-005.01'],
    phase: 'HEX-02', classification: 'original_tool_surface',
    directEvidence: [{ role: 'original_gui_screenshot', version: '1.1.8.2', session,
      path: screenshot }],
  };
  return {
    directory,
    document: { wonderdraftParity: {
      reference: { version: '1.1.8.2' },
      cases: [{ id: 'WD-005.01', phase: 'HEX-02', relatedPhases: [] }],
      uiInventory: [entry], inventoryComplete: false,
      inventoryGate: { state: 'open', steps: [{ state: 'in_progress' }] },
      coverageReview: { unclassifiedPackageHints: ['candidate'] },
    } },
  };
}

test('direct screenshot from a named original session validates as partial inventory', (t) => {
  const { directory, document } = sample();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const partial = validateInventory(document, { allowOpen: true });
  assert.equal(partial.valid, true);
  assert(partial.pending.some(item => item.includes('lacks pinned frame/process metadata')));
  assert.match(validateInventory(document).errors.join(' '), /Inventartor noch offen/);
});

test('a package hint or a missing screenshot cannot act as original UI evidence', (t) => {
  const { directory, document } = sample();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const evidence = document.wonderdraftParity.uiInventory[0].directEvidence[0];
  evidence.role = 'package_hint';
  assert.match(validateInventory(document, { allowOpen: true }).errors.join(' '), /kein Originalbeleg/);
  evidence.role = 'original_gui_screenshot';
  fs.rmSync(evidence.path);
  assert.match(validateInventory(document, { allowOpen: true }).errors.join(' '), /Belegdatei fehlt/);
});

test('duplicate UI IDs and orphaned WD cases are rejected', (t) => {
  const { directory, document } = sample();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const duplicate = structuredClone(document.wonderdraftParity.uiInventory[0]);
  duplicate.caseIds = ['WD-999.01'];
  document.wonderdraftParity.uiInventory.push(duplicate);
  const errors = validateInventory(document, { allowOpen: true }).errors.join(' ');
  assert.match(errors, /duplicate UI id/);
  assert.match(errors, /orphan/);
});

function fixture() {
  const png = PNG.sync.write(new PNG({ width: 2, height: 2 }));
  const s = { id: 'original-1', role: 'actual_original_runtime', product: 'Wonderdraft',
    executableSha256: 'exe', packageSha256: 'pck', width: 2, height: 2,
    state: 'stopped', processes: [{ name: 'wonderdraft', pid: 123, startTicks: '100' }],
    inputKind: 'synthetic_local_rfb', startedAt: '2026-10-08T17:00:00Z', endedAt: '2026-10-08T17:05:00Z' };
  const m = { role: s.role, sessionId: s.id, executableSha256: 'exe', screenshot: 'original.png',
    screenshotSha256: createHash('sha256').update(png).digest('hex'), capturedAt: '2026-10-08T17:01:00Z',
    inputKind: s.inputKind, width: 2, height: 2 };
  const e = { role: s.role, session: 'session.json', metadata: 'frame.json', screenshot: 'original.png', observation: 'Visible original New Map Width 1920 px' };
  const u = { id: 'WD-UI-001', version: '1.1.8.2', exactUiPath: 'New > Settings', context: 'new map',
    commandOrControl: 'Width', controlType: 'number', default: 1920, rangeOrChoices: null,
    validation: 'not measured', gesture: 'click', previewOrCommit: 'dialog only', stateScope: 'new map',
    caseIds: ['WD-001.01'], phase: 'HEX-01', directEvidence: [e], classification: 'user_function' };
  const catalog = { reference: { version: '1.1.8.2', executableSha256: 'exe', packageSha256: 'pck' },
    uiInventoryFields: Object.keys(u), uiInventory: [u], inventoryComplete: false,
    groups: [{ id: 'WD-001', phases: ['HEX-01'], tools: [], ui: ['res://new.gdc'], caseIds: ['WD-001.01'] }],
    cases: [{ id: 'WD-001.01', phase: 'HEX-01' }],
    packageClassification: [{ path: 'res://new.gdc', state: 'observed', classification: 'user_function', reason: 'Original dialog', uiIds: [u.id], directEvidence: [e] }],
    inventoryGate: { state: 'open', steps: [{ state: 'not_run', evidence: [] }], initialProbeCases: ['WD-001.01'] } };
  const raw = Buffer.from('test-fixture-map-bytes');
  const second = { ...s, id: 'original-2', processes: [{ name: 'wonderdraft', pid: 124, startTicks: '200' }], startedAt: '2026-10-08T17:10:00Z', endedAt: '2026-10-08T17:15:00Z' };
  const reopenedFrame = { ...m, sessionId: second.id, capturedAt: '2026-10-08T17:11:00Z' };
  const reopenedEvidence = { ...e, session: 'session2.json', metadata: 'frame2.json', observation: 'Fixture reopened in second original session' };
  const files = () => new Map([['session.json', Buffer.from(JSON.stringify(s))], ['frame.json', Buffer.from(JSON.stringify(m))], ['original.png', png],
    ['session2.json', Buffer.from(JSON.stringify(second))], ['frame2.json', Buffer.from(JSON.stringify(reopenedFrame))], ['map.wonderdraft_map', raw]]);
  const validate = () => validateInventory(catalog, file => { const data = files().get(file); if (!data) throw new Error('missing file'); return data; });
  const proveOriginal = () => { catalog.cases[0].original = { state: 'verified_direct_probe', evidence: [e],
    reopen: { evidence: [reopenedEvidence] }, savedEffect: { file: 'map.wonderdraft_map', sha256: createHash('sha256').update(raw).digest('hex') } }; };
  return { catalog, u, e, s, m, second, reopenedFrame, reopenedEvidence, raw, files, validate, proveOriginal };
}
test('valid direct images preserve the open original review gate', () => {
  const f = fixture(), r = f.validate(); assert.equal(r.valid, true);
  assert(r.pending.includes('HEX-00 reference gate open'));
  assert.equal(r.visualCompleteness, 'requires separate original review');
});
test('documentation and package hints cannot replace actual original images', () => {
  for (const role of ['official_documentation', 'package_hint_only', 'host_runtime']) {
    const f = fixture(); f.e.role = role; assert.equal(f.validate().valid, false);
  }
});
test('missing, swapped, changed or differently pinned frames are rejected', () => {
  for (const mutate of [f => { f.e.screenshot = 'absent.png'; }, f => { f.m.sessionId = 'other-original'; },
    f => { f.m.screenshotSha256 = 'changed'; }, f => { f.s.packageSha256 = 'different-version'; },
    f => { f.m.width = 99; }, f => { f.m.capturedAt = '2026-10-08T18:00:00Z'; },
    f => { f.s.startedAt = 'unknown'; }]) {
    const f = fixture(); mutate(f); assert.equal(f.validate().valid, false);
  }
});
test('orphan cases, UI ids and wrong phase assignments fail mapping', () => {
  for (const mutate of [f => f.u.caseIds.push('WD-999.01'), f => f.catalog.uiInventory.push(structuredClone(f.u)),
    f => { f.u.phase = 'HEX-26'; }, f => { f.catalog.packageClassification[0].uiIds = ['unknown']; }]) {
    const f = fixture(); mutate(f); assert.equal(f.validate().valid, false);
  }
});
test('unclassified hints and explicit observation limits remain pending', () => {
  const f = fixture(); f.catalog.packageClassification = []; f.u.observationLimits = ['range still unmeasured'];
  const r = f.validate(); assert.equal(r.valid, true);
  assert(r.pending.some(p => p.includes('classification missing'))); assert(r.pending.some(p => p.includes('range still unmeasured')));
});
test('a marker-only old inventory cannot assert complete reference coverage', () => {
  const f = fixture(); f.catalog.inventoryComplete = true; assert.equal(f.validate().valid, false);
  f.catalog.inventoryGate.state = 'passed'; f.catalog.inventoryGate.steps = [{ state: 'passed', evidence: ['review'] }];
  assert.equal(f.validate().valid, false);
  f.proveOriginal();
  assert.equal(f.validate().valid, false);
});

function scopedFixture() {
  const f = fixture(), ids = Object.keys(INITIAL_PROBE_REQUIREMENTS);
  const exe = createHash('sha256').update('fixture executable').digest('hex'), pck = createHash('sha256').update('fixture package').digest('hex');
  f.catalog.reference.executableSha256 = f.s.executableSha256 = f.m.executableSha256 = f.reopenedFrame.executableSha256 = f.second.executableSha256 = exe;
  f.catalog.reference.packageSha256 = f.s.packageSha256 = f.second.packageSha256 = pck;
  const receipt = { run: 'reference-review-2', state: 'passed', initialCases: ids };
  const extras = new Map([['review.json', Buffer.from(JSON.stringify(receipt))]]);
  const hash = createHash('sha256').update(f.raw).digest('hex');
  f.catalog.scopeContractVersion = 1;
  f.catalog.scopeContract = { phaseOrder: Array.from({ length: 29 }, (_, i) => `HEX-${String(i).padStart(2, '0')}`) };
  f.catalog.cases = ids.map(id => {
    const requirements = INITIAL_PROBE_REQUIREMENTS[id].map(name => ({ id: name, description: `Explicit fixture requirement ${name}`, evidence: [f.e] }));
    const maps = id === 'WD-026.01' ? requirements.filter(r => r.id.startsWith('theme:')).map((r, i) => {
      r.savedEffectFile = `theme-${i}.wonderdraft_map`; extras.set(r.savedEffectFile, f.raw);
      return { file: r.savedEffectFile, sha256: hash, evidence: [f.e], reopenEvidence: [f.reopenedEvidence] };
    }) : [{ file: 'map.wonderdraft_map', sha256: hash, evidence: [f.e], reopenEvidence: [f.reopenedEvidence] }];
    return { id, phase: 'HEX-01', relatedPhases: ['HEX-11'], original: { state: 'partial_direct_probe', initialProbe: {
      state: 'recorded_direct_probe', scope: 'Explicit early fixture scope', requirements, evidence: [f.e], savedEffects: maps,
      reopen: { evidence: [f.reopenedEvidence] }, review: { state: 'passed', run: receipt.run, evidence: ['review.json'] },
      deferredSourceStatements: [], observationQuestions: [],
    } } };
  });
  f.u.caseIds = ids; f.catalog.groups[0].caseIds = ids; f.catalog.groups[0].uiInventoryIds = [f.u.id];
  f.catalog.inventoryComplete = true;
  f.catalog.inventoryGate = { state: 'passed', initialProbeCases: ids, steps: ['HEX-00-A','HEX-00-B','HEX-00-C'].map(id => ({ id, state: 'passed', evidence: ['review.json'] })) };
  f.catalog.coverageReview = { state: 'passed', run: receipt.run, evidence: ['review.json'] };
  f.extras = extras;
  f.validate = (options = {}) => validateInventory(f.catalog, { readFile: file => {
    const data = extras.get(file) || f.files().get(file); if (!data) throw new Error('missing file'); return data;
  }, ...options });
  f.addQuestion = (overrides = {}) => {
    f.u.observationLimits = ['Explicit open effect'];
    const q = { id: 'WD-Q-1', sourceIndex: 0, sourceText: f.u.observationLimits[0], kind: 'original_effect',
      caseIds: [ids[0]], duePhase: 'HEX-11', reason: 'Known surface; missing geometry effect', probe: 'Change the option on existing geometry, commit and reopen', state: 'open', evidence: [], ...overrides };
    f.u.observationQuestions = [q]; return q;
  };
  return f;
}

test('all early scoped proofs can pass while broader cases and later effects remain open', () => {
  const f = scopedFixture(); f.addQuestion();
  const early = f.validate(); assert.equal(early.valid, true); assert.equal(early.blocking.length, 0);
  assert.equal(early.initialProofs.length, 13); assert.equal(early.deferred.length, 1);
  assert.equal(f.catalog.cases[0].original.state, 'partial_direct_probe');
  const later = f.validate({ phase: 'HEX-11' }); assert.equal(later.valid, true); assert.equal(later.blocking.length, 1);
  assert.equal(later.phaseRequirements.beforeImplementation.length, 1);
});

test('unclassified, disappeared, altered and wrongly deferred source questions fail closed', () => {
  for (const mutate of [f => { delete f.u.observationQuestions; }, f => { f.u.observationQuestions = []; },
    f => { f.u.observationQuestions[0].sourceText = 'Changed source'; }, f => { f.u.observationQuestions[0].kind = 'unknown'; },
    f => { f.u.observationQuestions[0].kind = 'inventory'; }, f => { f.u.observationQuestions[0].duePhase = 'HEX-28'; },
    f => { f.u.observationQuestions[0].caseIds = ['WD-999.01']; }, f => { f.u.observationQuestions[0].probe = ''; },
    f => { f.u.observationQuestions[0].sourceIndex = -1; }, f => { f.u.observationQuestions[0].sourceText = undefined; },
    f => { f.catalog.scopeContract.phaseOrder.reverse(); }, f => { f.catalog.reference.packageSha256 = undefined; }]) {
    const f = scopedFixture(); f.addQuestion(); mutate(f); assert.equal(f.validate().valid, false);
  }
});

test('missing early scope, requirement, map, fresh process or separate review cannot approve coverage', () => {
  for (const mutate of [f => { delete f.catalog.cases[0].original.initialProbe; },
    f => { f.catalog.inventoryGate.initialProbeCases.pop(); },
    f => { f.catalog.cases[0].original.initialProbe.requirements.pop(); },
    f => { f.catalog.cases[0].original.initialProbe.requirements[0].evidence = ['marker']; },
    f => { f.catalog.cases[0].original.initialProbe.reopen.evidence = [f.e]; },
    f => { f.second.processes = f.s.processes; }, f => { f.second.state = 'running'; },
    f => { f.catalog.cases[0].original.initialProbe.savedEffects[0].sha256 = 'changed'; },
    f => { f.catalog.cases[0].original.initialProbe.review.state = 'pending'; },
    f => { f.extras.delete('review.json'); }, f => { f.catalog.coverageReview.run = 'wrong'; },
    f => { f.catalog.coverageReview.evidence = ['missing.json']; }, f => { delete f.catalog.scopeContractVersion; }]) {
    const f = scopedFixture(); mutate(f); assert.equal(f.validate().valid, false);
  }
});

test('each of nine themes needs its own unchanged raw file and fresh opening', () => {
  for (const mutate of [p => { p.savedEffects.pop(); }, p => { p.requirements[2].savedEffectFile = p.requirements[1].savedEffectFile; },
    p => { p.savedEffects[0].reopenEvidence = [p.evidence[0]]; }]) {
    const f = scopedFixture(), p = f.catalog.cases.find(c => c.id === 'WD-026.01').original.initialProbe;
    mutate(p); assert.equal(f.validate().valid, false);
  }
});

test('resolved obligations require direct proof and cannot use synthetic images as physical or host acceptance', () => {
  for (const overrides of [{ state: 'resolved' }, { state: 'resolved', evidence: ['marker'] },
    { state: 'resolved', kind: 'physical_input', evidence: [] }, { state: 'resolved', kind: 'host_pair', evidence: [] }]) {
    const f = scopedFixture(); const q = f.addQuestion(overrides);
    if (['physical_input', 'host_pair'].includes(q.kind)) q.evidence = [f.e];
    assert.equal(f.validate().valid, false);
  }
  const f = scopedFixture(); f.addQuestion({ state: 'resolved', evidence: [f.e] }); assert.equal(f.validate().valid, true);
});

test('due host acceptance does not pretend to block knowledge before implementation', () => {
  const f = scopedFixture(); f.addQuestion({ kind: 'host_pair' });
  const r = f.validate({ phase: 'HEX-11' }); assert.equal(r.valid, true);
  assert.equal(r.phaseRequirements.beforeImplementation.length, 0); assert.equal(r.phaseRequirements.acceptance.length, 1);
});

test('group indices must match case ownership and cross references need provenance', () => {
  const f = scopedFixture(); assert.deepEqual(deriveGroupUiIds(f.catalog.groups[0], f.catalog.uiInventory), [f.u.id]);
  for (const mutate of [f => { f.catalog.groups[0].uiInventoryIds = []; },
    f => { f.catalog.groups[0].uiInventoryIds.push('missing'); }, f => { f.catalog.groups[0].uiInventoryIds.push(f.u.id); },
    f => { f.catalog.groups[0].crossReferenceUi = [{ uiId: f.u.id, reason: '', evidence: [f.e] }]; },
    f => { f.catalog.groups[0].crossReferenceUi = [{ uiId: 'unknown', reason: 'Reference role', evidence: [f.e] }]; }]) {
    const sample = scopedFixture(); mutate(sample); assert.equal(sample.validate().valid, false);
  }
});

test('complete check cannot be bypassed with allow-open or an unknown phase', () => {
  const f = scopedFixture(); f.catalog.inventoryComplete = false;
  assert.equal(f.validate({ allowOpen: true, requireComplete: true }).valid, false);
  assert.equal(scopedFixture().validate({ phase: 'HEX-99' }).valid, false);
});

test('historical missing imports remain active errors until explicit per-owner replacement', () => {
  const f = scopedFixture(); f.u.directEvidence.push({ role: 'original_gui_screenshot', version: '1.1.8.2', session: 'missing.txt', path: 'missing.png' });
  const r = f.validate(); assert.equal(r.valid, false); assert.equal(r.historicalEvidenceIssues.length, 1);
  assert.equal(r.historicalEvidenceIssues[0].state, 'still_blocks_active_evidence');
});

function historicalFixture() {
  const f = fixture();
  const old = { role: 'original_gui_screenshot', version: '1.1.8.2', session: 'missing.txt', path: 'missing.png' };
  f.u.directEvidence.unshift(old);
  f.catalog.evidenceUsageContractVersion = 1;
  const usage = { id: 'WD-H-001', owner: f.u.id, evidenceIndex: 0, state: 'historical_unverified',
    source: { role: old.role, version: old.version, session: old.session, path: old.path, recordSha256: evidenceRecordHash(old) },
    assertion: { exactUiPath: f.u.exactUiPath, commandOrControl: f.u.commandOrControl, context: f.u.context },
    originalFailure: 'missing file', reason: 'Unavailable imported frame; current original observation replaces its UI scope only',
    replacementScope: 'Visible Width control in New Settings; no assertion about the old image',
    replacementEvidence: [{ session: f.e.session, metadata: f.e.metadata, screenshot: f.e.screenshot }] };
  f.catalog.evidenceUsages = [usage];
  return { ...f, old, usage };
}

test('explicit same-owner native replacement keeps the exact old source unverified and the gate open', () => {
  const f = historicalFixture(), before = structuredClone(f.old), r = f.validate();
  assert.equal(r.valid, true); assert.deepEqual(f.old, before);
  assert.equal(r.historicalEvidenceIssues.length, 1);
  assert.equal(r.historicalEvidenceIssues[0].state, 'historical_unverified_replaced');
  assert.equal(r.historicalEvidenceIssues[0].source, 'missing.png');
  assert.equal(r.historicalEvidenceIssues[0].originalFailure, 'missing file');
  assert(r.pending.includes('HEX-00 reference gate open'));
  assert.equal(r.visualCompleteness, 'requires separate original review');
});

test('orphan, altered, duplicate or silently verified historical usages are rejected', () => {
  for (const mutate of [f => { f.usage.owner = 'other-control'; }, f => { f.usage.evidenceIndex = 1; },
    f => { f.usage.evidenceIndex = '0'; }, f => { f.usage.assertion.context = 'another-map'; },
    f => { f.usage.source.path = 'different.png'; }, f => { f.usage.source.session = 'different.txt'; },
    f => { f.usage.source.recordSha256 = 'changed'; }, f => { f.old.version = 'different'; },
    f => { f.usage.assertion.exactUiPath = 'another-control'; }, f => { f.usage.state = 'verified'; },
    f => { f.usage.reason = ''; }, f => { f.usage.originalFailure = ''; }, f => { f.usage.replacementScope = ''; },
    f => { f.catalog.evidenceUsages.push(structuredClone(f.usage)); },
    f => { f.catalog.evidenceUsageContractVersion = 2; }, f => { delete f.catalog.evidenceUsageContractVersion; },
    f => { f.catalog.evidenceUsages = 'ignore-all-imports'; }, f => { f.catalog.evidenceUsages = [null]; }]) {
    const f = historicalFixture(); mutate(f); assert.equal(f.validate().valid, false);
  }
});

test('replacement must be an actual frame on the same owner and cannot ignore other missing sources', () => {
  for (const mutate of [f => { f.usage.replacementEvidence = []; },
    f => { f.usage.replacementEvidence[0].metadata = 'another-frame.json'; },
    f => { f.u.directEvidence.pop(); }, f => { f.e.role = 'package_hint'; },
    f => { f.usage.replacementEvidence.push(structuredClone(f.usage.replacementEvidence[0])); },
    f => { f.u.directEvidence.push({ ...f.old, path: 'second-missing.png' }); }]) {
    const f = historicalFixture(); mutate(f); assert.equal(f.validate().valid, false);
  }
});

test('changed replacement frame, session, version hash or missing external QA still blocks', () => {
  for (const mutate of [f => { f.m.screenshotSha256 = 'changed'; }, f => { f.m.sessionId = 'wrong'; },
    f => { f.s.packageSha256 = 'wrong-version'; }, f => { f.e.screenshot = 'missing-current.png'; },
    f => { f.m.width = 100; }, f => { f.m.capturedAt = '2026-10-08T18:00:00Z'; }]) {
    const f = historicalFixture(); mutate(f); const r = f.validate();
    assert.equal(r.valid, false); assert(r.historicalEvidenceIssues.some(i => i.state === 'still_blocks_active_evidence'));
  }
  const f = historicalFixture();
  const emptyClone = validateInventory(f.catalog, () => { throw new Error('external QA unavailable'); });
  assert.equal(emptyClone.valid, false);
  assert(!emptyClone.historicalEvidenceIssues.some(i => i.state === 'historical_unverified_replaced'));
});

test('a readable historical image remains unverified after a scoped current replacement', () => {
  const f = historicalFixture(), files = f.files();
  files.set('missing.txt', Buffer.from('app_pid=123\nstarted_at=2026-10-08T21:00:00+02:00\n'));
  files.set('missing.png', files.get('original.png'));
  const r = validateInventory(f.catalog, file => { if (!files.has(file)) throw new Error('missing file'); return files.get(file); });
  assert.equal(r.valid, true); assert.equal(r.historicalEvidenceIssues[0].state, 'historical_unverified_replaced');
  assert.match(r.historicalEvidenceIssues[0].message, /lacks pinned frame\/process metadata/);
});

test('historical raw-map replacement additionally requires unchanged current saved data', () => {
  for (const mode of ['valid', 'missing-effect', 'changed-effect', 'wrong-file']) {
    const f = historicalFixture(); f.old.role = 'original_saved_map'; f.old.path = 'old-map.wonderdraft_map';
    Object.assign(f.usage.source, { role: f.old.role, path: f.old.path, recordSha256: evidenceRecordHash(f.old) });
    f.usage.replacementSavedEffects = [{ file: 'map.wonderdraft_map', sha256: createHash('sha256').update(f.raw).digest('hex') }];
    if (mode === 'missing-effect') delete f.usage.replacementSavedEffects;
    if (mode === 'changed-effect') f.usage.replacementSavedEffects[0].sha256 = 'changed';
    if (mode === 'wrong-file') f.usage.replacementSavedEffects[0].file = 'absent';
    assert.equal(f.validate().valid, mode === 'valid');
  }
});
test('a claimed original probe requires pinned evidence, a different process and unchanged raw map', () => {
  for (const mutate of [
    f => { f.catalog.cases[0].original.evidence = ['direct-sequence']; },
    f => { f.catalog.cases[0].original.reopen = 'new process observed'; },
    f => { f.catalog.cases[0].original.reopen.evidence = [f.e]; },
    f => { f.catalog.cases[0].original.savedEffect.sha256 = 'changed'; },
    f => { f.catalog.cases[0].original.savedEffect.file = 'missing'; },
  ]) {
    const f = fixture(); f.proveOriginal(); mutate(f); assert.equal(f.validate().valid, false);
  }
});
