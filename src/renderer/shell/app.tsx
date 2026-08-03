import { lazy, Suspense } from 'react'

const Workspace = lazy(async () => {
  const module = await import('../features/workspace/workspace.js')
  return { default: module.WorkspaceApp }
})

/** Global renderer boundary; feature state lives below the workspace route. */
export function App() {
  return (
    <Suspense fallback={<main className="app-shell" aria-busy="true" />}>
      <Workspace />
    </Suspense>
  )
}
