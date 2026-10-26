import path from 'node:path';
import ts from 'typescript';

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
