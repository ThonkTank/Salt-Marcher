// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ModuleHost } from '../../src/renderer/shell/module-host.js'

const labels = {
  loadingMessage: 'Hex-Editor wird geladen …',
  failureMessage:
    'Der Arbeitsbereich „Hex-Editor“ konnte nicht geladen werden.',
  recoveryMessage: 'Versuche es erneut.',
  retryLabel: 'Arbeitsbereich erneut öffnen',
  reloadLabel: 'Anwendung neu laden'
}

describe('ModuleHost', () => {
  afterEach(cleanup)

  it('keeps the surrounding shell visible while its module is pending', () => {
    render(
      <main>
        <nav>Shell-Navigation</nav>
        <ModuleHost
          {...labels}
          workspace="hex"
          load={() => new Promise<{ default: () => null }>(() => undefined)}
          componentProps={{}}
          reportIncident={vi.fn()}
          reloadRenderer={vi.fn()}
        />
      </main>
    )

    expect(screen.getByText('Shell-Navigation')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(labels.loadingMessage)
  })

  it('distinguishes a rejected module and offers local and renderer recovery', async () => {
    const reloadRenderer = vi.fn().mockResolvedValue(undefined)
    const reportIncident = vi.fn().mockResolvedValue(undefined)
    const load = vi.fn().mockRejectedValue(new Error('stale chunk'))

    render(
      <ModuleHost
        {...labels}
        workspace="hex"
        load={load}
        componentProps={{}}
        reportIncident={reportIncident}
        reloadRenderer={reloadRenderer}
      />
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      labels.failureMessage
    )
    expect(reportIncident).toHaveBeenCalledWith(
      expect.objectContaining({ workspace: 'hex', phase: 'module-load' })
    )

    fireEvent.click(screen.getByRole('button', { name: labels.reloadLabel }))
    expect(reloadRenderer).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: labels.retryLabel }))
    expect(load).toHaveBeenCalledTimes(2)
  })
})
