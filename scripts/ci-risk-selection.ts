import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { z } from 'zod'
import { computeAppBuildInputFingerprintAtRef } from './build-identity.js'
import {
  assertCandidateHistory,
  readCandidateHistory
} from './candidate-history.js'

const commit = z.string().regex(/^[a-f0-9]{40}$/)
const digest = z.string().regex(/^[a-f0-9]{64}$/)
export const ciRiskPolicyPath = 'scripts/delivery/ci-risk-policy.v1.json'
export const ciRiskGroups = [
  'portable',
  'native',
  'linux-build',
  'linux-package',
  'linux-qualification',
  'e2e',
  'visual',
  'passive-e2e'
] as const
const policySchema = z
  .object({
    schemaVersion: z.literal(1),
    documentation: z
      .object({
        exact: z.array(z.string()),
        markdownRoots: z.array(z.string())
      })
      .strict(),
    portableTests: z
      .object({
        root: z.string(),
        suffix: z.string(),
        excluded: z.array(z.string())
      })
      .strict(),
    renderer: z
      .object({ root: z.string(), extensions: z.array(z.string()) })
      .strict()
  })
  .strict()

export const ciRiskSelectionSchema = z
  .object({
    schemaVersion: z.literal(1),
    baseSha: commit,
    headSha: commit,
    policySha256: digest.nullable(),
    diffSha256: digest,
    baseAppFingerprint: digest,
    headAppFingerprint: digest,
    mode: z.enum(['full', 'selected']),
    reasons: z.array(z.string().min(1)).min(1),
    requiredGroups: z.array(z.enum(ciRiskGroups)).min(1),
    requiresLocalArtifact: z.boolean()
  })
  .strict()

export type CiRiskSelection = z.infer<typeof ciRiskSelectionSchema>

type Change = Readonly<{
  oldMode: string
  newMode: string
  status: string
  path: string
}>

function hash(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function parsePolicy(bytes: Buffer | null) {
  try {
    return policySchema.safeParse(
      bytes ? (JSON.parse(bytes.toString('utf8')) as unknown) : null
    )
  } catch {
    return policySchema.safeParse(null)
  }
}

function git(root: string, args: string[]): Buffer {
  return execFileSync('git', args, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024
  })
}

function policyAt(root: string, sha: string): Buffer | null {
  const entries = git(root, ['ls-tree', '-z', sha, '--', ciRiskPolicyPath])
  if (entries.length === 0) return null
  const match = /^100644 blob ([a-f0-9]{40})\t[^\0]+\0$/.exec(
    entries.toString('utf8')
  )
  if (!match?.[1]) throw new Error('CI policy must be a regular Git blob.')
  return git(root, ['cat-file', 'blob', match[1]])
}

function changesFrom(raw: Buffer): Change[] {
  const text = raw.toString('utf8')
  if (!Buffer.from(text).equals(raw))
    throw new Error('Non-UTF8 Git diff paths.')
  if (text === '') return []
  const fields = text.split('\0')
  if (fields.pop() !== '' || fields.length % 2 !== 0)
    throw new Error('Malformed NUL-delimited Git diff.')
  const changes: Change[] = []
  for (let index = 0; index < fields.length; index += 2) {
    const match = /^:(\d{6}) (\d{6}) [a-f0-9]{40} [a-f0-9]{40} ([A-Z])$/.exec(
      fields[index] ?? ''
    )
    const path = fields[index + 1]
    if (!match?.[1] || !match[2] || !match[3] || !path)
      throw new Error('Malformed Git change record.')
    changes.push({
      oldMode: match[1],
      newMode: match[2],
      status: match[3],
      path
    })
  }
  return changes
}

/** Git objects, not the working tree or a caller-provided file list, are authority. */
export function readCiRiskSelection(input: {
  workspaceRoot: string
  baseSha: string
  headSha: string
  forceFull?: boolean
}): CiRiskSelection {
  const baseSha = commit.parse(input.baseSha)
  const headSha = commit.parse(input.headSha)
  const root = input.workspaceRoot
  assertCandidateHistory(readCandidateHistory(baseSha, headSha, root))
  const raw = git(root, [
    'diff',
    '--raw',
    '-z',
    '--no-renames',
    '--no-ext-diff',
    '--abbrev=40',
    baseSha,
    headSha,
    '--'
  ])
  const basePolicy = policyAt(root, baseSha)
  const headPolicy = policyAt(root, headSha)
  const baseAppFingerprint = computeAppBuildInputFingerprintAtRef(root, baseSha)
  const headAppFingerprint = computeAppBuildInputFingerprintAtRef(root, headSha)
  const reasons: string[] = []
  const selected = new Set<(typeof ciRiskGroups)[number]>(['portable'])
  let full = false
  const requireFull = (reason: string) => {
    full = true
    reasons.push(reason)
  }
  if (input.forceFull) requireFull('explicit-full-qualification')
  if (!basePolicy || !headPolicy || !basePolicy.equals(headPolicy))
    requireFull('missing-or-changed-base-policy')
  const parsed = parsePolicy(basePolicy)
  if (!parsed?.success) requireFull('unsupported-base-policy')
  const changes = changesFrom(raw)
  if (changes.length === 0) requireFull('empty-comparison')
  let rendererChanged = false
  for (const change of changes) {
    const { path } = change
    if (
      !['A', 'M'].includes(change.status) ||
      change.newMode !== '100644' ||
      (change.status === 'M' && change.oldMode !== '100644') ||
      [...path].some((character) => {
        const code = character.charCodeAt(0)
        return code < 32 || code === 127
      })
    ) {
      requireFull(`structural-change:${path}`)
      continue
    }
    if (!parsed?.success) continue
    const policy = parsed.data
    if (
      policy.documentation.exact.includes(path) ||
      (path.endsWith('.md') &&
        policy.documentation.markdownRoots.some((prefix) =>
          path.startsWith(prefix)
        ))
    ) {
      reasons.push(`documentation:${path}`)
    } else if (
      path.startsWith(policy.portableTests.root) &&
      path.endsWith(policy.portableTests.suffix) &&
      !policy.portableTests.excluded.includes(path)
    ) {
      reasons.push(`portable-test:${path}`)
    } else if (
      path.startsWith(policy.renderer.root) &&
      policy.renderer.extensions.some((extension) => path.endsWith(extension))
    ) {
      rendererChanged = true
      reasons.push(`renderer:${path}`)
      for (const group of ciRiskGroups)
        if (group !== 'native') selected.add(group)
    } else requireFull(`unmapped-change:${path}`)
  }
  if (baseAppFingerprint !== headAppFingerprint && !rendererChanged)
    requireFull('app-fingerprint-change-outside-renderer')
  const requiredGroups = ciRiskGroups.filter(
    (group) => full || selected.has(group)
  )
  return ciRiskSelectionSchema.parse({
    schemaVersion: 1,
    baseSha,
    headSha,
    policySha256: basePolicy ? hash(basePolicy) : null,
    diffSha256: hash(raw),
    baseAppFingerprint,
    headAppFingerprint,
    mode: full ? 'full' : 'selected',
    reasons,
    requiredGroups,
    requiresLocalArtifact: requiredGroups.includes('linux-package')
  })
}

/** Recompute the complete receipt; neither job lists nor reasons are trusted. */
export function verifyCiRiskSelection(
  value: unknown,
  input: Parameters<typeof readCiRiskSelection>[0]
): CiRiskSelection {
  const received = ciRiskSelectionSchema.parse(value)
  const expected = readCiRiskSelection(input)
  if (!isDeepStrictEqual(received, expected))
    throw new Error('CI risk selection differs from immutable Git evidence.')
  return expected
}
