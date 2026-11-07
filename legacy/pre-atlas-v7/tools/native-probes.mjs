import fs from 'node:fs';
import ts from 'typescript';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Exceptions name a distinct process protocol, never a weaker product pass.
export const nativeAdapters = Object.freeze({
  'test-desktop-development.mjs': {
    kind: 'adapter',
    owner: 'native-process.mjs',
    reason:
      'stdin development launcher owns normal restart; the probe observes every spawned ChildProcess',
  },
  'test-desktop-updates.mjs': {
    kind: 'adapter',
    owner: 'native-process.mjs',
    reason:
      'installed package starts its own replacement; exact PID/profile identity and an exit observer qualify that replacement',
  },
  'test-desktop-relief-prototype.mjs': {
    kind: 'historical',
    reason:
      'standalone .build/relief-r0 prototype; not the current product and not native product qualification',
  },
  'test-desktop-baseline.mjs': {
    kind: 'orchestrator',
    owner: 'native-process.mjs',
    reason: 'serial ui-session invocations; owns no Electron process',
  },
});

// Only user-visible current scenarios belong here. Output paths, diagnostic
// reopen/resume arguments, historical --before/--baseline/layout modes, and
// --refresh-reference are deliberately not automatic qualification variants.
export const nativeScenarioVariants = Object.freeze({
  'atlas-main-camera': [['--city-only'], ['--raised-floor']],
  'atlas-biome-stroke': [
    ['--library'],
    ['--earth-only'],
    ['--library', '--marsh-only'],
    ['--surface-only'],
  ],
  'atlas-navigation-terrain': [['--world-room']],
  'atlas-terrain-stroke': [
    ['--recovery'],
    ['--recovery-only'],
    ['--recovery-only', '--drop-followup'],
    ['--recovery-only', '--source-conflict'],
    ['--basic-tools'],
    ['--forms'],
    ['--multiscale'],
  ],
  'campaign-transfer-visit': [['--fail-import-atlas']],
  'combat-switch': [['--apply-rolled-damage']],
  'key-note-context': [['--nested'], ['--unlink']],
  'note-thread': [['--new-plan']],
  'player-focus': [['--cue'], ['--handout'], ['--cue', '--handout']],
  'player-blank': [
    ['--pending'],
    ['--combat'],
    ['--chase'],
    ['--combat', '--pending'],
    ['--chase', '--pending'],
  ],
  'player-scene-privacy': [['--combat'], ['--chase']],
  'reinforcement-layout': [['--assert-layout'], ['--assert-layout', '--reply-loss']],
  'room-reads': [['--regions']],
  'terrain-lakes': [['--lift']],
  'terrain-routes': [['--river-only'], ['--river-only', '--depression=2'], ['--planning-only']],
  'treasure-distribution': [['--reply-loss'], ['--reject-once']],
  'vegetation-qualification': [['--navigation-only']],
});
export const nativeScenarioEnvironments = Object.freeze({
  'atlas-cache-reopen': [['detail', { ATLAS_WAIT_DETAIL: '1' }]],
  'atlas-multiscale': [
    ['structures', { QA_STRUCTURES: '1' }],
    ['drawn', { QA_DRAWN: '1' }],
    ['exact-scale', { QA_EXACT_SCALE: '1' }],
    ['performance', { QA_PERF: '1' }],
    ['sweep', { QA_SWEEP: '1' }],
    ['export', { QA_EXPORT: '1' }],
  ],
  'terrain-live': [
    ['world', { TERRAIN_WORLD_PROBE: '1' }],
    ['covered', { TERRAIN_COVERED_PROBE: '1' }],
  ],
  'scene-selection-read': [
    ['namesakes', { GM_QA_NAMESAKES: '1' }],
    ['long-rest', { GM_QA_LONG_REST: '1' }],
    ['namesakes-long-rest', { GM_QA_NAMESAKES: '1', GM_QA_LONG_REST: '1' }],
  ],
});
export const nativeFixtureDependencies = Object.freeze({
  'note-existing-excerpts': 'note-excerpts',
  'note-source-inspection': 'note-existing-excerpts',
  'room-key-source-inspection': 'note-source-inspection',
  'scene-decision': 'room-key-source-inspection',
  'quest-review': 'scene-decision',
});
export function nativeQualificationScenarios(root) {
  const scenarios = [];
  for (const entry of nativeProbeInventory(root)) {
    if (entry.kind === 'orchestrator') continue;
    const name = path.basename(entry.file).slice('test-desktop-'.length, -4);
    const reason =
      entry.kind === 'historical'
        ? entry.reason
        : name === 'style-ownership'
          ? 'Requires an explicitly saved previously shipped stylesheet (--baseline-css); current CSS against itself is not qualification.'
          : name === 'updates'
            ? 'Requires a separately packaged matching runtime; use the package adapter with its explicit installation path.'
            : null;
    const base = {
      name,
      file: entry.file,
      kind: entry.kind,
      args: [],
      ...(reason ? { notRunReason: reason } : {}),
    };
    scenarios.push(base);
    for (const args of nativeScenarioVariants[name] ?? [])
      scenarios.push({
        ...base,
        name: name + args.map((arg) => '-' + arg.slice(2).replaceAll('=', '-')).join(''),
        args,
      });
    for (const [suffix, env] of nativeScenarioEnvironments[name] ?? [])
      scenarios.push({ ...base, name: name + '-' + suffix, env });
  }
  // Dependency order is explicit, never satisfied by an old result on disk.
  const ordered = [];
  function add(scenario) {
    if (ordered.includes(scenario)) return;
    const dependency = nativeFixtureDependencies[scenario.name];
    if (dependency) {
      scenario = { ...scenario, dependency };
      if (ordered.some((item) => item.name === scenario.name)) return;
      add(scenarios.find((item) => item.name === dependency));
    }
    if (scenario.name === 'campaign-transfer-visit-fail-import-atlas')
      scenario = {
        ...scenario,
        kind: 'negative-control',
        negativeControl: {
          error: 'Imported Atlas must never fail during opening',
          reason: 'Intentionally reject an unusable imported Atlas',
        },
      };
    if (scenario.name === 'atlas-terrain-stroke-recovery-only-drop-followup')
      scenario = {
        ...scenario,
        kind: 'negative-control',
        negativeControl: {
          check: 'closed-dependent-resumed-once-without-new-input',
          reason: 'Intentionally detect the dropped dependent gesture',
        },
      };
    ordered.push(scenario);
  }
  for (const scenario of scenarios) add(scenario);
  return ordered;
}

export function inspectNativeProbe(file, source) {
  const name = path.basename(file),
    adapter = nativeAdapters[name];
  const direct = /\b(?:_electron|electron)\.launch\s*\(/.test(source);
  const errors = [];
  if (adapter) {
    if (adapter.owner && !source.includes(`'./${adapter.owner}'`))
      errors.push('Declared adapter must use its common process owner');
    if (adapter.kind === 'orchestrator' && direct)
      errors.push('Orchestrator may not launch Electron');
    return { file, ...adapter, errors };
  }
  if (!/from ['"]\.\/native-session\.mjs['"]/.test(source))
    errors.push('Native product probe must use native-session or an explicitly reviewed adapter');
  if (direct) errors.push('Direct Electron launch bypasses native-session');
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let processControl = false,
    sessionCall = false;
  function scan(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression.getText(parsed);
      if (['runNativeProbe', 'createNativeSession'].includes(expression)) sessionCall = true;
      if (
        ['spawn', 'spawnSync', 'fork', 'app.close', 'app.exit', 'app.quit', 'app.destroy'].includes(
          expression,
        )
      )
        processControl = true;
      if (
        expression.endsWith('.kill') &&
        !(expression === 'process.kill' && node.arguments[1]?.getText(parsed) === '0')
      )
        processControl = true;
      if (expression === 'app.evaluate' && node.arguments[0]) {
        const callback = node.arguments[0].getText(parsed);
        if (/BrowserWindow/.test(callback) && /\.(?:close|destroy)\s*\(/.test(callback))
          processControl = true;
      }
    }
    ts.forEachChild(node, scan);
  }
  scan(parsed);
  if (!sessionCall) errors.push('Native product probe must call its shared session owner');
  if (processControl || /\b(?:SIGKILL|SIGTERM)\b/.test(source))
    errors.push('Probe-local process control bypasses the common lifecycle');
  return { file, kind: 'session', errors };
}
export function nativeProbeInventory(
  root,
  files = fs.readdirSync(path.join(root, 'tools')).map((name) => 'tools/' + name),
) {
  return files
    .filter((file) => /^tools\/test-desktop-.*\.mjs$/.test(file))
    .sort()
    .map((file) => inspectNativeProbe(file, fs.readFileSync(path.join(root, file), 'utf8')));
}
export function checkNativeProbes(root, files) {
  return nativeProbeInventory(root, files).flatMap((entry) =>
    entry.errors.map((error) => entry.file + ': ' + error),
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inventory = process.argv.includes('--scenarios')
    ? nativeQualificationScenarios(process.cwd())
    : nativeProbeInventory(process.cwd());
  console.log(JSON.stringify(inventory, null, 2));
  if (inventory.some((entry) => entry.errors?.length)) process.exitCode = 1;
}
