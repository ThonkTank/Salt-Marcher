import { existsSync, lstatSync, readdirSync, statfsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const minimumWorkspaceBytes = 512 * 1024 * 1024
const minimumInstallationReserveBytes = 256 * 1024 * 1024

export interface HandoffResourceSnapshot {
  readonly workspaceAvailableBytes: number
  readonly installationAvailableBytes: number
  readonly campaignDataBytes: number
}

export function readHandoffResourceSnapshot(
  workspaceRoot: string,
  installationRoot: string,
  campaignDataRoot: string
): HandoffResourceSnapshot {
  return {
    workspaceAvailableBytes: availableBytes(workspaceRoot),
    installationAvailableBytes: availableBytes(
      nearestExistingDirectory(installationRoot)
    ),
    campaignDataBytes: treeBytes(campaignDataRoot)
  }
}

export function assertHandoffResourcePreflight(
  snapshot: HandoffResourceSnapshot
): void {
  if (snapshot.workspaceAvailableBytes < minimumWorkspaceBytes)
    throw new Error(
      `Handoff workspace preflight requires ${minimumWorkspaceBytes} free bytes; found ${snapshot.workspaceAvailableBytes}`
    )
  const installationRequired =
    minimumInstallationReserveBytes + snapshot.campaignDataBytes * 2
  if (snapshot.installationAvailableBytes < installationRequired)
    throw new Error(
      `Handoff installation preflight requires ${installationRequired} free bytes; found ${snapshot.installationAvailableBytes}`
    )
}

function availableBytes(path: string): number {
  const stats = statfsSync(path)
  return stats.bavail * stats.bsize
}

function nearestExistingDirectory(path: string): string {
  let current = path
  while (!existsSync(current)) {
    const parent = dirname(current)
    if (parent === current) throw new Error(`No existing parent for ${path}`)
    current = parent
  }
  return current
}

function treeBytes(root: string): number {
  if (!existsSync(root)) return 0
  let total = 0
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    const stats = lstatSync(path)
    if (stats.isSymbolicLink())
      throw new Error(`Campaign data contains a symbolic link: ${path}`)
    if (stats.isDirectory()) total += treeBytes(path)
    else if (stats.isFile()) total += stats.size
    else throw new Error(`Campaign data contains an unsupported entry: ${path}`)
  }
  return total
}
