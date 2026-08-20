import ts from 'typescript'

export type RuntimeRegistryViolation = Readonly<{
  path: string
  line: number
  code:
    | 'central_operation_definition'
    | 'missing_registry_composition'
    | 'inline_utility_function'
    | 'inline_aggregate_handler'
    | 'missing_utility_owner_import'
    | 'missing_handler_composition'
    | 'missing_completeness_assertion'
    | 'missing_role_derived_preload'
    | 'missing_operation_fragment_owner'
    | 'parallel_handler_key_inventory'
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
    if (path.includes('/utility/composition/'))
      inspectHandlerComposition(path, tree, violations)
    if (
      path.includes('/shared/contracts/operations/') &&
      !path.endsWith('/registry.ts')
    )
      inspectOperationFragment(path, tree, violations)
    if (path.endsWith('/preload/capability-bridge/index.ts'))
      requireCompletenessAssertion(path, tree, violations)
    if (path.endsWith('/preload/passive.ts'))
      inspectPassivePreload(path, tree, violations)
  }
  return violations
}

function inspectPassivePreload(
  path: string,
  tree: ts.SourceFile,
  violations: RuntimeRegistryViolation[]
): void {
  if (
    !hasCall(tree, 'operationDefinitionsForRole') ||
    !hasCall(tree, 'defineOperationHandlers')
  )
    violations.push({ path, line: 1, code: 'missing_role_derived_preload' })
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
  if (!hasCall(tree, 'composeOperationHandlers'))
    violations.push({ path, line: 1, code: 'missing_handler_composition' })
  walk(tree, (node) => {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isStringLiteral(node.name) &&
      isOperationKey(node.name.text)
    )
      violations.push(violation(path, tree, node, 'inline_aggregate_handler'))
  })
}

function inspectHandlerComposition(
  path: string,
  tree: ts.SourceFile,
  violations: RuntimeRegistryViolation[]
): void {
  if (!hasCall(tree, 'defineOperationHandlers'))
    violations.push({ path, line: 1, code: 'missing_handler_composition' })
  walk(tree, (node) => {
    if (
      ts.isTypeAliasDeclaration(node) &&
      /Handler(?:Name|Key|Kind)s?$/.test(node.name.text) &&
      containsOperationLiteral(node.type)
    )
      violations.push(
        violation(path, tree, node, 'parallel_handler_key_inventory')
      )
  })
}

function inspectOperationFragment(
  path: string,
  tree: ts.SourceFile,
  violations: RuntimeRegistryViolation[]
): void {
  if (
    !hasCall(tree, 'utilityOperationFragment') &&
    !hasCall(tree, 'mainOperationFragment')
  )
    violations.push({
      path,
      line: 1,
      code: 'missing_operation_fragment_owner'
    })
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

function hasCall(tree: ts.SourceFile, name: string): boolean {
  let found = false
  walk(tree, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === name
    )
      found = true
  })
  return found
}

function containsOperationLiteral(node: ts.Node): boolean {
  let found = false
  walk(node, (child) => {
    if (ts.isLiteralTypeNode(child) && ts.isStringLiteral(child.literal))
      found ||= isOperationKey(child.literal.text)
  })
  return found
}

function isOperationKey(value: string): boolean {
  return /^[A-Za-z][\w-]*\.[A-Za-z][\w-]*$/.test(value)
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
