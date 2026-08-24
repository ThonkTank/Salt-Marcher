// @vitest-environment jsdom

import { act, render, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CapabilityProvider } from '../../src/renderer/capabilities/capability-provider.js'
import { useInstallationPreferences } from '../../src/renderer/shell/use-installation-preferences.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type { InstallationSettings } from '../../src/shared/contracts/settings.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'
import { defaultSessionLayoutPreferenceValue } from '../../src/shared/values/session-layout-values.js'

describe('Installation settings projection', () => {
  it('deduplicates the initial read across two preference consumers', async () => {
    const pending = deferred<InstallationSettings>()
    const read = vi.fn(() => pending.promise)
    const onError = vi.fn()
    const hook = renderHook(
      () => [
        useInstallationPreferences(onError),
        useInstallationPreferences(onError)
      ],
      { wrapper: provider(settingsApi(read)) }
    )

    await waitFor(() => expect(read).toHaveBeenCalledTimes(1))
    act(() => pending.resolve(settings(1, 'dark')))
    await waitFor(() => {
      expect(hook.result.current[0]?.theme).toBe('dark')
      expect(hook.result.current[1]?.theme).toBe('dark')
    })
    expect(onError).not.toHaveBeenCalled()
  })

  it('keeps a provider-owned read alive across consumer unmount and remount', async () => {
    const pending = deferred<InstallationSettings>()
    const read = vi.fn(() => pending.promise)
    const api = settingsApi(read)
    const onError = vi.fn()
    const view = render(
      <CapabilityProvider api={api}>
        <PreferenceProbe visible onError={onError} />
      </CapabilityProvider>
    )
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1))

    view.rerender(
      <CapabilityProvider api={api}>
        <PreferenceProbe visible={false} onError={onError} />
      </CapabilityProvider>
    )
    act(() => pending.resolve(settings(2, 'dark')))
    view.rerender(
      <CapabilityProvider api={api}>
        <PreferenceProbe visible onError={onError} />
      </CapabilityProvider>
    )

    await waitFor(() =>
      expect(view.getByTestId('theme').textContent).toBe('dark')
    )
    expect(read).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it('reports a failed write reconciliation read only once', async () => {
    const readFailure = new Error('settings read failed')
    const read = vi
      .fn<() => Promise<InstallationSettings>>()
      .mockResolvedValueOnce(settings(1, 'dark'))
      .mockRejectedValueOnce(readFailure)
    const update = vi.fn().mockRejectedValue(new CapabilityError('stale', true))
    const onError = vi.fn()
    const hook = renderHook(
      (props: { onError: (message: string) => void }) =>
        useInstallationPreferences(props.onError),
      {
        initialProps: { onError },
        wrapper: provider(settingsApi(read, update))
      }
    )
    await waitFor(() => expect(hook.result.current.theme).toBe('dark'))

    act(() => hook.result.current.toggleTheme())

    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
    await act(async () => Promise.resolve())
    expect(onError).toHaveBeenCalledTimes(1)
    const replacementOnError = vi.fn()
    hook.rerender({ onError: replacementOnError })
    expect(replacementOnError).not.toHaveBeenCalled()
  })
})

function PreferenceProbe(props: {
  visible: boolean
  onError: (message: string) => void
}) {
  if (!props.visible) return null
  return <PreferenceValue onError={props.onError} />
}

function PreferenceValue(props: { onError: (message: string) => void }) {
  const preferences = useInstallationPreferences(props.onError)
  return <span data-testid="theme">{preferences.theme}</span>
}

function provider(api: SaltMarcherApi) {
  return function TestCapabilityProvider(props: { children: ReactNode }) {
    return <CapabilityProvider api={api}>{props.children}</CapabilityProvider>
  }
}

function settingsApi(
  read: () => Promise<InstallationSettings>,
  update = vi.fn()
): SaltMarcherApi {
  return {
    settings: {
      read,
      update
    }
  } as unknown as SaltMarcherApi
}

function settings(
  revision: number,
  theme: InstallationSettings['preferences']['theme']
): InstallationSettings {
  return Object.freeze({
    revision,
    preferences: Object.freeze({
      theme,
      sessionLayout: defaultSessionLayoutPreferenceValue
    })
  })
}

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void
  const promise = new Promise<Value>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
