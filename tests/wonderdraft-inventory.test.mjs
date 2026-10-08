import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateInventory } from '../tools/wonderdraft/validate-inventory.mjs';

function sample() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-inventory-'));
  const screenshot = path.join(directory, 'screen.png');
  const session = path.join(directory, 'session.txt');
  fs.writeFileSync(screenshot, 'original screenshot fixture');
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
  assert.equal(validateInventory(document, { allowOpen: true }).valid, true);
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
  assert.match(errors, /doppelte oder leere UI-ID/);
  assert.match(errors, /unbekannter WD-Unterfall/);
});
