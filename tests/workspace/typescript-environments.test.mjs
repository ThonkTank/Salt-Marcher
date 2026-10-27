import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import ts from 'typescript';
import { browserCapabilityDiagnostics } from '../../tools/check-environment-capabilities.mjs';

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
    const config = ts.readConfigFile(`tsconfig.${environment}.json`, ts.sys.readFile);
    assert.equal(config.error, undefined);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
    assert.deepEqual(parsed.errors, []);
    const probe = path.resolve('.build/environment-probe.ts');
    const text = [...allowed, ...forbidden].map((name) => `${name};`).join('\n') + '\nexport {};';
    const host = ts.createCompilerHost(parsed.options),
      getSource = host.getSourceFile.bind(host);
    host.getSourceFile = (file, ...args) =>
      file === probe
        ? ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
        : getSource(file, ...args);
    const program = ts.createProgram([...parsed.fileNames, probe], parsed.options, host);
    const diagnostics = [
      ...ts.getPreEmitDiagnostics(program),
      ...(environment === 'renderer' ? browserCapabilityDiagnostics(program) : []),
    ];
    assert.deepEqual(
      diagnostics
        .filter((d) => d.file?.fileName !== probe)
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')),
      [],
    );
    assert.deepEqual(
      diagnostics.map((d) => d.file.text.slice(d.start, d.start + d.length)).sort(),
      [...forbidden].sort(),
    );
    assert(diagnostics.every((d) => [2304, 2580, 2584, 2591, 95001].includes(d.code)));
  });

test('every desktop build entry is included in its production environment check', async () => {
  const { desktopEntryEnvironments } = await import('../../tools/desktop-entry-environments.mjs');
  for (const [entry, environment] of Object.entries(desktopEntryEnvironments)) {
    const config = ts.readConfigFile(`tsconfig.${environment}.json`, ts.sys.readFile);
    assert(config.config.files.includes(entry), `${entry} missing from ${environment}`);
  }
});

test('vendor Node declarations cannot authorize direct, aliased or indexed browser capabilities', () => {
  const config = ts.readConfigFile('tsconfig.renderer.json', ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
  const probe = path.resolve('.build/capability-probe.ts');
  const text = [
    'process.cwd();',
    "Buffer.from('x');",
    'const p=globalThis.process; p.cwd();',
    "globalThis['Buffer'].from('x');",
    'const {process: alias}=globalThis; alias.cwd();',
    "import fs from 'node:fs'; fs.readFileSync('x');",
    'export {};',
  ].join('\n');
  const host = ts.createCompilerHost(parsed.options),
    getSource = host.getSourceFile.bind(host);
  host.getSourceFile = (file, ...args) =>
    file === probe
      ? ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
      : getSource(file, ...args);
  const program = ts.createProgram([...parsed.fileNames, probe], parsed.options, host);
  const errors = browserCapabilityDiagnostics(program).filter((d) => d.file.fileName === probe);
  for (let line = 0; line < 6; line++)
    assert(
      errors.some((d) => d.file.getLineAndCharacterOfPosition(d.start).line === line),
      `capability bypass on probe line ${line + 1}`,
    );
  assert.equal(
    browserCapabilityDiagnostics(program).filter((d) => d.file.fileName !== probe).length,
    0,
  );
});
