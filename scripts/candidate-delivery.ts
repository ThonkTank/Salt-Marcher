import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const shaPattern = /^[a-f0-9]{40}$/

export type CandidateState = Readonly<{
  branch: string
  upstream: string
  head: string
  upstreamHead: string
  remoteMain: string
  clean: boolean
  mainIsAncestor: boolean
  successfulCheckUrl: string | null
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
  if (!state.successfulCheckUrl)
    throw new Error('No successful remote Check workflow proves this SHA.')
}

export function parseRemoteHead(output: string): string {
  const [sha] = output.trim().split(/\s+/)
  if (!shaPattern.test(sha ?? ''))
    throw new Error('Could not resolve origin/main from the live remote.')
  return sha!
}

export function successfulCheckUrl(
  runs: readonly Readonly<{
    headSha: string
    status: string
    conclusion: string
    url: string
  }>[],
  head: string
): string | null {
  return (
    runs.find(
      (run) =>
        run.headSha === head &&
        run.status === 'completed' &&
        run.conclusion === 'success'
    )?.url ?? null
  )
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
  const runs = JSON.parse(
    command('gh', [
      'run',
      'list',
      '--workflow',
      'Check',
      '--commit',
      head,
      '--limit',
      '20',
      '--json',
      'headSha,status,conclusion,url'
    ])
  ) as ReadonlyArray<{
    headSha: string
    status: string
    conclusion: string
    url: string
  }>
  return {
    branch,
    upstream,
    head,
    upstreamHead,
    remoteMain,
    clean,
    mainIsAncestor,
    successfulCheckUrl: successfulCheckUrl(runs, head)
  }
}

export function assertCandidateReady(): CandidateState {
  const state = readCandidateState()
  assertCandidateState(state)
  return state
}

export function assertCompletedHandoffReceipt(head: string): void {
  const path = resolve('.tmp', 'handoff-local-app', 'handoff-receipt.json')
  if (!existsSync(path)) throw new Error('Final handoff receipt is missing.')
  const receipt = JSON.parse(readFileSync(path, 'utf8')) as {
    status?: unknown
    identity?: { commit?: unknown; dirty?: unknown }
    steps?: Array<{ status?: unknown }>
  }
  if (
    receipt.status !== 'complete' ||
    receipt.identity?.commit !== head ||
    receipt.identity.dirty !== false ||
    !Array.isArray(receipt.steps) ||
    receipt.steps.length === 0 ||
    receipt.steps.some((step) => step.status !== 'completed')
  )
    throw new Error('Final handoff receipt does not prove this clean SHA.')
}

export function promoteCandidate(state: CandidateState): void {
  assertCandidateState(state)
  assertCompletedHandoffReceipt(state.head)
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
