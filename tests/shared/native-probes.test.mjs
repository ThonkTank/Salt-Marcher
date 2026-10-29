import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectNativeProbe,
  nativeProbeInventory,
  nativeQualificationScenarios,
} from '../../tools/native-probes.mjs';
test('every current native entry has a classified process owner', () => {
  const entries = nativeProbeInventory(process.cwd());
  assert(entries.length > 0);
  assert.deepEqual(
    entries.filter((entry) => entry.errors.length),
    [],
  );
  assert.equal(entries.filter((entry) => entry.kind === 'historical').length, 1);
});
test('unregistered direct starters and local cleanup cannot silently enter product qualification', () => {
  assert(
    inspectNativeProbe('tools/test-desktop-new.mjs', 'await _electron.launch({});').errors.length,
  );
  assert(
    inspectNativeProbe(
      'tools/test-desktop-new.mjs',
      "import {createNativeSession} from './native-session.mjs'; await app.close();",
    ).errors.length,
  );
  assert.deepEqual(
    inspectNativeProbe(
      'tools/test-desktop-new.mjs',
      "import {runNativeProbe} from './native-session.mjs'; await runNativeProbe();",
    ).errors,
    [],
  );
});
test('baseline wrappers require their registered process owner', () => {
  assert(
    inspectNativeProbe('tools/test-desktop-baseline.mjs', 'spawn(command,args)').errors.length,
  );
  assert.deepEqual(
    inspectNativeProbe(
      'tools/test-desktop-baseline.mjs',
      "import {stopOwnedChild} from './native-process.mjs'; spawn(command,args)",
    ).errors,
    [],
  );
});

test('special protocols require their shared process primitives; historical status is explicit', () => {
  assert(
    inspectNativeProbe('tools/test-desktop-updates.mjs', 'await _electron.launch({});').errors
      .length,
  );
  assert.equal(
    inspectNativeProbe('tools/test-desktop-relief-prototype.mjs', 'await _electron.launch({});')
      .kind,
    'historical',
  );
  assert(
    inspectNativeProbe('tools/test-desktop-baseline.mjs', 'await _electron.launch({});').errors
      .length,
  );
});

test('an unused session import cannot mask independent child spawning or termination', () => {
  const imported = "import {runNativeProbe} from './native-session.mjs';\n";
  for (const control of [
    'spawn(executable,args)',
    'spawnSync(executable,args)',
    'fork(file)',
    'child.kill()',
    'process.kill(pid, 15)',
    'app.evaluate(({app})=>app.exit(0))',
    'app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close())',
  ])
    assert(
      inspectNativeProbe('tools/test-desktop-unowned.mjs', imported + control).errors.length,
      control,
    );
  assert.deepEqual(
    inspectNativeProbe(
      'tools/test-desktop-owned.mjs',
      imported + 'await runNativeProbe(); assert.throws(()=>process.kill(pid,0))',
    ).errors,
    [],
  );
});

test('qualification covers each current entry and separates current variants from historical comparison modes', () => {
  const entries = nativeProbeInventory(process.cwd());
  const scenarios = nativeQualificationScenarios(process.cwd());
  assert.equal(new Set(scenarios.map((item) => item.name)).size, scenarios.length);
  for (const entry of entries.filter((item) => item.kind !== 'orchestrator'))
    assert(
      scenarios.some((item) => item.file === entry.file && item.args.length === 0),
      entry.file,
    );
  for (const name of [
    'player-focus-cue-handout',
    'room-reads-regions',
    'player-blank-combat-pending',
    'scene-selection-read-namesakes-long-rest',
  ])
    assert(
      scenarios.some((item) => item.name === name),
      name,
    );
  for (const scenario of scenarios) {
    assert(
      !scenario.args.some((arg) =>
        ['--before', '--baseline', '--refresh-reference', '--zoom=2'].includes(arg),
      ),
    );
    if (scenario.dependency)
      assert(
        scenarios.findIndex((item) => item.name === scenario.dependency) <
          scenarios.indexOf(scenario),
      );
  }
  assert(scenarios.find((item) => item.name === 'relief-prototype').notRunReason);
  assert(scenarios.find((item) => item.name === 'updates').notRunReason);
  assert(scenarios.find((item) => item.name === 'style-ownership').notRunReason);
});

test('unused ownership imports and meaningless variants cannot claim qualification', () => {
  assert(
    inspectNativeProbe(
      'tools/test-desktop-unused.mjs',
      "import {runNativeProbe} from './native-session.mjs';",
    ).errors.length,
  );
  const scenarios = nativeQualificationScenarios(process.cwd());
  assert(!scenarios.some((row) => row.name === 'atlas-main-camera-city-only-raised-floor'));
  assert.deepEqual(
    scenarios.find((row) => row.name === 'atlas-biome-stroke-library-marsh-only').args,
    ['--library', '--marsh-only'],
  );
  const controls = scenarios.filter((row) => row.kind === 'negative-control');
  assert.deepEqual(controls.map((row) => row.name).sort(), [
    'atlas-terrain-stroke-recovery-only-drop-followup',
    'campaign-transfer-visit-fail-import-atlas',
  ]);
  assert(controls.every((row) => row.negativeControl.reason));
});
