import { useCallback, useEffect, useRef, useState } from 'react'
import type { SessionLayoutPreference } from '../../shared/contracts/session-layout.js'
import type { InstallationPreferences } from '../../shared/contracts/settings.js'
import { defaultSessionLayoutPreferenceValue } from '../../shared/values/session-layout-values.js'
import { capabilityErrorCode } from '../../shared/errors/capability-error.js'
import { capabilityErrorMessage, message } from '../i18n/messages.de.js'
import { useCapabilityApi } from '../capabilities/use-capability-api.js'
import { useAsyncCommandCoordinator } from '../async/use-async-command-coordinator.js'
import { useInstallationSettingsProjection } from './use-installation-settings-projection.js'

export function useInstallationPreferences(
  onError: (message: string) => void,
  enabled = true
) {
  const capabilityApi = useCapabilityApi()
  const commands = useAsyncCommandCoordinator()
  const { snapshot: projectionSnapshot, projection } =
    useInstallationSettingsProjection(enabled)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [sessionLayout, setSessionLayout] = useState<SessionLayoutPreference>(
    defaultSessionLayoutPreferenceValue
  )
  const loaded = useRef(false)
  const savedLayout = useRef('')
  const reportedFailure = useRef<unknown>(null)

  useEffect(() => {
    const value = projectionSnapshot.value
    if (loaded.current || value === null) return
    loaded.current = true
    savedLayout.current = JSON.stringify(value.preferences.sessionLayout)
    setSessionLayout(value.preferences.sessionLayout)
    setTheme(value.preferences.theme)
  }, [projectionSnapshot.value])

  useEffect(() => {
    if (
      projectionSnapshot.status === 'failure' &&
      reportedFailure.current !== projectionSnapshot
    ) {
      reportedFailure.current = projectionSnapshot
      onError(capabilityErrorMessage(projectionSnapshot.cause))
    }
  }, [onError, projectionSnapshot])

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme
  }, [theme])

  const save = useCallback(
    (patch: Partial<InstallationPreferences>) => {
      void commands
        .run({
          scope: 'installation.preferences',
          mode: 'queue',
          execute: async () => {
            let current = projection.current()
            if (current === null) return null
            let notice: string | null = null
            try {
              current = await capabilityApi.settings.update({
                patch,
                expectedRevision: current.revision
              })
            } catch (cause) {
              const fresh = await projection.refresh()
              if (capabilityErrorCode(cause) === 'outcome_unknown') {
                current = fresh
                const committed = Object.entries(patch).every(
                  ([key, value]) =>
                    JSON.stringify(
                      fresh.preferences[key as keyof InstallationPreferences]
                    ) === JSON.stringify(value)
                )
                notice = committed
                  ? message('settings.outcome_committed')
                  : message('settings.outcome_not_committed')
              } else if (capabilityErrorCode(cause) === 'stale') {
                current = await capabilityApi.settings.update({
                  patch,
                  expectedRevision: fresh.revision
                })
              } else {
                throw cause
              }
            }
            return { settings: current, notice }
          },
          accept: (result) => {
            if (result === null) return
            projection.publish(result.settings)
            if (result.notice) onError(result.notice)
          }
        })
        .then((outcome) => {
          if (
            outcome.status === 'failure' &&
            projection.snapshot().cause !== outcome.cause
          )
            onError(capabilityErrorMessage(outcome.cause))
        })
    },
    [capabilityApi, commands, onError, projection]
  )

  useEffect(() => {
    if (!loaded.current) return
    const serialized = JSON.stringify(sessionLayout)
    if (serialized === savedLayout.current) return
    const timer = window.setTimeout(() => {
      savedLayout.current = serialized
      save({ sessionLayout })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [save, sessionLayout])

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      save({ theme: next })
      return next
    })
  }, [save])

  return { theme, toggleTheme, sessionLayout, setSessionLayout }
}
