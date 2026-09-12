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
    id: 'party-history-convergence-target',
    commit: '4a87219b2dc13334773fa46a3940efe6385c7f81',
    schemaVersions: { installation: 43, campaign: 43 }
  },
  {
    id: 'party-history-main-baseline',
    commit: 'e4fc7fd4e071d63987287d8b46723be60703846d',
    schemaVersions: { installation: 43, campaign: 42 }
  },
  {
    id: 'maintenance-domain-errors-target',
    commit: 'e96dbcbfee614225486a48fcbd1bde49e1f1f615',
    schemaVersions: { installation: 42, campaign: 42 }
  },
  {
    id: 'current-main-filesystem-target',
    commit: '2b5b4d55a59c45b815a9b84676f91a4c47ed07e8',
    schemaVersions: { installation: 42, campaign: 42 }
  },
  {
    id: 'profile-lock-target',
    commit: 'a6465210fe392c0bc4a30989e709d9c7d6cdf1bf',
    schemaVersions: { installation: 42, campaign: 42 }
  },
  {
    id: 'prepared-bootstrap-target',
    commit: '7c6d08205e42cd9227bab98e1920dbb64f0c18c9',
    schemaVersions: { installation: 42, campaign: 42 }
  },
  {
    id: 'bootstrap-target',
    commit: 'd64573c4cf65f463d8087dd2dd9c61c2c4e1cbb7',
    schemaVersions: { installation: 42, campaign: 42 }
  },
  {
    id: 'feed-baseline',
    commit: '25bd83a8971a09bca06964f34ebac7651f0132e9',
    schemaVersions: { installation: 42, campaign: 41 }
  },
  {
    id: 'feed-target',
    commit: '983feb554869a4719e441bac26b1b472855ab09a',
    schemaVersions: { installation: 42, campaign: 42 }
  },
  {
    id: 'space-baseline',
    commit: '2ccba43f60b92f99aa7fddbfcbb354bf00c44761',
    schemaVersions: { installation: 42, campaign: 41 }
  },
  {
    id: 'space-target',
    commit: 'c26f04a0a93c2f27ff0b39d0d47dc80e42f4c0b6',
    schemaVersions: { installation: 42, campaign: 42 }
  },
  {
    id: 'starter-baseline',
    commit: 'b64a408a58d33d7806d5e9e8736a3314246667ad',
    schemaVersions: { installation: 42, campaign: 41 }
  },
  {
    id: 'starter-target',
    commit: '5c852f3b717c90e73ca9cbec8c49ae18444e7aad',
    schemaVersions: { installation: 42, campaign: 42 }
  },
  {
    id: 'extraction-baseline',
    commit: 'ab32d4947ea8409bda679d60d3befe9103c176c0',
    schemaVersions: { installation: 42, campaign: 41 }
  },
  {
    id: 'extraction-target',
    commit: 'f633b89621a3307ba01ad3772dcaead51451f333',
    schemaVersions: { installation: 42, campaign: 42 }
  },
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
    id: 'corrected',
    commit: '1703c25c96366a7ff76d1d119b2250afcbf35690',
    schemaVersions: { installation: 42, campaign: 41 }
  },
  {
    id: 'repaired',
    commit: '6d7889ca451762259bc4f472851c893bce57e1e0',
    schemaVersions: { installation: 42, campaign: 42 }
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
