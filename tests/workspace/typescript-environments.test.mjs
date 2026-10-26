import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import ts from 'typescript';

// Use the production configs and their full transitive closure. A dependency
// that leaks a forbidden global will make the expected diagnostic disappear.
for (const [environment, allowed, forbidden] of [
  ['renderer', ['document', 'window', 'AbortController'], ['process', 'Buffer', 'require']],
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
  test(`${environment} compiler scope accepts its capabilities and rejects foreign globals`, () => {
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
    const diagnostics = ts.getPreEmitDiagnostics(program);
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
    assert(diagnostics.every((d) => [2304, 2580, 2584, 2591].includes(d.code)));
  });
