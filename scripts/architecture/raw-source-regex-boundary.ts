import ts from 'typescript'

export type RawSourceRegexViolation = Readonly<{
  path: string
  line: number
  matcher: 'toMatch'
}>

/**
 * Rejects regex assertions whose subject is TypeScript source text. Regexes
 * over domain values, hashes, CSS, SQL, Markdown, and fixture data are not
 * affected.
 */
export function rawSourceRegexViolations(
  sources: Readonly<Record<string, string>>
): readonly RawSourceRegexViolation[] {
  const violations: RawSourceRegexViolation[] = []
  for (const [path, content] of Object.entries(sources)) {
    const tree = ts.createSourceFile(
      path,
      content,
      ts.ScriptTarget.Latest,
      true,
      path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    )
    const sourceReaders = sourceReaderNames(tree)
    const sourceVariables = new Set<string>()
    let changed = true
    while (changed) {
      changed = false
      const collect = (node: ts.Node): void => {
        if (
          ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.initializer &&
          expressionReadsTypeScriptSource(
            node.initializer,
            sourceReaders,
            sourceVariables
          ) &&
          !sourceVariables.has(node.name.text)
        ) {
          sourceVariables.add(node.name.text)
          changed = true
        }
        ts.forEachChild(node, collect)
      }
      collect(tree)
    }
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && matcherName(node) === 'toMatch') {
        const subject = expectSubject(node)
        if (
          subject &&
          expressionReadsTypeScriptSource(
            subject,
            sourceReaders,
            sourceVariables
          )
        )
          violations.push({
            path,
            line: tree.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            matcher: 'toMatch'
          })
      }
      ts.forEachChild(node, visit)
    }
    visit(tree)
  }
  return violations
}

function sourceReaderNames(tree: ts.SourceFile): ReadonlySet<string> {
  const names = new Set(['readFileSync'])
  const visit = (node: ts.Node): void => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      node.body &&
      containsReadFileSync(node.body)
    )
      names.add(node.name.text)
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer)) &&
      containsReadFileSync(node.initializer)
    )
      names.add(node.name.text)
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return names
}

function containsReadFileSync(node: ts.Node): boolean {
  let found = false
  const visit = (child: ts.Node): void => {
    if (
      ts.isCallExpression(child) &&
      ts.isIdentifier(child.expression) &&
      child.expression.text === 'readFileSync'
    )
      found = true
    if (!found) ts.forEachChild(child, visit)
  }
  visit(node)
  return found
}

function expressionReadsTypeScriptSource(
  expression: ts.Expression,
  readers: ReadonlySet<string>,
  variables: ReadonlySet<string>
): boolean {
  if (ts.isIdentifier(expression)) return variables.has(expression.text)
  let reads = false
  const visit = (node: ts.Node): void => {
    if (reads) return
    if (ts.isIdentifier(node) && variables.has(node.text)) reads = true
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      readers.has(node.expression.text) &&
      sourceArgumentIsTypeScript(node.arguments[0])
    )
      reads = true
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'map' &&
      node.arguments[0] &&
      ts.isIdentifier(node.arguments[0]) &&
      readers.has(node.arguments[0].text)
    )
      reads = true
    if (!reads) ts.forEachChild(node, visit)
  }
  visit(expression)
  return reads
}

function sourceArgumentIsTypeScript(node: ts.Expression | undefined): boolean {
  if (!node) return false
  if (ts.isStringLiteralLike(node))
    return /(?:^|\/)src\/|\.[cm]?[jt]sx?$/.test(node.text)
  return false
}

function matcherName(node: ts.CallExpression): string | null {
  return ts.isPropertyAccessExpression(node.expression)
    ? node.expression.name.text
    : null
}

function expectSubject(node: ts.CallExpression): ts.Expression | null {
  if (!ts.isPropertyAccessExpression(node.expression)) return null
  let target: ts.Expression = node.expression.expression
  if (ts.isPropertyAccessExpression(target) && target.name.text === 'not')
    target = target.expression
  return ts.isCallExpression(target) &&
    ts.isIdentifier(target.expression) &&
    target.expression.text === 'expect'
    ? (target.arguments[0] ?? null)
    : null
}
