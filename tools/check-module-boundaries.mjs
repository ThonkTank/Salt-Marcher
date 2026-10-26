import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import ts from 'typescript';
import { moduleEdges, dependencyGraph, dependencyCycles } from './module-graph.mjs';
import { responsibility, rendererEntries } from './module-responsibilities.mjs';
const cycleBaseline = JSON.parse(
  fs.readFileSync(new URL('./module-cycle-baseline.json', import.meta.url), 'utf8'),
);

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
const ui = (file) => {
  const owner = responsibility(file);
  if (owner) return owner.kind === 'presentation';
  return (
    /(?:-ui|renderer|preparation|live)\.tsx?$/.test(file) ||
    (file.startsWith('src/app/shared/') && sharedControls.has(path.posix.basename(file, '.ts')))
  );
};

export function moduleImports(file, text) {
  return [...new Set(moduleEdges(file, text).map((edge) => edge.specifier))];
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
      .filter(
        ([file, text]) =>
          ui(file) || (!responsibility(file) && usesPresentationGlobals(file, text)),
      )
      .map(([file]) => file),
  );
  const graph = dependencyGraph(sources);
  const errors = new Set();
  function check(start, rule, forbidden) {
    const visited = new Set();
    function walk(file, chain) {
      if (visited.has(file)) return;
      visited.add(file);
      for (const target of graph.get(file) ?? []) {
        const next = [...chain, target];
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
  for (const entry of rendererEntries)
    check(
      entry,
      'Renderer crosses privileged boundary',
      (target) =>
        target.startsWith('node:') ||
        target.startsWith('src/app/storage/') ||
        target.startsWith('desktop/') ||
        privileged.has(target.replace(/^node:/, '').split('/')[0]),
    );
  for (const file of graph.keys()) {
    const owner = responsibility(file);
    if (owner?.kind === 'domain' && usesPresentationGlobals(file, sources.get(file)))
      errors.add(`Domain owner uses presentation globals: ${file}`);
    if (owner?.kind === 'domain')
      check(
        file,
        'Domain owner imports a capability',
        (target) =>
          ['presentation', 'storage', 'host'].includes(responsibility(target)?.kind) ||
          presentation.has(target) ||
          target.startsWith('node:') ||
          privileged.has(target),
      );
    if (owner?.kind === 'storage')
      check(file, 'Storage imports presentation or native host', (target) =>
        ['host', 'presentation'].includes(responsibility(target)?.kind),
      );
  }
  for (const [kind, edges] of [
    ['declared', graph],
    ['values', dependencyGraph(sources, true)],
  ]) {
    for (const cycle of dependencyCycles(edges)) {
      if (!cycle.some((file) => /^(src\/app|desktop)\//.test(file))) continue;
      for (const from of cycle)
        for (const to of edges.get(from))
          if (cycle.includes(to) && !cycleBaseline[kind][from]?.includes(to))
            errors.add(`New cyclic dependency: ${from} -> ${to} (${kind})`);
    }
  }
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
