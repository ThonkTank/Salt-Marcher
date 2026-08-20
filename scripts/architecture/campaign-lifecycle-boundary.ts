import ts from 'typescript'

export type CampaignLifecycleBoundaryViolation = Readonly<{
  path: string
  line: number
  code:
    | 'missing_coordinator_composition'
    | 'duplicate_coordinator_owner'
    | 'import_owns_lifecycle_resource'
    | 'legacy_lifecycle_owner'
}>

const storePath = 'src/core/persistence/sqlite/campaign-store.ts'
const importServicePath = 'src/core/campaign-import/campaign-import-service.ts'
const forbiddenImportFragments = [
  'campaign-filesystem',
  'campaign-connection-manager',
  'campaign-lifecycle-journal',
  'campaign-registry-repository',
  'installation-database-owner'
]

/** Semantic gate for the single cross-resource Campaign lifecycle owner. */
export function campaignLifecycleBoundaryViolations(
  sources: Readonly<Record<string, string>>
): readonly CampaignLifecycleBoundaryViolation[] {
  const violations: CampaignLifecycleBoundaryViolation[] = []
  let storeComposesCoordinator = false

  for (const [path, content] of Object.entries(sources)) {
    const tree = ts.createSourceFile(
      path,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )
    walk(tree, (node) => {
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'CampaignLifecycleCoordinator'
      ) {
        if (path === storePath) storeComposesCoordinator = true
        else
          violations.push(
            violation(path, tree, node, 'duplicate_coordinator_owner')
          )
      }
      if (
        ts.isIdentifier(node) &&
        (node.text === 'CampaignDirectoryTransition' ||
          node.text === 'CampaignReplacePhase')
      )
        violations.push(violation(path, tree, node, 'legacy_lifecycle_owner'))
    })

    if (path === importServicePath)
      for (const statement of tree.statements.filter(ts.isImportDeclaration)) {
        const specifier = statement.moduleSpecifier
        if (
          ts.isStringLiteral(specifier) &&
          forbiddenImportFragments.some((fragment) =>
            specifier.text.includes(fragment)
          )
        )
          violations.push(
            violation(path, tree, statement, 'import_owns_lifecycle_resource')
          )
      }
  }

  if (!storeComposesCoordinator)
    violations.push({
      path: storePath,
      line: 1,
      code: 'missing_coordinator_composition'
    })
  return violations
}

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

function violation(
  path: string,
  tree: ts.SourceFile,
  node: ts.Node,
  code: CampaignLifecycleBoundaryViolation['code']
): CampaignLifecycleBoundaryViolation {
  return {
    path,
    line: tree.getLineAndCharacterOfPosition(node.getStart()).line + 1,
    code
  }
}
