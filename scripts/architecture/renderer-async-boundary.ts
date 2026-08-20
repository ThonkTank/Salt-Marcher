import ts from 'typescript'

export type RendererAsyncBoundaryViolation = Readonly<{
  path: string
  line: number
  mechanism: string
}>

const forbiddenActionKinds = new Set([
  'request-began',
  'request-ended',
  'request-message'
])

export function rendererAsyncBoundaryViolations(
  sources: Readonly<Record<string, string>>
): RendererAsyncBoundaryViolation[] {
  const violations: RendererAsyncBoundaryViolation[] = []
  for (const [path, content] of Object.entries(sources)) {
    const tree = ts.createSourceFile(
      path,
      content,
      ts.ScriptTarget.Latest,
      true,
      path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    )
    const report = (node: ts.Node, mechanism: string): void => {
      violations.push({
        path,
        line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
        mechanism
      })
    }
    const visit = (node: ts.Node): void => {
      if (hasForbiddenInfrastructureName(node))
        report(node, (node.name as ts.Identifier).text)
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'useRef' &&
        isManualRequestRef(node.arguments[0])
      )
        report(node, 'useRef-request-sequence')
      if (ts.isStringLiteral(node) && forbiddenActionKinds.has(node.text))
        report(node, node.text)
      ts.forEachChild(node, visit)
    }
    visit(tree)
  }
  return violations.sort(
    (left, right) =>
      left.path.localeCompare(right.path, 'en') || left.line - right.line
  )
}

function hasForbiddenInfrastructureName(
  node: ts.Node
): node is ts.NamedDeclaration & { name: ts.Identifier } {
  if (
    !(
      ts.isVariableDeclaration(node) ||
      ts.isParameter(node) ||
      ts.isPropertyDeclaration(node) ||
      ts.isPropertySignature(node)
    ) ||
    !node.name ||
    !ts.isIdentifier(node.name)
  )
    return false
  return (
    node.name.text === 'token' ||
    node.name.text === 'requestToken' ||
    /^latest[A-Z].*Request$/.test(node.name.text)
  )
}

function isManualRequestRef(argument: ts.Expression | undefined): boolean {
  return Boolean(
    argument &&
    (ts.isNumericLiteral(argument) ||
      (ts.isNewExpression(argument) &&
        ts.isIdentifier(argument.expression) &&
        argument.expression.text === 'Map'))
  )
}
