// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import {
  capabilityErrorText,
  presentCapabilityError
} from '../../src/renderer/capabilities/capability-errors.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'

describe('capability error presentation policy', () => {
  it.each(['validation_failed', 'stale'] as const)('keeps %s local', (code) => {
    const report = vi.fn()
    expect(
      presentCapabilityError(new CapabilityError(code, false), report)
    ).not.toBe('')
    expect(report).not.toHaveBeenCalled()
  })

  it('reports an unexpected failure exactly once', () => {
    const report = vi.fn()
    const text = presentCapabilityError(new Error('offline'), report)
    expect(report).toHaveBeenCalledOnce()
    expect(report).toHaveBeenCalledWith(text)
  })

  it('recovers a known code from Electron reduced Error messages', () => {
    expect(capabilityErrorText(new Error('internal'))).toBe(
      'Ein interner Fehler ist aufgetreten.'
    )
    expect(capabilityErrorText(new Error('not-a-capability-code'))).toBe(
      'Unbekannter Fehler'
    )
  })

  it('requests one readback and reports outcome-unknown exactly once', () => {
    const report = vi.fn()
    const readback = vi.fn()
    window.addEventListener('saltmarcher:readback', readback, { once: true })
    const text = presentCapabilityError(
      new CapabilityError('outcome_unknown', true),
      report
    )
    expect(readback).toHaveBeenCalledOnce()
    expect(report).toHaveBeenCalledOnce()
    expect(report).toHaveBeenCalledWith(text)
  })
})
