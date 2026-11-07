import path from 'node:path';
import ts from 'typescript';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
const native = new Set([
  ...builtinModules.map((x) => x.replace(/^node:/, '')),
  'electron',
  'better-sqlite3',
  'obsidian',
]);
/** Vendor declarations may mention Node. Own browser sources must never use that capability. */
export function browserCapabilityDiagnostics(program, root = process.cwd()) {
  const checker = program.getTypeChecker(),
    errors = [];
  const nodeDeclaration = (d) =>
    /\/node_modules\/@types\/node\//.test(d.getSourceFile().fileName.replaceAll('\\', '/'));
  for (const source of program.getSourceFiles()) {
    const relative = path.relative(root, source.fileName).replaceAll('\\', '/');
    if (
      source.isDeclarationFile ||
      relative.startsWith('../') ||
      relative.includes('node_modules/')
    )
      continue;
    const report = (node, message) =>
      errors.push({
        file: source,
        start: node.getStart(source),
        length: node.getWidth(source),
        category: ts.DiagnosticCategory.Error,
        code: 95001,
        messageText: message,
      });
    function checkSymbol(node, symbol) {
      if (!symbol) return;
      const declarations = symbol.declarations ?? [];
      if (declarations.length && declarations.every(nodeDeclaration))
        report(node, 'Browser code uses a Node capability: ' + node.getText(source));
    }
    function visit(node) {
      if (ts.isIdentifier(node)) checkSymbol(node, checker.getSymbolAtLocation(node));
      if (ts.isElementAccessExpression(node)) {
        const argument = node.argumentExpression;
        if (ts.isStringLiteralLike(argument))
          checkSymbol(
            argument,
            checker.getTypeAtLocation(node.expression).getProperty(argument.text),
          );
        else if (
          ts.isIdentifier(node.expression) &&
          ['globalThis', 'window', 'self'].includes(node.expression.text)
        )
          report(node, 'Dynamic global capability lookup is not allowed in browser code.');
      }
      let specifier;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        specifier = node.moduleSpecifier;
      else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
        specifier = node.argument.literal;
      else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          node.expression.getText(source) === 'require')
      )
        specifier = node.arguments[0];
      if (
        specifier &&
        ts.isStringLiteralLike(specifier) &&
        (specifier.text.startsWith('node:') || native.has(specifier.text.split('/')[0]))
      )
        report(specifier, 'Browser code imports a native capability: ' + specifier.text);
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return errors;
}
export function environmentProgram(configFile) {
  const config = ts.readConfigFile(configFile, ts.sys.readFile);
  if (config.error) throw Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(path.resolve(configFile)),
  );
  if (parsed.errors.length)
    throw Error(ts.formatDiagnosticsWithColorAndContext(parsed.errors, diagnosticHost));
  return ts.createProgram(parsed.fileNames, parsed.options);
}
export const diagnosticHost = {
  getCanonicalFileName: (f) => f,
  getCurrentDirectory: () => process.cwd(),
  getNewLine: () => '\n',
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = process.argv[2] ?? 'tsconfig.renderer.json',
    program = environmentProgram(config);
  const errors = [...ts.getPreEmitDiagnostics(program), ...browserCapabilityDiagnostics(program)];
  if (errors.length) {
    console.error(ts.formatDiagnosticsWithColorAndContext(errors, diagnosticHost));
    process.exitCode = 1;
  } else console.log(config + ': complete type and browser capability check passed.');
}
