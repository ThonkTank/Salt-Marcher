import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import { z } from 'zod'

const versionsSchema = z
  .object({
    installation: z.number().int().positive(),
    campaign: z.number().int().positive()
  })
  .strict()

export const historicalSourceSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    commit: z.string().regex(/^[a-f0-9]{40}$/),
    schemaVersions: versionsSchema
  })
  .strict()

export type HistoricalSource = z.infer<typeof historicalSourceSchema>

/** Original source identities, not published releases or qualified artifacts. */
export const historicalReleaseSources: readonly HistoricalSource[] = [
  {
    id: 'a',
    commit: '52a0cc28cdb332406a4d03e0a14cc005eb7a0ff0',
    schemaVersions: { installation: 37, campaign: 34 }
  },
  {
    id: 'b',
    commit: '6e84a12c1c83cd6437680ae70529cdc9723c353b',
    schemaVersions: { installation: 38, campaign: 34 }
  },
  {
    id: 'c',
    commit: 'c583e05506e10d8446a4e210fa0603e3be53d63a',
    schemaVersions: { installation: 39, campaign: 34 }
  },
  {
    id: 'current',
    commit: 'bd8b33c4f5b6e5f064deb64278d9097f739cac6d',
    schemaVersions: { installation: 42, campaign: 41 }
  },
  {
    id: 'loot30',
    commit: 'b4927dbc0979906f71b2ee4e106ec22668245dd7',
    schemaVersions: { installation: 30, campaign: 30 }
  },
  {
    id: 'loot31',
    commit: 'a3c506b50cac3ff3c6a52bb5285f9c96d5e0b0b8',
    schemaVersions: { installation: 31, campaign: 31 }
  }
]

/** Parse the known original declaration without executing historical application code. */
export function readHistoricalSchemaVersions(source: string) {
  const file = ts.createSourceFile(
    'database.ts',
    source,
    ts.ScriptTarget.Latest,
    true
  )
  const declarations = file.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.filter(
          (declaration) =>
            ts.isIdentifier(declaration.name) &&
            declaration.name.text === 'databaseSchemaVersions'
        )
      : []
  )
  const initializer =
    declarations.length === 1 ? declarations[0]?.initializer : undefined
  if (
    !initializer ||
    !ts.isCallExpression(initializer) ||
    !ts.isPropertyAccessExpression(initializer.expression) ||
    !ts.isIdentifier(initializer.expression.expression) ||
    initializer.expression.expression.text !== 'Object' ||
    initializer.expression.name.text !== 'freeze' ||
    initializer.arguments.length !== 1
  )
    throw new Error('Unsupported historical schema owner declaration')
  const object = initializer.arguments[0]!
  if (!ts.isObjectLiteralExpression(object))
    throw new Error('Historical schema versions must be literal values')
  const versions: Record<string, number> = {}
  for (const property of object.properties) {
    if (
      !ts.isPropertyAssignment(property) ||
      !ts.isIdentifier(property.name) ||
      !ts.isNumericLiteral(property.initializer) ||
      property.name.text in versions
    )
      throw new Error(
        'Historical schema versions must be unique literal values'
      )
    versions[property.name.text] = Number(property.initializer.text)
  }
  return versionsSchema.parse(versions)
}

export function inspectHistoricalSource(
  workspace: string,
  raw: HistoricalSource
) {
  const source = historicalSourceSchema.parse(raw)
  const git = (args: string[]) =>
    execFileSync('git', args, {
      cwd: workspace,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
  const commit = git([
    'rev-parse',
    '--verify',
    `${source.commit}^{commit}`
  ]).trim()
  if (commit !== source.commit)
    throw new Error('Historical source is not the specified commit')
  const paths = [
    'src/core/persistence/sqlite/database.ts',
    'package.json',
    'pnpm-lock.yaml'
  ]
  const files = paths.map((path) => {
    const content = git(['show', `${commit}:${path}`])
    return {
      path,
      content,
      sha256: createHash('sha256').update(content).digest('hex')
    }
  })
  const schemaVersions = readHistoricalSchemaVersions(files[0]!.content)
  if (
    schemaVersions.installation !== source.schemaVersions.installation ||
    schemaVersions.campaign !== source.schemaVersions.campaign
  )
    throw new Error(
      `Historical source ${source.id} has different schema versions`
    )
  const metadata = z
    .object({ version: z.string().min(1), packageManager: z.string().min(1) })
    .parse(JSON.parse(files[1]!.content))
  return {
    formatVersion: 1 as const,
    evidence: 'source-inspection-only' as const,
    id: source.id,
    commit,
    tree: git(['rev-parse', `${commit}^{tree}`]).trim(),
    schemaVersions,
    packageVersion: metadata.version,
    packageManager: metadata.packageManager,
    files: files.map(({ path, sha256 }) => ({ path, sha256 }))
  }
}
