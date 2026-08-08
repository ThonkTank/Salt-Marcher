import { useCallback, useState } from 'react'

export type WorkspaceUiError = Readonly<{
  id: number
  scope: 'campaign' | 'session' | 'workspace' | 'settings'
  code: string
  message: string
}>

export function useWorkspaceErrors() {
  const [errors, setErrors] = useState<readonly WorkspaceUiError[]>([])
  const report = useCallback(
    (scope: WorkspaceUiError['scope'], code: string, message: string) => {
      setErrors((current) => [
        ...current,
        { id: Date.now() + current.length, scope, code, message }
      ])
    },
    []
  )
  const dismiss = useCallback(
    (id: number) =>
      setErrors((current) => current.filter((error) => error.id !== id)),
    []
  )
  return { errors, report, dismiss }
}
