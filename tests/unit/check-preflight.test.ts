import { describe, expect, it } from 'vitest'
import { evaluateCheckPreflight } from '../../scripts/check-preflight.js'

const MEBIBYTE = 1024 * 1024

describe('local check preflight', () => {
  const healthy = {
    resources: {
      source: 'linux-proc-meminfo' as const,
      memoryAvailableBytes: 1_024 * MEBIBYTE,
      swapFreeBytes: 1_536 * MEBIBYTE
    },
    workspaceAvailableBytes: 1_024 * MEBIBYTE,
    nodeVersion: 'v22.19.0',
    pnpmVersion: '10.15.1',
    expectedPnpmVersion: '10.15.1'
  }

  it('passes only when memory, disk and toolchain all qualify', () => {
    expect(evaluateCheckPreflight(healthy)).toMatchObject({
      status: 'passed',
      reasons: []
    })
    const failed = evaluateCheckPreflight({
      ...healthy,
      workspaceAvailableBytes: 1,
      nodeVersion: 'v20.1.0',
      pnpmVersion: '9.0.0'
    })
    expect(failed.status).toBe('failed')
    expect(failed.reasons).toHaveLength(3)
  })

  it('surfaces the existing E2E memory requirement before expensive work', () => {
    const failed = evaluateCheckPreflight({
      ...healthy,
      resources: {
        ...healthy.resources,
        memoryAvailableBytes: 512 * MEBIBYTE
      }
    })
    expect(failed.status).toBe('failed')
    expect(failed.reasons.join(' ')).toContain('available memory')
  })

  it('reserves runner overhead before starting the expensive phases', () => {
    const failed = evaluateCheckPreflight({
      ...healthy,
      resources: {
        ...healthy.resources,
        swapFreeBytes: 1_024 * MEBIBYTE
      }
    })
    expect(failed.status).toBe('failed')
    expect(failed.reasons.join(' ')).toContain('E2E launch overhead')
  })
})
