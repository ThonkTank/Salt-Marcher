import ts from 'typescript'

const forbiddenLocatorNames = new Set([
  'activeCampaignDatabase',
  'installationDatabase',
  'compatibilityDatabase'
])

export type CampaignPersistenceViolation = Readonly<{
  path: string
  line: number
  name: string
}>

/** Semantic AST gate for deleted raw CampaignStore/connection locators. */
export function campaignPersistenceBoundaryViolations(
  sources: Readonly<Record<string, string>>
): readonly CampaignPersistenceViolation[] {
  const violations: CampaignPersistenceViolation[] = []
  for (const [path, content] of Object.entries(sources)) {
    const tree = ts.createSourceFile(
      path,
      content,
      ts.ScriptTarget.Latest,
      true,
      path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    )
    const visit = (node: ts.Node): void => {
      const name = forbiddenName(node)
      if (name) {
        const line =
          tree.getLineAndCharacterOfPosition(node.getStart()).line + 1
        violations.push({ path, line, name })
      }
      ts.forEachChild(node, visit)
    }
    visit(tree)
  }
  return violations
}

function forbiddenName(node: ts.Node): string | null {
  if (
    (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) &&
    node.name &&
    ts.isIdentifier(node.name) &&
    forbiddenLocatorNames.has(node.name.text)
  )
    return node.name.text
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    forbiddenLocatorNames.has(node.expression.name.text)
  )
    return node.expression.name.text
  return null
}
