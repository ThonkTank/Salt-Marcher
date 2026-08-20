import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { freemem } from 'node:os'
import { resolve } from 'node:path'

const MEBIBYTE = 1024 * 1024

export const e2eResourceRequirements = Object.freeze({
  minimumMemoryAvailableBytes: 768 * MEBIBYTE,
  minimumCombinedHeadroomBytes: 2_048 * MEBIBYTE
})

export type E2eResourceSnapshot = Readonly<{
  source: 'linux-proc-meminfo' | 'os-fallback'
  memoryAvailableBytes: number
  swapFreeBytes: number
}>

export type E2eResourcePreflight = Readonly<{
  status: 'passed' | 'failed'
  snapshot: E2eResourceSnapshot
  requirements: typeof e2eResourceRequirements
  reason: string | null
}>

export type CgroupMemoryEvents = Readonly<{
  oom: number
  oomKill: number
}>

export function readE2eResourceSnapshot(): E2eResourceSnapshot {
  if (process.platform === 'linux')
    try {
      return parseLinuxMeminfo(readFileSync('/proc/meminfo', 'utf8'))
    } catch {
      // Portable fallback still fails closed against the same memory limit.
    }
  return {
    source: 'os-fallback',
    memoryAvailableBytes: freemem(),
    swapFreeBytes: 0
  }
}

export function parseLinuxMeminfo(content: string): E2eResourceSnapshot {
  const values = new Map(
    content.split('\n').flatMap((line) => {
      const match = /^(MemAvailable|SwapFree):\s+(\d+)\s+kB$/.exec(line)
      return match ? [[match[1]!, Number(match[2]) * 1024] as const] : []
    })
  )
  const memoryAvailableBytes = values.get('MemAvailable')
  const swapFreeBytes = values.get('SwapFree')
  if (memoryAvailableBytes === undefined || swapFreeBytes === undefined)
    throw new Error('Linux memory information is incomplete.')
  return {
    source: 'linux-proc-meminfo',
    memoryAvailableBytes,
    swapFreeBytes
  }
}

export function evaluateE2eResourcePreflight(
  snapshot: E2eResourceSnapshot
): E2eResourcePreflight {
  const combined = snapshot.memoryAvailableBytes + snapshot.swapFreeBytes
  const reason =
    snapshot.memoryAvailableBytes <
    e2eResourceRequirements.minimumMemoryAvailableBytes
      ? `available memory ${formatMebibytes(snapshot.memoryAvailableBytes)} is below ${formatMebibytes(e2eResourceRequirements.minimumMemoryAvailableBytes)}`
      : combined < e2eResourceRequirements.minimumCombinedHeadroomBytes
        ? `memory plus free swap ${formatMebibytes(combined)} is below ${formatMebibytes(e2eResourceRequirements.minimumCombinedHeadroomBytes)}`
        : null
  return {
    status: reason ? 'failed' : 'passed',
    snapshot,
    requirements: e2eResourceRequirements,
    reason
  }
}

export function readCgroupMemoryEvents(): CgroupMemoryEvents | null {
  if (process.platform !== 'linux') return null
  try {
    return parseCgroupMemoryEvents(
      readFileSync(
        cgroupMemoryEventsPath(readFileSync('/proc/self/cgroup', 'utf8')),
        'utf8'
      )
    )
  } catch {
    return null
  }
}

export function cgroupMemoryEventsPath(content: string): string {
  const unified = content
    .split('\n')
    .map((line) => /^0::(\/.*)$/.exec(line)?.[1])
    .find((path) => path !== undefined)
  if (!unified) throw new Error('No unified cgroup v2 path is available.')
  return resolve('/sys/fs/cgroup', unified.replace(/^\/+/, ''), 'memory.events')
}

export function parseCgroupMemoryEvents(content: string): CgroupMemoryEvents {
  const values = new Map(
    content.split('\n').flatMap((line) => {
      const match = /^(oom|oom_kill)\s+(\d+)$/.exec(line)
      return match ? [[match[1]!, Number(match[2])] as const] : []
    })
  )
  return { oom: values.get('oom') ?? 0, oomKill: values.get('oom_kill') ?? 0 }
}

export function cgroupOomKillAdvanced(
  before: CgroupMemoryEvents | null,
  after: CgroupMemoryEvents | null
): boolean {
  return before !== null && after !== null && after.oomKill > before.oomKill
}

export function readRecentKernelOomLines(startedAt: number): string[] {
  if (process.platform !== 'linux') return []
  try {
    const output = execFileSync(
      'journalctl',
      [
        '--dmesg',
        '--since',
        `@${Math.floor(startedAt / 1000)}`,
        '--no-pager',
        '--output=cat'
      ],
      {
        encoding: 'utf8',
        timeout: 2_000,
        maxBuffer: 2 * MEBIBYTE,
        stdio: ['ignore', 'pipe', 'ignore']
      }
    )
    return kernelOomLines(output)
  } catch {
    return []
  }
}

export function kernelOomLines(content: string): string[] {
  return content
    .split('\n')
    .filter(
      (line) =>
        /(?:out of memory|oom-kill|killed process|memory cgroup out of memory)/i.test(
          line
        ) && /(?:electron|chrome|chromedriver|node)/i.test(line)
    )
}

function formatMebibytes(value: number): string {
  return `${Math.floor(value / MEBIBYTE)} MiB`
}
