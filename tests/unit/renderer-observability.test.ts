import type { WebContents } from 'electron'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { observeRendererProcess } from '../../src/main/windows/renderer-observability.js'

describe('renderer process observability', () => {
  afterEach(() => vi.restoreAllMocks())

  it('registers native failure signals and redacts preload paths', () => {
    const listeners = new Map<string, (...args: never[]) => void>()
    const webContents = {
      on: vi.fn((event: string, listener: (...args: never[]) => void) => {
        listeners.set(event, listener)
      })
    } as unknown as WebContents
    const logged = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    observeRendererProcess(webContents)

    expect([...listeners.keys()]).toEqual(
      expect.arrayContaining([
        'did-fail-load',
        'preload-error',
        'render-process-gone',
        'unresponsive'
      ])
    )
    listeners.get('preload-error')?.(
      {} as never,
      '/private/user/preload.js' as never,
      new TypeError('secret') as never
    )
    expect(logged).toHaveBeenCalledOnce()
    expect(String(logged.mock.calls[0]?.[0])).toContain('preload-error')
    expect(String(logged.mock.calls[0]?.[0])).toContain('TypeError')
    expect(String(logged.mock.calls[0]?.[0])).not.toContain('/private/user')
    expect(String(logged.mock.calls[0]?.[0])).not.toContain('secret')
  })
})
