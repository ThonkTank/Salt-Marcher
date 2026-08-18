import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import {
  githubWorkflowRunSchema,
  handoffInvocationHistorySchema,
  handoffReceiptSchema,
  readRequiredJobManifest,
  verifyRequiredJobs,
  type GithubWorkflowRun,
  type WorkflowEvidence
} from './delivery-contract.js'

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
    )
      return verifyRequiredJobs(manifest, run, head)
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
  const successful = runSummaries.find(
    (run) =>
      run.headSha === head &&
      run.status === 'completed' &&
      run.conclusion === 'success'
  )
  const candidate = successful
    ? verifyRequiredJobs(
        manifest,
        githubWorkflowRunSchema.parse(
          JSON.parse(
            command('gh', [
              'run',
              'view',
              String(successful.databaseId),
              '--json',
              'databaseId,headSha,status,conclusion,url,attempt,jobs'
            ])
          )
        ),
        head
      )
    : null
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
  return state
}

export function assertCompletedHandoffReceipt(
  head: string,
  candidate: WorkflowEvidence,
  workspaceRoot = process.cwd()
): void {
  const path = resolve(
    workspaceRoot,
    '.tmp',
    'handoff-local-app',
    'handoff-receipt.json'
  )
  if (!existsSync(path)) throw new Error('Final handoff receipt is missing.')
  const receipt = handoffReceiptSchema.parse(
    JSON.parse(readFileSync(path, 'utf8'))
  )
  const history = handoffInvocationHistorySchema.parse(
    JSON.parse(
      readFileSync(
        resolve(workspaceRoot, '.tmp', 'handoff-local-app', 'invocations.json'),
        'utf8'
      )
    )
  )
  const invocations = history.invocations.filter(
    ({ applicationSha }) => applicationSha === head
  )
  if (
    receipt.status !== 'complete' ||
    receipt.identity.commit !== head ||
    receipt.identity.dirty !== false ||
    JSON.stringify(receipt.identity.candidate) !== JSON.stringify(candidate) ||
    receipt.steps.some((step) => step.status !== 'completed') ||
    invocations.length !== 1 ||
    invocations[0]?.invocationId !== receipt.invocationId
  )
    throw new Error('Final handoff receipt does not prove this clean SHA.')
}

export function promoteCandidate(state: CandidateState): void {
  assertCandidateState(state)
  assertCompletedHandoffReceipt(state.head, state.candidate!)
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
