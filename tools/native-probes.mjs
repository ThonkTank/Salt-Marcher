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
  let processControl = false;
  function scan(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression.getText(parsed);
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
  const inventory = nativeProbeInventory(process.cwd());
  console.log(JSON.stringify(inventory, null, 2));
  if (inventory.some((entry) => entry.errors.length)) process.exitCode = 1;
}
