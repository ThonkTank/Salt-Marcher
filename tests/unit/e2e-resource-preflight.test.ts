import { describe, expect, it } from 'vitest'
import {
  cgroupMemoryEventsPath,
  cgroupOomKillAdvanced,
  evaluateE2eResourcePreflight,
  kernelOomLines,
  parseCgroupMemoryEvents,
  parseLinuxMeminfo
} from '../../scripts/e2e-resource-preflight.js'

const MEBIBYTE = 1024 * 1024

describe('Electron E2E resource diagnostics', () => {
  it('passes with sufficient memory/swap headroom and rejects both deficits', () => {
    const healthy = parseLinuxMeminfo(
      'MemAvailable:    1572864 kB\nSwapFree:        1048576 kB\n'
    )
    expect(evaluateE2eResourcePreflight(healthy)).toMatchObject({
      status: 'passed',
      reason: null
    })
    const lowMemory = evaluateE2eResourcePreflight({
      source: 'linux-proc-meminfo',
      memoryAvailableBytes: 512 * MEBIBYTE,
      swapFreeBytes: 4_096 * MEBIBYTE
    })
    expect(lowMemory.status).toBe('failed')
    expect(lowMemory.reason).toContain('memory')
    const lowCombinedHeadroom = evaluateE2eResourcePreflight({
      source: 'linux-proc-meminfo',
      memoryAvailableBytes: 1_024 * MEBIBYTE,
      swapFreeBytes: 512 * MEBIBYTE
    })
    expect(lowCombinedHeadroom.status).toBe('failed')
    expect(lowCombinedHeadroom.reason).toContain('memory plus free swap')
  })

  it('detects a cgroup OOM increment and keeps only relevant kernel lines', () => {
    expect(cgroupMemoryEventsPath('0::/user.slice/e2e.scope\n')).toBe(
      '/sys/fs/cgroup/user.slice/e2e.scope/memory.events'
    )
    const before = parseCgroupMemoryEvents('oom 2\noom_kill 1\n')
    const after = parseCgroupMemoryEvents('oom 3\noom_kill 2\n')
    expect(cgroupOomKillAdvanced(before, after)).toBe(true)
    expect(cgroupOomKillAdvanced(after, after)).toBe(false)
    expect(
      kernelOomLines(
        [
          'Out of memory: Killed process 42 (electron)',
          'Out of memory: Killed process 43 (unrelated-daemon)',
          'electron exited normally'
        ].join('\n')
      )
    ).toEqual(['Out of memory: Killed process 42 (electron)'])
  })
})
