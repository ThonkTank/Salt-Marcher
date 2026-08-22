import { execFileSync } from 'node:child_process'
import { statfsSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import {
  e2eResourceRequirements,
  evaluateE2eResourcePreflight,
  readE2eResourceSnapshot,
  type E2eResourcePreflight,
  type E2eResourceSnapshot
} from './e2e-resource-preflight.js'

const MEBIBYTE = 1024 * 1024

export const checkPreflightRequirements = Object.freeze({
  minimumWorkspaceAvailableBytes: 512 * MEBIBYTE,
  minimumE2eLaunchOverheadBytes: 256 * MEBIBYTE,
  nodeMajor: 22
})

export type CheckPreflightSnapshot = Readonly<{
  resources: E2eResourceSnapshot
  workspaceAvailableBytes: number
  nodeVersion: string
  pnpmVersion: string
  expectedPnpmVersion: string
}>

export type CheckPreflight = Readonly<{
  status: 'passed' | 'failed'
  snapshot: CheckPreflightSnapshot
  resourcePreflight: E2eResourcePreflight
  requirements: typeof checkPreflightRequirements
  reasons: readonly string[]
}>

export function readCheckPreflightSnapshot(
  workspaceRoot = process.cwd()
): CheckPreflightSnapshot {
  const packageJson = z
    .object({ packageManager: z.string() })
    .passthrough()
    .parse(
      JSON.parse(readFileSync(resolve(workspaceRoot, 'package.json'), 'utf8'))
    )
  const expectedPnpmVersion = /^pnpm@([^+]+)(?:\+.*)?$/.exec(
    packageJson.packageManager
  )?.[1]
  if (!expectedPnpmVersion)
    throw new Error('package.json does not pin a valid pnpm version')
  const filesystem = statfsSync(workspaceRoot)
  return {
    resources: readE2eResourceSnapshot(),
    workspaceAvailableBytes: filesystem.bavail * filesystem.bsize,
    nodeVersion: process.version,
    pnpmVersion: execFileSync('corepack', ['pnpm', '--version'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim(),
    expectedPnpmVersion
  }
}

export function evaluateCheckPreflight(
  snapshot: CheckPreflightSnapshot
): CheckPreflight {
  const resourcePreflight = evaluateE2eResourcePreflight(snapshot.resources)
  const combinedHeadroom =
    snapshot.resources.memoryAvailableBytes + snapshot.resources.swapFreeBytes
  const requiredCombinedHeadroom =
    e2eResourceRequirements.minimumCombinedHeadroomBytes +
    checkPreflightRequirements.minimumE2eLaunchOverheadBytes
  const reasons = [
    ...(resourcePreflight.reason ? [resourcePreflight.reason] : []),
    ...(!resourcePreflight.reason && combinedHeadroom < requiredCombinedHeadroom
      ? [
          `memory plus free swap ${combinedHeadroom} bytes does not reserve the ${checkPreflightRequirements.minimumE2eLaunchOverheadBytes}-byte E2E launch overhead (requires ${requiredCombinedHeadroom})`
        ]
      : []),
    ...(snapshot.workspaceAvailableBytes <
    checkPreflightRequirements.minimumWorkspaceAvailableBytes
      ? [
          `workspace free space ${snapshot.workspaceAvailableBytes} bytes is below ${checkPreflightRequirements.minimumWorkspaceAvailableBytes}`
        ]
      : []),
    ...(nodeMajor(snapshot.nodeVersion) !== checkPreflightRequirements.nodeMajor
      ? [
          `Node ${snapshot.nodeVersion} does not match required major ${checkPreflightRequirements.nodeMajor}`
        ]
      : []),
    ...(snapshot.pnpmVersion !== snapshot.expectedPnpmVersion
      ? [
          `pnpm ${snapshot.pnpmVersion} does not match pinned ${snapshot.expectedPnpmVersion}`
        ]
      : [])
  ]
  return {
    status: reasons.length === 0 ? 'passed' : 'failed',
    snapshot,
    resourcePreflight,
    requirements: checkPreflightRequirements,
    reasons
  }
}

function nodeMajor(version: string): number | null {
  const match = /^v(\d+)\./.exec(version)
  return match ? Number(match[1]) : null
}
