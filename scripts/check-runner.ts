import { createHash, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { z } from 'zod'
import {
  computeWorkspaceFingerprint,
  readBuildToolchain
} from './build-identity.js'
import {
  evaluateCheckPreflight,
  readCheckPreflightSnapshot,
  type CheckPreflight
} from './check-preflight.js'
import { sha256File } from './file-hash.js'

export const localCheckPhases = [
  {
    name: 'portable-fast',
    command: ['pnpm', 'check:portable:fast']
  },
  {
    name: 'portable-app',
    command: ['pnpm', 'check:portable:app']
  },
  { name: 'linux', command: ['pnpm', 'check:linux'] },
  { name: 'functional-e2e', command: ['pnpm', 'test:e2e:built'] },
  { name: 'visual-e2e', command: ['pnpm', 'test:visual:built'] }
] as const

export type LocalCheckPhaseName = (typeof localCheckPhases)[number]['name']

const fingerprintSchema = z.string().regex(/^[0-9a-f]{64}$/)
const phaseNameSchema = z.enum(
  localCheckPhases.map(({ name }) => name) as [
    LocalCheckPhaseName,
    ...LocalCheckPhaseName[]
  ]
)
const checkIdentitySchema = z
  .object({
    workspaceFingerprint: fingerprintSchema,
    toolchainHash: fingerprintSchema,
    commandsHash: fingerprintSchema,
    inputHash: fingerprintSchema
  })
  .strict()

export type LocalCheckIdentity = z.infer<typeof checkIdentitySchema>

const preflightSchema = z
  .object({
    status: z.enum(['passed', 'failed']),
    checkedAt: z.iso.datetime(),
    reasons: z.array(z.string()),
    snapshotHash: fingerprintSchema
  })
  .strict()

const phaseSchema = z
  .object({
    phase: phaseNameSchema,
    status: z.enum(['pending', 'running', 'completed', 'failed']),
    startedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    durationMs: z.number().int().nonnegative().nullable(),
    evidenceSha256: fingerprintSchema.nullable(),
    error: z.string().nullable()
  })
  .strict()

export const localCheckStateSchema = z
  .object({
    formatVersion: z.literal(1),
    runId: z.uuid(),
    status: z.enum(['running', 'complete', 'failed']),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    identity: checkIdentitySchema,
    preflight: preflightSchema.nullable(),
    phases: z.array(phaseSchema).length(localCheckPhases.length)
  })
  .strict()
  .superRefine((state, context) => {
    if (
      JSON.stringify(state.phases.map(({ phase }) => phase)) !==
      JSON.stringify(localCheckPhases.map(({ name }) => name))
    )
      context.addIssue({
        code: 'custom',
        message: 'Local check phases must be complete, unique and ordered',
        path: ['phases']
      })
    if (
      state.status === 'complete' &&
      state.phases.some(({ status }) => status !== 'completed')
    )
      context.addIssue({
        code: 'custom',
        message: 'Complete local check state requires every phase',
        path: ['status']
      })
  })

export type LocalCheckState = z.infer<typeof localCheckStateSchema>

export type LocalCheckRunnerOptions = Readonly<{
  workspaceRoot?: string
  stateRoot?: string
  resume: boolean
  identity?: LocalCheckIdentity
  now?: () => Date
  readPreflight?: () => CheckPreflight
  runPhase?: (phase: LocalCheckPhaseName) => void
  collectEvidence?: (phase: LocalCheckPhaseName) => string | null
  validateBuildEvidence?: (expectedSha256: string) => boolean
}>

export function parseCheckArguments(arguments_: readonly string[]): {
  resume: boolean
} {
  if (arguments_.length === 0) return { resume: false }
  if (arguments_.length === 1 && arguments_[0] === '--resume')
    return { resume: true }
  if (arguments_.includes('--') && arguments_.includes('--resume'))
    throw new Error(
      'Use `pnpm check --resume`; do not place a separate `--` before --resume.'
    )
  throw new Error('Usage: pnpm check [--resume]')
}

export function readLocalCheckIdentity(
  workspaceRoot = process.cwd()
): LocalCheckIdentity {
  const workspaceFingerprint = computeWorkspaceFingerprint(workspaceRoot)
  const toolchainHash = hashJson(readBuildToolchain(workspaceRoot))
  const commandsHash = hashJson({ version: 1, phases: localCheckPhases })
  return {
    workspaceFingerprint,
    toolchainHash,
    commandsHash,
    inputHash: hashJson({
      workspaceFingerprint,
      toolchainHash,
      commandsHash
    })
  }
}

export function executeLocalCheck(
  options: LocalCheckRunnerOptions
): LocalCheckState {
  const workspaceRoot = options.workspaceRoot ?? process.cwd()
  const stateRoot =
    options.stateRoot ?? resolve(workspaceRoot, '.tmp', 'local-check', 'states')
  const identity = checkIdentitySchema.parse(
    options.identity ?? readLocalCheckIdentity(workspaceRoot)
  )
  const statePath = resolve(stateRoot, `${identity.inputHash}.json`)
  const now = options.now ?? (() => new Date())
  const readPreflight =
    options.readPreflight ??
    (() => evaluateCheckPreflight(readCheckPreflightSnapshot(workspaceRoot)))
  const runPhase =
    options.runPhase ?? ((phase) => runPhaseCommand(workspaceRoot, phase))
  const collectEvidence =
    options.collectEvidence ??
    ((phase) => collectPhaseEvidence(workspaceRoot, phase))
  const validateBuildEvidence =
    options.validateBuildEvidence ??
    ((expected) => validateBuildOutput(workspaceRoot, expected))

  let state = options.resume
    ? readResumeState(statePath, identity)
    : createState(identity, now().toISOString())
  const persist = (): void => atomicWriteState(statePath, state)
  persist()

  const preflight = readPreflight()
  state = localCheckStateSchema.parse({
    ...state,
    status: preflight.status === 'passed' ? 'running' : 'failed',
    updatedAt: now().toISOString(),
    preflight: {
      status: preflight.status,
      checkedAt: now().toISOString(),
      reasons: [...preflight.reasons],
      snapshotHash: hashJson(preflight.snapshot)
    }
  })
  persist()
  if (preflight.status === 'failed')
    throw new Error(
      `Local check preflight failed: ${preflight.reasons.join('; ')}`
    )

  if (options.resume) {
    const build = state.phases.find(({ phase }) => phase === 'portable-app')!
    if (
      build.status === 'completed' &&
      (build.evidenceSha256 === null ||
        !validateBuildEvidence(build.evidenceSha256))
    ) {
      state = resetFromPhase(state, 'portable-app', now().toISOString())
      persist()
    }
  }

  for (const definition of localCheckPhases) {
    const current = state.phases.find(({ phase }) => phase === definition.name)!
    if (options.resume && current.status === 'completed') {
      console.info(`Skipping proved local check phase ${definition.name}.`)
      continue
    }
    const startedAt = now()
    state = updatePhase(state, definition.name, {
      status: 'running',
      startedAt: startedAt.toISOString(),
      completedAt: null,
      durationMs: null,
      evidenceSha256: null,
      error: null
    })
    persist()
    console.info(
      JSON.stringify({
        component: 'local-check',
        event: 'phase-started',
        phase: definition.name
      })
    )
    try {
      runPhase(definition.name)
      const completedAt = now()
      state = updatePhase(state, definition.name, {
        status: 'completed',
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
        evidenceSha256: collectEvidence(definition.name),
        error: null
      })
      persist()
    } catch (error) {
      const completedAt = now()
      state = updatePhase(state, definition.name, {
        status: 'failed',
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
        evidenceSha256: null,
        error: errorMessage(error)
      })
      state = localCheckStateSchema.parse({ ...state, status: 'failed' })
      persist()
      throw new Error(
        `Local check phase ${definition.name} failed. Resume unchanged input with \`pnpm check --resume\`.`,
        { cause: error }
      )
    }
  }

  state = localCheckStateSchema.parse({
    ...state,
    status: 'complete',
    updatedAt: now().toISOString()
  })
  persist()
  console.info(
    JSON.stringify({
      component: 'local-check',
      event: 'completed',
      runId: state.runId,
      statePath
    })
  )
  return state
}

function createState(
  identity: LocalCheckIdentity,
  timestamp: string
): LocalCheckState {
  return localCheckStateSchema.parse({
    formatVersion: 1,
    runId: randomUUID(),
    status: 'running',
    createdAt: timestamp,
    updatedAt: timestamp,
    identity,
    preflight: null,
    phases: localCheckPhases.map(({ name }) => ({
      phase: name,
      status: 'pending',
      startedAt: null,
      completedAt: null,
      durationMs: null,
      evidenceSha256: null,
      error: null
    }))
  })
}

function readResumeState(
  path: string,
  identity: LocalCheckIdentity
): LocalCheckState {
  if (!existsSync(path))
    throw new Error(
      'No hash-matching local check state exists. Run `pnpm check` first.'
    )
  const state = localCheckStateSchema.parse(
    JSON.parse(readFileSync(path, 'utf8'))
  )
  if (JSON.stringify(state.identity) !== JSON.stringify(identity))
    throw new Error('Local check state identity differs from current input.')
  return state
}

function updatePhase(
  state: LocalCheckState,
  phase: LocalCheckPhaseName,
  replacement: Omit<LocalCheckState['phases'][number], 'phase'>
): LocalCheckState {
  const timestamp = replacement.completedAt ?? replacement.startedAt
  return localCheckStateSchema.parse({
    ...state,
    status: 'running',
    updatedAt: timestamp ?? state.updatedAt,
    phases: state.phases.map((current) =>
      current.phase === phase ? { ...replacement, phase } : current
    )
  })
}

function resetFromPhase(
  state: LocalCheckState,
  phase: LocalCheckPhaseName,
  timestamp: string
): LocalCheckState {
  const index = localCheckPhases.findIndex(({ name }) => name === phase)
  return localCheckStateSchema.parse({
    ...state,
    status: 'running',
    updatedAt: timestamp,
    phases: state.phases.map((current, currentIndex) =>
      currentIndex < index
        ? current
        : {
            phase: current.phase,
            status: 'pending',
            startedAt: null,
            completedAt: null,
            durationMs: null,
            evidenceSha256: null,
            error: null
          }
    )
  })
}

function runPhaseCommand(
  workspaceRoot: string,
  phase: LocalCheckPhaseName
): void {
  const definition = localCheckPhases.find(({ name }) => name === phase)!
  const result = spawnSync('corepack', definition.command, {
    cwd: workspaceRoot,
    env: process.env,
    stdio: 'inherit'
  })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(
      `corepack ${definition.command.join(' ')} exited with ${result.status}`
    )
}

function collectPhaseEvidence(
  workspaceRoot: string,
  phase: LocalCheckPhaseName
): string | null {
  if (phase !== 'portable-app') return null
  const path = resolve(workspaceRoot, 'out', 'build-receipt.json')
  if (!existsSync(path)) throw new Error('Build receipt is missing after build')
  return sha256File(path)
}

function validateBuildOutput(
  workspaceRoot: string,
  expectedSha256: string
): boolean {
  const receipt = resolve(workspaceRoot, 'out', 'build-receipt.json')
  if (!existsSync(receipt) || sha256File(receipt) !== expectedSha256)
    return false
  const result = spawnSync(
    'corepack',
    [
      'pnpm',
      'exec',
      'tsx',
      'scripts/assert-built-workspace.ts',
      '--channel',
      'development'
    ],
    { cwd: workspaceRoot, env: process.env, stdio: 'ignore' }
  )
  return !result.error && result.status === 0
}

function atomicWriteState(path: string, state: LocalCheckState): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.next`
  const descriptor = openSync(temporary, 'wx', 0o600)
  try {
    writeFileSync(descriptor, `${JSON.stringify(state, null, 2)}\n`)
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
  renameSync(temporary, path)
  const directory = openSync(dirname(path), 'r')
  try {
    fsyncSync(directory)
  } finally {
    closeSync(directory)
  }
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
