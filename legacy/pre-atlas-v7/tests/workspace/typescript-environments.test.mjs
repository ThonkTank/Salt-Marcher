import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import ts from 'typescript';
import { browserCapabilityDiagnostics } from '../../tools/check-environment-capabilities.mjs';

// Both renderer probes use the same production closure and compiler options.
// Check it once, retaining only the observed capability errors for the second
// assertion group; no Program, checker or mutable compiler host is shared.
const capabilityProbe = path.resolve('.build/capability-probe.ts');
const capabilityText = [
  'process.cwd();',
  "Buffer.from('x');",
  'const p=globalThis.process; p.cwd();',
  "globalThis['Buffer'].from('x');",
  'const {process: alias}=globalThis; alias.cwd();',
  "import fs from 'node:fs'; fs.readFileSync('x');",
  'export {};',
].join('\n');
let rendererObservation;

// Use the production configs and their full transitive closure. A dependency
// that leaks a forbidden global cannot authorize its use in own browser sources.
for (const [environment, allowed, forbidden] of [
  ['renderer', ['document', 'window', 'AbortController'], ['process', 'Buffer', 'require']],
  [
    'browser-worker',
    ['self', 'postMessage', 'AbortController'],
    ['document', 'window', 'process', 'Buffer', 'require'],
  ],
  [
    'worker',
    ['process', 'Buffer', 'AbortController'],
    ['document', 'window', 'CanvasRenderingContext2D', 'SVGElement', 'self'],
  ],
  [
    'host',
    ['process', 'Buffer', 'AbortController'],
    ['document', 'window', 'CanvasRenderingContext2D', 'SVGElement', 'self'],
  ],
  [
    'domain',
    ['JSON', 'Promise', 'Map'],
    ['process', 'Buffer', 'document', 'window', 'CanvasRenderingContext2D', 'SVGElement', 'self'],
  ],
])
  test(`${environment} compiler/capability scope accepts its capabilities and rejects foreign globals`, () => {
    const observed = compileEnvironment(environment, allowed, forbidden);
    assert.deepEqual(observed.sourceErrors, []);
    assert.deepEqual(observed.names, [...forbidden].sort());
    assert(observed.codes.every((code) => [2304, 2580, 2584, 2591, 95001].includes(code)));
  });

function compileEnvironment(environment, allowed, forbidden) {
  if (environment === 'renderer' && rendererObservation) return rendererObservation;
  const config = ts.readConfigFile(`tsconfig.${environment}.json`, ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
  assert.deepEqual(parsed.errors, []);
  const probe = path.resolve('.build/environment-probe.ts');
  const text = [...allowed, ...forbidden].map((name) => `${name};`).join('\n') + '\nexport {};';
  const host = ts.createCompilerHost(parsed.options),
    getSource = host.getSourceFile.bind(host);
  host.getSourceFile = (file, ...args) =>
    file === probe || (environment === 'renderer' && file === capabilityProbe)
      ? ts.createSourceFile(
          file,
          file === probe ? text : capabilityText,
          ts.ScriptTarget.Latest,
          true,
        )
      : getSource(file, ...args);
  const roots = [
    ...parsed.fileNames,
    probe,
    ...(environment === 'renderer' ? [capabilityProbe] : []),
  ];
  const program = ts.createProgram(roots, parsed.options, host);
  const capabilities = environment === 'renderer' ? browserCapabilityDiagnostics(program) : [];
  const diagnostics = [...ts.getPreEmitDiagnostics(program), ...capabilities].filter(
    (d) => d.file?.fileName !== capabilityProbe,
  );
  const observed = {
    sourceErrors: diagnostics
      .filter((d) => d.file?.fileName !== probe)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')),
    names: diagnostics.map((d) => d.file.text.slice(d.start, d.start + d.length)).sort(),
    codes: diagnostics.map((d) => d.code),
    capabilityLines: capabilities
      .filter((d) => d.file.fileName === capabilityProbe)
      .map((d) => d.file.getLineAndCharacterOfPosition(d.start).line),
  };
  if (environment === 'renderer') rendererObservation = observed;
  return observed;
}

test('every desktop build entry is included in its production environment check', async () => {
  const { desktopEntryEnvironments } = await import('../../tools/desktop-entry-environments.mjs');
  for (const [entry, environment] of Object.entries(desktopEntryEnvironments)) {
    const config = ts.readConfigFile(`tsconfig.${environment}.json`, ts.sys.readFile);
    assert(config.config.files.includes(entry), `${entry} missing from ${environment}`);
  }
});

test('vendor Node declarations cannot authorize direct, aliased or indexed browser capabilities', () => {
  const observed = compileEnvironment(
    'renderer',
    ['document', 'window', 'AbortController'],
    ['process', 'Buffer', 'require'],
  );
  assert.deepEqual(observed.sourceErrors, []);
  for (let line = 0; line < 6; line++)
    assert(observed.capabilityLines.includes(line), `capability bypass on probe line ${line + 1}`);
});
