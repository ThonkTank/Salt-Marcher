import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, normalize, resolve } from 'node:path'
import ts from 'typescript'

export type TypeScriptImport = Readonly<{
  specifier: string
  kind: 'static' | 'dynamic'
  typeOnly: boolean
  bindings: readonly Readonly<{ imported: string; local: string }>[]
}>

export type TypeScriptModule = Readonly<{
  path: string
  imports: readonly TypeScriptImport[]
  calls: readonly string[]
  constructions: readonly string[]
  propertyAccesses: readonly string[]
  identifiers: ReadonlySet<string>
  jsxTags: readonly string[]
  jsxAttributeNames: readonly string[]
  jsxText: readonly string[]
  jsxStringAttributes: readonly Readonly<{ name: string; value: string }>[]
  stringLiterals: readonly string[]
  declarations: ReadonlySet<string>
  exportedDeclarations: ReadonlySet<string>
  objectProperties: readonly string[]
  objectLiteralValues: readonly Readonly<{
    name: string
    value: string | number | boolean | null
  }>[]
  nestedElementAccessRoots: readonly string[]
  typeProperties: readonly Readonly<{ name: string; optional: boolean }>[]
  scopes: readonly TypeScriptScope[]
}>

export type TypeScriptScope = Readonly<{
  name: string
  calls: readonly string[]
  constructions: readonly string[]
  propertyAccesses: readonly string[]
  identifiers: ReadonlySet<string>
  stringLiterals: readonly string[]
}>

export function codeFiles(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((name) => {
      const path = `${directory}/${name}`
      return statSync(path).isDirectory() ? codeFiles(path) : [path]
    })
    .filter((path) => /\.[cm]?[jt]sx?$/.test(path))
}

export function readTypeScriptModule(path: string): TypeScriptModule {
  return parseTypeScriptModule(path, readFileSync(path, 'utf8'))
}

export function parseTypeScriptModule(
  path: string,
  content: string
): TypeScriptModule {
  const tree = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const imports: TypeScriptImport[] = []
  const calls: string[] = []
  const constructions: string[] = []
  const propertyAccesses: string[] = []
  const identifiers = new Set<string>()
  const jsxTags: string[] = []
  const jsxAttributeNames: string[] = []
  const jsxText: string[] = []
  const jsxStringAttributes: { name: string; value: string }[] = []
  const stringLiterals: string[] = []
  const declarations = new Set<string>()
  const exportedDeclarations = new Set<string>()
  const objectProperties: string[] = []
  const objectLiteralValues: {
    name: string
    value: string | number | boolean | null
  }[] = []
  const nestedElementAccessRoots: string[] = []
  const typeProperties: { name: string; optional: boolean }[] = []
  const scopes: TypeScriptScope[] = []

  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      imports.push({
        specifier: node.moduleSpecifier.text,
        kind: 'static',
        typeOnly: node.importClause?.isTypeOnly ?? false,
        bindings: importBindings(node.importClause)
      })
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      imports.push({
        specifier: node.moduleSpecifier.text,
        kind: 'static',
        typeOnly: node.isTypeOnly,
        bindings:
          node.exportClause && ts.isNamedExports(node.exportClause)
            ? node.exportClause.elements.map((element) => ({
                imported: element.propertyName?.text ?? element.name.text,
                local: element.name.text
              }))
            : []
      })
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      imports.push({
        specifier: node.arguments[0].text,
        kind: 'dynamic',
        typeOnly: false,
        bindings: []
      })
    if (ts.isCallExpression(node)) calls.push(expressionPath(node.expression))
    if (ts.isNewExpression(node))
      constructions.push(expressionPath(node.expression))
    if (ts.isPropertyAccessExpression(node))
      propertyAccesses.push(expressionPath(node))
    if (ts.isIdentifier(node)) identifiers.add(node.text)
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      jsxTags.push(node.tagName.getText(tree))
      for (const attribute of node.attributes.properties)
        if (ts.isJsxAttribute(attribute)) {
          jsxAttributeNames.push(attribute.name.getText(tree))
          if (
            attribute.initializer &&
            ts.isStringLiteral(attribute.initializer)
          )
            jsxStringAttributes.push({
              name: attribute.name.getText(tree),
              value: attribute.initializer.text
            })
        }
    }
    if (ts.isJsxText(node) && node.text.trim().length > 0)
      jsxText.push(node.text.trim())
    if (ts.isStringLiteralLike(node)) stringLiterals.push(node.text)
    if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node))
      objectProperties.push(propertyName(node.name, tree))
    if (ts.isPropertyAssignment(node)) {
      const value = primitiveLiteral(node.initializer)
      if (value !== undefined)
        objectLiteralValues.push({ name: propertyName(node.name, tree), value })
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isElementAccessExpression(node.expression)
    )
      nestedElementAccessRoots.push(rootExpressionName(node.expression))
    if (ts.isPropertySignature(node))
      typeProperties.push({
        name: propertyName(node.name, tree),
        optional: node.questionToken !== undefined
      })
    const declaration = declarationName(node)
    if (declaration) {
      declarations.add(declaration)
      if (hasExportModifier(node)) exportedDeclarations.add(declaration)
    }
    if (isNamedFunctionLike(node)) scopes.push(readScope(node))
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return {
    path,
    imports,
    calls,
    constructions,
    propertyAccesses,
    identifiers,
    jsxTags,
    jsxAttributeNames,
    jsxText,
    jsxStringAttributes,
    stringLiterals,
    declarations,
    exportedDeclarations,
    objectProperties,
    objectLiteralValues,
    nestedElementAccessRoots,
    typeProperties,
    scopes
  }
}

export function scope(
  module: TypeScriptModule,
  name: string
): TypeScriptScope | undefined {
  return module.scopes.find((entry) => entry.name === name)
}

export function hasImport(
  module: TypeScriptModule,
  specifier: string,
  kind?: TypeScriptImport['kind']
): boolean {
  return module.imports.some(
    (entry) => entry.specifier === specifier && (!kind || entry.kind === kind)
  )
}

export function importedBindings(
  module: TypeScriptModule,
  specifier: string
): readonly string[] {
  return module.imports
    .filter((entry) => entry.specifier === specifier)
    .flatMap((entry) => entry.bindings.map(({ imported }) => imported))
}

export function hasCall(module: TypeScriptModule, path: string): boolean {
  return module.calls.some((call) => call === path || call.endsWith(`.${path}`))
}

export function callCount(module: TypeScriptModule, path: string): number {
  return module.calls.filter(
    (call) => call === path || call.endsWith(`.${path}`)
  ).length
}

export function relativeImportGraph(
  paths: readonly string[]
): ReadonlyMap<string, readonly string[]> {
  const normalized = paths.map((path) => normalize(resolve(path)))
  const known = new Set(normalized)
  return new Map(
    normalized.map((path) => {
      const module = readTypeScriptModule(path)
      const dependencies = module.imports
        .filter(({ specifier }) => specifier.startsWith('.'))
        .map(({ specifier }) => resolveImport(path, specifier))
        .filter((dependency) => known.has(dependency))
      return [path, dependencies]
    })
  )
}

export function importCycles(
  graph: ReadonlyMap<string, readonly string[]>
): readonly (readonly string[])[] {
  const completed = new Set<string>()
  const active: string[] = []
  const cycles: string[][] = []
  const walk = (path: string): void => {
    const activeIndex = active.indexOf(path)
    if (activeIndex >= 0) {
      cycles.push([...active.slice(activeIndex), path])
      return
    }
    if (completed.has(path)) return
    active.push(path)
    for (const dependency of graph.get(path) ?? []) walk(dependency)
    active.pop()
    completed.add(path)
  }
  for (const path of graph.keys()) walk(path)
  return cycles
}

function importBindings(
  clause: ts.ImportClause | undefined
): readonly Readonly<{ imported: string; local: string }>[] {
  if (!clause) return []
  const bindings: { imported: string; local: string }[] = []
  if (clause.name)
    bindings.push({ imported: 'default', local: clause.name.text })
  if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings))
    bindings.push({ imported: '*', local: clause.namedBindings.name.text })
  if (clause.namedBindings && ts.isNamedImports(clause.namedBindings))
    for (const element of clause.namedBindings.elements)
      bindings.push({
        imported: element.propertyName?.text ?? element.name.text,
        local: element.name.text
      })
  return bindings
}

function expressionPath(node: ts.Expression): string {
  if (ts.isIdentifier(node)) return node.text
  if (ts.isPropertyAccessExpression(node))
    return `${expressionPath(node.expression)}.${node.name.text}`
  if (ts.isElementAccessExpression(node) && node.argumentExpression)
    return `${expressionPath(node.expression)}.${node.argumentExpression.getText()}`
  return node.getText()
}

function declarationName(node: ts.Node): string | null {
  if (
    (ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node)) &&
    node.name
  )
    return node.name.text
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name))
    return node.name.text
  return null
}

function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node)
    ? (ts
        .getModifiers(node)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ??
        false)
    : false
}

function propertyName(node: ts.PropertyName, tree: ts.SourceFile): string {
  return ts.isIdentifier(node) || ts.isStringLiteralLike(node)
    ? node.text
    : node.getText(tree)
}

function resolveImport(path: string, specifier: string): string {
  const stem = normalize(resolve(dirname(path), specifier.replace(/\.js$/, '')))
  return (
    [`${stem}.ts`, `${stem}.tsx`, `${stem}.mts`, `${stem}.cts`, stem].find(
      existsSync
    ) ?? stem
  )
}

function primitiveLiteral(
  node: ts.Expression
): string | number | boolean | null | undefined {
  if (ts.isStringLiteralLike(node)) return node.text
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (node.kind === ts.SyntaxKind.NullKeyword) return null
  return undefined
}

function rootExpressionName(node: ts.Expression): string {
  if (ts.isIdentifier(node)) return node.text
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
    return rootExpressionName(node.expression)
  return node.getText()
}

function isNamedFunctionLike(
  node: ts.Node
): node is
  | ts.FunctionDeclaration
  | ts.MethodDeclaration
  | ts.ArrowFunction
  | ts.FunctionExpression {
  return (
    (ts.isFunctionDeclaration(node) && node.name !== undefined) ||
    (ts.isMethodDeclaration(node) && node.name !== undefined) ||
    ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
      ts.isVariableDeclaration(node.parent) &&
      ts.isIdentifier(node.parent.name))
  )
}

function readScope(
  node:
    | ts.FunctionDeclaration
    | ts.MethodDeclaration
    | ts.ArrowFunction
    | ts.FunctionExpression
): TypeScriptScope {
  const calls: string[] = []
  const constructions: string[] = []
  const propertyAccesses: string[] = []
  const identifiers = new Set<string>()
  const stringLiterals: string[] = []
  const visit = (child: ts.Node): void => {
    if (child !== node && ts.isFunctionLike(child)) return
    if (ts.isCallExpression(child)) calls.push(expressionPath(child.expression))
    if (ts.isNewExpression(child))
      constructions.push(expressionPath(child.expression))
    if (ts.isPropertyAccessExpression(child))
      propertyAccesses.push(expressionPath(child))
    if (ts.isIdentifier(child)) identifiers.add(child.text)
    if (ts.isStringLiteralLike(child)) stringLiterals.push(child.text)
    ts.forEachChild(child, visit)
  }
  visit(node)
  const name =
    (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) &&
    node.name
      ? node.name.getText()
      : ts.isVariableDeclaration(node.parent) &&
          ts.isIdentifier(node.parent.name)
        ? node.parent.name.text
        : '<anonymous>'
  return {
    name,
    calls,
    constructions,
    propertyAccesses,
    identifiers,
    stringLiterals
  }
}
