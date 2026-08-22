import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  executeLocalCheck,
  localCheckPhases,
  parseCheckArguments,
  type LocalCheckIdentity,
  type LocalCheckPhaseName
} from '../../scripts/check-runner.js'
import type { CheckPreflight } from '../../scripts/check-preflight.js'

const roots: string[] = []
const hash = 'a'.repeat(64)
const identity: LocalCheckIdentity = {
  workspaceFingerprint: hash,
  toolchainHash: 'b'.repeat(64),
  commandsHash: 'c'.repeat(64),
  inputHash: 'd'.repeat(64)
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('local check runner', () => {
  it('explains the pnpm argument syntax', () => {
    expect(parseCheckArguments([])).toEqual({ resume: false })
    expect(parseCheckArguments(['--resume'])).toEqual({ resume: true })
    expect(() => parseCheckArguments(['--', '--resume'])).toThrow(
      'pnpm check --resume'
    )
  })

  it('resumes only unfinished phases for the exact same input', () => {
    const root = temporaryRoot()
    const executions: LocalCheckPhaseName[] = []
    let fail = true
    const base = {
      workspaceRoot: root,
      stateRoot: join(root, 'states'),
      identity,
      readPreflight: passedPreflight,
      collectEvidence: (phase: LocalCheckPhaseName) =>
        phase === 'portable-app' ? 'e'.repeat(64) : null,
      validateBuildEvidence: () => true,
      runPhase: (phase: LocalCheckPhaseName) => {
        executions.push(phase)
        if (phase === 'functional-e2e' && fail) {
          fail = false
          throw new Error('resource pressure')
        }
      }
    }
    expect(() => executeLocalCheck({ ...base, resume: false })).toThrow(
      'pnpm check --resume'
    )
    expect(executions).toEqual(localCheckPhases.slice(0, 4).map((v) => v.name))
    executions.length = 0
    expect(executeLocalCheck({ ...base, resume: true }).status).toBe('complete')
    expect(executions).toEqual(['functional-e2e', 'visual-e2e'])
  })

  it('reruns build and every downstream phase when build evidence vanished', () => {
    const root = temporaryRoot()
    const executions: LocalCheckPhaseName[] = []
    const base = {
      workspaceRoot: root,
      stateRoot: join(root, 'states'),
      identity,
      readPreflight: passedPreflight,
      collectEvidence: (phase: LocalCheckPhaseName) =>
        phase === 'portable-app' ? 'e'.repeat(64) : null,
      runPhase: (phase: LocalCheckPhaseName) => executions.push(phase)
    }
    executeLocalCheck({
      ...base,
      resume: false,
      validateBuildEvidence: () => true
    })
    executions.length = 0
    executeLocalCheck({
      ...base,
      resume: true,
      validateBuildEvidence: () => false
    })
    expect(executions).toEqual(localCheckPhases.slice(1).map((v) => v.name))
  })

  it('rejects resume when no exact fingerprint state exists', () => {
    const root = temporaryRoot()
    expect(() =>
      executeLocalCheck({
        workspaceRoot: root,
        stateRoot: join(root, 'states'),
        identity: { ...identity, inputHash: 'f'.repeat(64) },
        resume: true,
        readPreflight: passedPreflight
      })
    ).toThrow('No hash-matching local check state')
  })
})

function passedPreflight(): CheckPreflight {
  return {
    status: 'passed',
    snapshot: {
      resources: {
        source: 'linux-proc-meminfo',
        memoryAvailableBytes: 1024,
        swapFreeBytes: 1024
      },
      workspaceAvailableBytes: 1024,
      nodeVersion: 'v22.19.0',
      pnpmVersion: '10.15.1',
      expectedPnpmVersion: '10.15.1'
    },
    resourcePreflight: {
      status: 'passed',
      snapshot: {
        source: 'linux-proc-meminfo',
        memoryAvailableBytes: 1024,
        swapFreeBytes: 1024
      },
      requirements: {
        minimumMemoryAvailableBytes: 1,
        minimumCombinedHeadroomBytes: 1
      },
      reason: null
    },
    requirements: {
      minimumWorkspaceAvailableBytes: 1,
      minimumE2eLaunchOverheadBytes: 1,
      nodeMajor: 22
    },
    reasons: []
  }
}

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-local-check-'))
  roots.push(root)
  return root
}
