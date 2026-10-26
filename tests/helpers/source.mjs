import assert from 'node:assert/strict';
import ts from 'typescript';

function parse(source) {
  const file = ts.createSourceFile(
    'probe.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  assert.equal(file.parseDiagnostics.length, 0, 'probe source must parse');
  return file;
}

// Replace only the requested import binding; strings, comments and calls stay intact.
export function aliasSourceImport(source, moduleName, imported, localName) {
  const file = parse(source),
    matches = [];
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== moduleName)
      continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const binding of bindings.elements) {
      if ((binding.propertyName ?? binding.name).text === imported) matches.push(binding);
    }
  }
  assert.equal(matches.length, 1, `Expected one import of ${imported} from ${moduleName}`);
  const binding = matches[0];
  return (
    source.slice(0, binding.getStart(file)) +
    `${binding.isTypeOnly ? 'type ' : ''}${imported} as ${localName}` +
    source.slice(binding.end)
  );
}

// Read literal form markup without depending on assignment spacing or quote style.
export function sourceAssignedLiteral(source, propertyPath) {
  const file = parse(source),
    matches = [];
  function path(node) {
    if (ts.isPropertyAccessExpression(node)) return `${path(node.expression)}.${node.name.text}`;
    if (ts.isIdentifier(node)) return node.text;
    return node.kind === ts.SyntaxKind.ThisKeyword ? 'this' : '';
  }
  function visit(node) {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      path(node.left) === propertyPath
    )
      matches.push(node.right);
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.equal(matches.length, 1, `Expected one assignment to ${propertyPath}`);
  const value = matches[0];
  assert(
    ts.isNoSubstitutionTemplateLiteral(value) || ts.isStringLiteral(value),
    `Expected literal markup for ${propertyPath}`,
  );
  return value.text;
}
