import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { validateInventory } from '../tools/wonderdraft/validate-inventory.mjs';

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
  const second = { ...s, id: 'original-2', startedAt: '2026-10-08T17:10:00Z', endedAt: '2026-10-08T17:15:00Z' };
  const reopenedFrame = { ...m, sessionId: second.id, capturedAt: '2026-10-08T17:11:00Z' };
  const reopenedEvidence = { ...e, session: 'session2.json', metadata: 'frame2.json', observation: 'Fixture reopened in second original session' };
  const files = () => new Map([['session.json', Buffer.from(JSON.stringify(s))], ['frame.json', Buffer.from(JSON.stringify(m))], ['original.png', png],
    ['session2.json', Buffer.from(JSON.stringify(second))], ['frame2.json', Buffer.from(JSON.stringify(reopenedFrame))], ['map.wonderdraft_map', raw]]);
  const validate = () => validateInventory(catalog, file => { const data = files().get(file); if (!data) throw new Error('missing file'); return data; });
  const proveOriginal = () => { catalog.cases[0].original = { state: 'verified_direct_probe', evidence: [e],
    reopen: { evidence: [reopenedEvidence] }, savedEffect: { file: 'map.wonderdraft_map', sha256: createHash('sha256').update(raw).digest('hex') } }; };
  return { catalog, u, e, s, m, validate, proveOriginal };
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
test('complete inventory requires reviewed gate and direct initial saved/reopened sequences', () => {
  const f = fixture(); f.catalog.inventoryComplete = true; assert.equal(f.validate().valid, false);
  f.catalog.inventoryGate.state = 'passed'; f.catalog.inventoryGate.steps = [{ state: 'passed', evidence: ['review'] }];
  assert.equal(f.validate().valid, false);
  f.proveOriginal();
  assert.equal(f.validate().valid, true);
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
