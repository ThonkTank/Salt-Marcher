import ts from 'typescript'

export type RuntimeRegistryViolation = Readonly<{
  path: string
  line: number
  code:
    | 'central_operation_definition'
    | 'missing_registry_composition'
    | 'inline_utility_function'
    | 'missing_utility_owner_import'
    | 'missing_completeness_assertion'
}>

const utilityOwnerImports = new Set([
  './domain-events.js',
  './domain-scheduling.js',
  './runtime-dispatcher.js'
])

/** Semantic gate for the single registry and declarative Utility root. */
export function runtimeRegistryBoundaryViolations(
  sources: Readonly<Record<string, string>>
): readonly RuntimeRegistryViolation[] {
  const violations: RuntimeRegistryViolation[] = []
  for (const [path, content] of Object.entries(sources)) {
    const tree = ts.createSourceFile(
      path,
      content,
      ts.ScriptTarget.Latest,
      true,
      path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    )
    if (path.endsWith('/shared/contracts/operations.ts'))
      inspectRegistryRoot(path, tree, violations)
    if (path.endsWith('/utility/application.ts'))
      inspectUtilityRoot(path, tree, violations)
    if (path.endsWith('/preload/capability-bridge/index.ts'))
      requireCompletenessAssertion(path, tree, violations)
  }
  return violations
}

function inspectRegistryRoot(
  path: string,
  tree: ts.SourceFile,
  violations: RuntimeRegistryViolation[]
): void {
  let composesRegistry = false
  walk(tree, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'composeOperationDefinitions'
    )
      composesRegistry = true
    if (
      ts.isPropertyAssignment(node) &&
      ts.isStringLiteral(node.name) &&
      /^[A-Za-z][\w-]*\.[A-Za-z][\w-]*$/.test(node.name.text)
    )
      violations.push(
        violation(path, tree, node, 'central_operation_definition')
      )
  })
  if (!composesRegistry)
    violations.push({
      path,
      line: 1,
      code: 'missing_registry_composition'
    })
}

function inspectUtilityRoot(
  path: string,
  tree: ts.SourceFile,
  violations: RuntimeRegistryViolation[]
): void {
  const imports = new Set(
    tree.statements
      .filter(ts.isImportDeclaration)
      .map((statement) => statement.moduleSpecifier)
      .filter(ts.isStringLiteral)
      .map((specifier) => specifier.text)
  )
  for (const owner of utilityOwnerImports)
    if (!imports.has(owner))
      violations.push({
        path,
        line: 1,
        code: 'missing_utility_owner_import'
      })
  for (const statement of tree.statements)
    if (ts.isFunctionDeclaration(statement))
      violations.push(
        violation(path, tree, statement, 'inline_utility_function')
      )
  requireCompletenessAssertion(path, tree, violations)
}

function requireCompletenessAssertion(
  path: string,
  tree: ts.SourceFile,
  violations: RuntimeRegistryViolation[]
): void {
  let found = false
  walk(tree, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'assertExactOperationKeys'
    )
      found = true
  })
  if (!found)
    violations.push({
      path,
      line: 1,
      code: 'missing_completeness_assertion'
    })
}

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

function violation(
  path: string,
  tree: ts.SourceFile,
  node: ts.Node,
  code: RuntimeRegistryViolation['code']
): RuntimeRegistryViolation {
  return {
    path,
    line: tree.getLineAndCharacterOfPosition(node.getStart()).line + 1,
    code
  }
}
