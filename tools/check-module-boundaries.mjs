import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import ts from 'typescript';

// Shared controls are presentation code; the remaining shared modules are domain/lifecycle code.
const sharedControls = new Set([
  'anchored-popup',
  'booking-dialog',
  'commit-confirmation',
  'markdown-view',
  'number-input-scroll',
  'textarea-position',
]);
const privileged = new Set([
  ...builtinModules.map((name) => name.replace(/^node:/, '')),
  'electron',
  'obsidian',
  'better-sqlite3',
]);
const ui = (file) =>
  /(?:-ui|renderer|preparation|live)\.tsx?$/.test(file) ||
  (file.startsWith('src/app/shared/') && sharedControls.has(path.posix.basename(file, '.ts')));

export function moduleImports(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const result = [];
  function visit(node) {
    const specifier =
      ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
        ? node.moduleSpecifier
        : ts.isCallExpression(node) &&
            (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
              (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
          ? node.arguments[0]
          : ts.isExternalModuleReference(node)
            ? node.expression
            : ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
              ? node.argument.literal
              : null;
    if (specifier && ts.isStringLiteralLike(specifier)) result.push(specifier.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return [...new Set(result)];
}

/** Inspect source edges, including type imports, lazy imports and re-exports. */
function usesPresentationGlobals(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  let found = false;
  function visit(node) {
    if (
      (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
      ts.isIdentifier(node.expression) &&
      ['document', 'window'].includes(node.expression.text)
    ) {
      let bound = false;
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (
          ts.isFunctionLike(parent) &&
          parent.parameters.some(
            (parameter) =>
              ts.isIdentifier(parameter.name) && parameter.name.text === node.expression.text,
          )
        )
          bound = true;
      }
      if (!bound) found = true;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return found;
}

export function checkModuleBoundaries(sources) {
  const presentation = new Set(
    [...sources]
      .filter(([file, text]) => ui(file) || usesPresentationGlobals(file, text))
      .map(([file]) => file),
  );
  const graph = new Map([...sources].map(([file, text]) => [file, moduleImports(file, text)]));
  const resolve = (from, specifier) => {
    if (!specifier.startsWith('.')) return specifier;
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
    return (
      [base, base + '.ts', base + '.tsx', base + '/index.ts'].find((p) => graph.has(p)) ?? base
    );
  };
  const errors = new Set();
  function check(start, rule, forbidden) {
    const visited = new Set();
    function walk(file, chain) {
      if (visited.has(file)) return;
      visited.add(file);
      for (const specifier of graph.get(file) ?? []) {
        const target = resolve(file, specifier),
          next = [...chain, target];
        if (forbidden(target)) errors.add(`${rule}: ${next.join(' -> ')}`);
        else walk(target, next);
      }
    }
    walk(start, [start]);
  }
  for (const file of graph.keys()) {
    if (/^(src\/app|desktop)\//.test(file))
      check(
        file,
        'Active code imports historical adapter',
        (target) => target.startsWith('src/legacy/') || target === 'obsidian',
      );
    if (file.startsWith('src/app/shared/') && !ui(file))
      check(
        file,
        'Shared logic imports presentation',
        (target) => ui(target) || presentation.has(target),
      );
  }
  for (const entry of ['src/app/workspace/renderer.ts', 'src/app/runtime/player-display.ts'])
    check(
      entry,
      'Renderer crosses privileged boundary',
      (target) =>
        target.startsWith('node:') ||
        target.startsWith('src/app/storage/') ||
        target.startsWith('desktop/') ||
        privileged.has(target.replace(/^node:/, '').split('/')[0]),
    );
  return [...errors];
}

export function checkSourceModuleBoundaries(root, files) {
  const sources = new Map(
    files
      .filter((file) => /^(src|desktop)\/.*\.tsx?$/.test(file))
      .map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]),
  );
  return checkModuleBoundaries(sources);
}
