// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { lazy } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceLoadBoundary } from '../../src/renderer/features/workspace/workspace-load-boundary.js'

const labels = {
  loadingMessage: 'Hex-Editor wird geladen …',
  failureMessage:
    'Der Arbeitsbereich „Hex-Editor“ konnte nicht geladen werden.',
  recoveryMessage: 'Lade die Anwendung neu.',
  reloadLabel: 'Anwendung neu laden'
}

describe('WorkspaceLoadBoundary', () => {
  afterEach(cleanup)

  it('keeps the surrounding shell visible while a workspace is pending', () => {
    const PendingWorkspace = lazy(
      () => new Promise<{ default: () => null }>(() => undefined)
    )

    render(
      <main>
        <nav>Shell-Navigation</nav>
        <WorkspaceLoadBoundary {...labels}>
          <PendingWorkspace />
        </WorkspaceLoadBoundary>
      </main>
    )

    expect(screen.getByText('Shell-Navigation')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Hex-Editor wird geladen …'
    )
  })

  it('contains a rejected lazy import and offers renderer recovery', async () => {
    const reload = vi.fn()
    const report = vi.fn()
    const FailedWorkspace = lazy(() =>
      Promise.reject(new Error('stale development chunk'))
    )

    render(
      <main>
        <nav>Shell-Navigation</nav>
        <WorkspaceLoadBoundary {...labels} reload={reload} onError={report}>
          <FailedWorkspace />
        </WorkspaceLoadBoundary>
      </main>
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Der Arbeitsbereich „Hex-Editor“ konnte nicht geladen werden.'
    )
    expect(screen.getByText('Shell-Navigation')).toBeVisible()
    expect(report).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Anwendung neu laden' }))
    expect(reload).toHaveBeenCalledOnce()
  })
})
