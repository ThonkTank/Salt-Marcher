import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { repositoryFiles } from './repository-files.mjs';

/** The repository boundary gate and the report analyze exactly this source selection. */
export function readModuleSources(root, files) {
  return new Map(
    files
      .filter((file) => /^(src|desktop)\/.*\.tsx?$/.test(file))
      .map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]),
  );
}

/** Preserve type-only edges for architecture review; runtime SCCs exclude them. */
export function moduleEdges(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const result = [];
  function visit(node) {
    let specifier,
      typeOnly = false;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      specifier = node.moduleSpecifier;
      const clause = ts.isImportDeclaration(node) ? node.importClause : node;
      const bindings = ts.isImportDeclaration(node) ? clause?.namedBindings : node.exportClause;
      typeOnly =
        !!clause?.isTypeOnly ||
        !!(
          bindings &&
          'elements' in bindings &&
          bindings.elements.length &&
          bindings.elements.every((e) => e.isTypeOnly)
        );
      // A default binding alongside named type imports is still a runtime dependency.
      if (ts.isImportDeclaration(node) && clause?.name && !clause.isTypeOnly) typeOnly = false;
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    )
      specifier = node.arguments[0];
    else if (ts.isExternalModuleReference(node)) {
      specifier = node.expression;
      typeOnly = !!node.parent.isTypeOnly;
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      specifier = node.argument.literal;
      typeOnly = true;
    }
    if (specifier && ts.isStringLiteralLike(specifier))
      result.push({ specifier: specifier.text, typeOnly });
    ts.forEachChild(node, visit);
  }
  visit(source);
  return result;
}
export function resolveModule(files, from, specifier) {
  if (!specifier.startsWith('.')) return specifier;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  return (
    [base, base.replace(/\.js$/, '.ts'), base + '.ts', base + '.tsx', base + '/index.ts'].find(
      (p) => files.has(p),
    ) ?? base
  );
}
export function dependencyGraph(sources, runtimeOnly = false) {
  return new Map(
    [...sources].map(([file, text]) => [
      file,
      [
        ...new Set(
          moduleEdges(file, text)
            .filter((edge) => !runtimeOnly || !edge.typeOnly)
            .map((edge) => resolveModule(sources, file, edge.specifier)),
        ),
      ],
    ]),
  );
}
export function dependencyCycles(graph) {
  let next = 0;
  const indices = new Map(),
    low = new Map(),
    stack = [],
    active = new Set(),
    result = [];
  function visit(file) {
    indices.set(file, next);
    low.set(file, next++);
    stack.push(file);
    active.add(file);
    for (const target of graph.get(file) ?? []) {
      if (!graph.has(target)) continue;
      if (!indices.has(target)) {
        visit(target);
        low.set(file, Math.min(low.get(file), low.get(target)));
      } else if (active.has(target)) low.set(file, Math.min(low.get(file), indices.get(target)));
    }
    if (low.get(file) === indices.get(file)) {
      const component = [];
      let target;
      do {
        target = stack.pop();
        active.delete(target);
        component.push(target);
      } while (target !== file);
      if (component.length > 1 || graph.get(file)?.includes(file)) result.push(component.sort());
    }
  }
  for (const file of graph.keys()) if (!indices.has(file)) visit(file);
  return result.sort((a, b) => a[0].localeCompare(b[0]));
}

/** Read-only structural inventory; this does not qualify behavior or update a baseline. */
export function moduleGraphReport(sources) {
  const sorted = new Map([...sources].sort(([a], [b]) => a.localeCompare(b)));
  const summary = (runtimeOnly) => {
    const graph = dependencyGraph(sorted, runtimeOnly);
    let internalEdges = 0,
      externalEdges = 0;
    for (const targets of graph.values())
      for (const target of targets) graph.has(target) ? internalEdges++ : externalEdges++;
    const cyclicComponents = dependencyCycles(graph).map((files) => {
      const members = new Set(files);
      return {
        files,
        internalEdges: files.reduce(
          (count, file) => count + graph.get(file).filter((target) => members.has(target)).length,
          0,
        ),
        active: files.some((file) => /^(src\/app|desktop)\//.test(file)),
      };
    });
    const active = cyclicComponents.filter((component) => component.active);
    return {
      internalEdges,
      externalEdges,
      activeCycles: {
        components: active.length,
        files: active.reduce((count, component) => count + component.files.length, 0),
        internalEdges: active.reduce((count, component) => count + component.internalEdges, 0),
      },
      cyclicComponents,
    };
  };
  return {
    scope: {
      selection:
        'Existing tracked and non-ignored untracked src/**/*.ts(x) and desktop/**/*.ts(x), including declarations',
      files: [...sorted.keys()],
      sourceSha256: createHash('sha256')
        .update(JSON.stringify([...sorted]))
        .digest('hex'),
    },
    declared: summary(false),
    values: summary(true),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.slice(2).join(' ') !== '--report') {
    console.error('Usage: node tools/module-graph.mjs --report');
    process.exitCode = 1;
  } else {
    const root = process.cwd();
    console.log(
      JSON.stringify(moduleGraphReport(readModuleSources(root, repositoryFiles(root))), null, 2),
    );
  }
}
