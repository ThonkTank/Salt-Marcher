import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import {
  computeAppBuildInputFingerprint,
  computeAppBuildInputFingerprintAtRef
} from './build-identity.js'
import {
  githubWorkflowRunSchema,
  handoffReceiptSchema,
  parseHandoffInvocationHistory,
  readRequiredJobManifest,
  sameWorkflowQualification,
  shaSchema,
  verifyRequiredJobs,
  type GithubWorkflowRun,
  type WorkflowEvidence
} from './delivery-contract.js'
import { verifyLiveRepositoryPolicy } from './repository-policy.js'

const shaPattern = /^[a-f0-9]{40}$/

export type CandidateState = Readonly<{
  branch: string
  upstream: string
  head: string
  upstreamHead: string
  remoteMain: string
  clean: boolean
  mainIsAncestor: boolean
  candidate: WorkflowEvidence | null
}>

export function assertCandidateState(state: CandidateState): void {
  if (!state.clean) throw new Error('Candidate checkout is not clean.')
  if (state.branch === 'main')
    throw new Error('Canonical handoff must run from a candidate branch.')
  if (state.upstream !== `origin/${state.branch}`)
    throw new Error(
      `Candidate upstream is ${state.upstream}; expected origin/${state.branch}.`
    )
  if (state.head !== state.upstreamHead)
    throw new Error('Candidate checkout differs from its pushed remote SHA.')
  if (!state.mainIsAncestor)
    throw new Error('Candidate is not based on the current remote main SHA.')
  if (!state.candidate)
    throw new Error('No complete required-job set proves this candidate SHA.')
  if (state.candidate.headSha !== state.head)
    throw new Error('Candidate workflow evidence proves another SHA.')
}

export function parseRemoteHead(output: string): string {
  const [sha] = output.trim().split(/\s+/)
  if (!shaPattern.test(sha ?? ''))
    throw new Error('Could not resolve origin/main from the live remote.')
  return sha!
}

export function successfulCandidateEvidence(
  runs: readonly GithubWorkflowRun[],
  head: string
): WorkflowEvidence | null {
  const manifest = readRequiredJobManifest()
  for (const run of runs)
    if (
      run.headSha === head &&
      run.status === 'completed' &&
      run.conclusion === 'success'
    ) {
      try {
        return verifyRequiredJobs(manifest, run, head)
      } catch {
        // A lightweight main run can share the SHA; only a complete candidate
        // job set is eligible as the application attestation.
      }
    }
  return null
}

export function readSuccessfulWorkflowEvidence(
  head: string
): WorkflowEvidence | null {
  const manifest = readRequiredJobManifest()
  const runSummaries = z
    .array(
      z
        .object({
          databaseId: z.number().int().positive(),
          headSha: z.string(),
          status: z.string(),
          conclusion: z.string().nullable(),
          url: z.string(),
          attempt: z.number().int().positive()
        })
        .passthrough()
    )
    .parse(
      JSON.parse(
        command('gh', [
          'run',
          'list',
          '--workflow',
          manifest.workflowName,
          '--commit',
          head,
          '--limit',
          '20',
          '--json',
          'databaseId,headSha,status,conclusion,url,attempt'
        ])
      )
    )
  const completed = runSummaries.filter(
    (run) =>
      run.headSha === head &&
      run.status === 'completed' &&
      run.conclusion === 'success'
  )
  for (const run of completed) {
    const evidence = successfulCandidateEvidence(
      [
        githubWorkflowRunSchema.parse(
          JSON.parse(
            command('gh', [
              'run',
              'view',
              String(run.databaseId),
              '--json',
              'databaseId,headSha,status,conclusion,url,attempt,jobs'
            ])
          )
        )
      ],
      head
    )
    if (evidence) return evidence
  }
  return null
}

export const postPromotionJobName = 'Main · promotion/evidence attestation'

export function successfulPostPromotionEvidence(
  run: GithubWorkflowRun,
  head: string
): WorkflowEvidence | null {
  if (
    run.headSha !== head ||
    run.status !== 'completed' ||
    run.conclusion !== 'success'
  )
    return null
  const matching = run.jobs.filter(({ name }) => name === postPromotionJobName)
  if (
    matching.length !== 1 ||
    matching[0]?.status !== 'completed' ||
    matching[0]?.conclusion !== 'success'
  )
    return null
  return {
    runId: run.databaseId,
    url: run.url,
    attempt: run.attempt,
    headSha: run.headSha,
    requiredJobManifestVersion: readRequiredJobManifest().schemaVersion,
    jobs: [
      {
        name: postPromotionJobName,
        platformRole: 'post-promotion-candidate-attestation',
        conclusion: 'success'
      }
    ]
  }
}

export function readSuccessfulPostPromotionEvidence(
  head: string
): WorkflowEvidence | null {
  const workflowName = readRequiredJobManifest().workflowName
  const summaries = z
    .array(
      z
        .object({
          databaseId: z.number().int().positive(),
          headSha: shaSchema,
          status: z.string(),
          conclusion: z.string().nullable()
        })
        .passthrough()
    )
    .parse(
      JSON.parse(
        command('gh', [
          'run',
          'list',
          '--workflow',
          workflowName,
          '--commit',
          head,
          '--event',
          'push',
          '--limit',
          '20',
          '--json',
          'databaseId,headSha,status,conclusion'
        ])
      )
    )
  for (const summary of summaries) {
    if (
      summary.headSha !== head ||
      summary.status !== 'completed' ||
      summary.conclusion !== 'success'
    )
      continue
    const run = githubWorkflowRunSchema.parse(
      JSON.parse(
        command('gh', [
          'run',
          'view',
          String(summary.databaseId),
          '--json',
          'databaseId,headSha,status,conclusion,url,attempt,jobs'
        ])
      )
    )
    const evidence = successfulPostPromotionEvidence(run, head)
    if (evidence) return evidence
  }
  return null
}

export function readCandidateState(): CandidateState {
  const branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD'])
  const upstream = git(['rev-parse', '--abbrev-ref', '@{upstream}'])
  const head = git(['rev-parse', 'HEAD'])
  const upstreamHead = git(['rev-parse', '@{upstream}'])
  const clean =
    git(['status', '--porcelain=v1', '--untracked-files=all']) === ''
  const remoteMain = parseRemoteHead(
    command('git', [
      'ls-remote',
      '--exit-code',
      '--heads',
      'origin',
      'refs/heads/main'
    ])
  )
  command('git', ['fetch', '--no-tags', 'origin', 'main'])
  const mainIsAncestor = commandStatus('git', [
    'merge-base',
    '--is-ancestor',
    remoteMain,
    head
  ])
  const candidate = readSuccessfulWorkflowEvidence(head)
  return {
    branch,
    upstream,
    head,
    upstreamHead,
    remoteMain,
    clean,
    mainIsAncestor,
    candidate
  }
}

export function assertCandidateReady(): CandidateState {
  const state = readCandidateState()
  assertCandidateState(state)
  verifyLiveRepositoryPolicy()
  return state
}

export function assertCompletedHandoffReceipt(
  head: string,
  candidate: WorkflowEvidence,
  workspaceRoot = process.cwd()
): void {
  const receiptDirectory = resolve(workspaceRoot, '.tmp', 'handoff-local-app')
  const path = resolve(receiptDirectory, 'handoff-receipt.json')
  if (!existsSync(path)) throw new Error('Final handoff receipt is missing.')
  const receipt = handoffReceiptSchema.parse(
    JSON.parse(readFileSync(path, 'utf8'))
  )
  const history = parseHandoffInvocationHistory(
    JSON.parse(
      readFileSync(resolve(receiptDirectory, 'invocations.json'), 'utf8')
    ),
    receiptDirectory
  )
  const attempts = history.invocations.filter(
    ({ applicationSha }) => applicationSha === head
  )
  const attemptIds = new Set(attempts.map(({ attemptId }) => attemptId))
  if (
    receipt.status !== 'complete' ||
    receipt.identity.commit !== head ||
    receipt.identity.dirty !== false ||
    !sameWorkflowQualification(receipt.identity.candidate, candidate) ||
    receipt.phases.some((phase) => phase.status !== 'completed') ||
    !attemptIds.has(receipt.originAttemptId) ||
    !attemptIds.has(receipt.activeAttemptId)
  )
    throw new Error('Final handoff receipt does not prove this clean SHA.')
}

export function requiresApplicationHandoff(
  candidateAppBuildInputFingerprint: string,
  mainAppBuildInputFingerprint: string
): boolean {
  return candidateAppBuildInputFingerprint !== mainAppBuildInputFingerprint
}

export function promoteCandidate(state: CandidateState): void {
  assertCandidateState(state)
  verifyLiveRepositoryPolicy()
  const workspaceRoot = process.cwd()
  const applicationHandoffRequired = requiresApplicationHandoff(
    computeAppBuildInputFingerprint(workspaceRoot),
    computeAppBuildInputFingerprintAtRef(workspaceRoot, state.remoteMain)
  )
  if (applicationHandoffRequired)
    assertCompletedHandoffReceipt(state.head, state.candidate!, workspaceRoot)
  command('git', ['push', 'origin', `${state.head}:refs/heads/main`])
}

function git(arguments_: readonly string[]): string {
  return command('git', arguments_).trim()
}

function command(executable: string, arguments_: readonly string[]): string {
  return execFileSync(executable, arguments_, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

function commandStatus(
  executable: string,
  arguments_: readonly string[]
): boolean {
  try {
    command(executable, arguments_)
    return true
  } catch {
    return false
  }
}
