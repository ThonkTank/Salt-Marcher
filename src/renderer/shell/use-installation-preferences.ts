import { useCallback, useEffect, useRef, useState } from 'react'
import { defaultSessionLayoutPreference } from '../../shared/contracts/session-layout.js'
import type {
  InstallationPreferences,
  InstallationSettings
} from '../../shared/contracts/settings.js'
import { capabilityErrorCode } from '../../shared/errors/capability-error.js'
import { capabilityErrorMessage, message } from '../i18n/messages.de.js'

export function useInstallationPreferences(onError: (message: string) => void) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [sessionLayout, setSessionLayout] = useState(
    defaultSessionLayoutPreference
  )
  const loaded = useRef(false)
  const savedLayout = useRef('')
  const settings = useRef<InstallationSettings | null>(null)
  const writeQueue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    void window.saltMarcher.settings
      .read()
      .then((value) => {
        settings.current = value
        loaded.current = true
        savedLayout.current = JSON.stringify(value.preferences.sessionLayout)
        setSessionLayout(value.preferences.sessionLayout)
        setTheme(value.preferences.theme)
      })
      .catch((cause: unknown) => onError(capabilityErrorMessage(cause)))
  }, [onError])

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme
  }, [theme])

  const save = useCallback(
    (patch: Partial<InstallationPreferences>) => {
      writeQueue.current = writeQueue.current
        .then(async () => {
          let current = settings.current
          if (current === null) return
          try {
            current = await window.saltMarcher.settings.update(
              patch,
              current.revision
            )
          } catch (cause) {
            const fresh = await window.saltMarcher.settings.read()
            if (capabilityErrorCode(cause) === 'outcome_unknown') {
              current = fresh
              const committed = Object.entries(patch).every(
                ([key, value]) =>
                  JSON.stringify(
                    fresh.preferences[key as keyof InstallationPreferences]
                  ) === JSON.stringify(value)
              )
              onError(
                committed
                  ? message('settings.outcome_committed')
                  : message('settings.outcome_not_committed')
              )
            } else if (capabilityErrorCode(cause) === 'stale') {
              current = await window.saltMarcher.settings.update(
                patch,
                fresh.revision
              )
            } else {
              throw cause
            }
          }
          settings.current = current
        })
        .catch((cause: unknown) => onError(capabilityErrorMessage(cause)))
    },
    [onError]
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
