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

// Run the real named coordinator in a controlled host, independently of layout.
export function sourceFunctions(source, names) {
  const file = parse(source);
  return names
    .map((name) => {
      const matches = file.statements.filter(
        (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
      );
      assert.equal(matches.length, 1, `Expected one top-level function ${name}`);
      assert(matches[0].body, `Expected an implementation for ${name}`);
      return matches[0].getText(file);
    })
    .join('\n');
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
