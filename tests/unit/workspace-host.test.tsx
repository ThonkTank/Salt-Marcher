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
  reloadLabel: 'Anwendung neu laden',
  recoveryPolicy: {
    moduleFailure: 'retry-or-reload',
    renderFailure: 'remount'
  } as const
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

  it('isolates render failures and can return to the safe session', async () => {
    const returnToSafeSurface = vi.fn()
    const reportIncident = vi.fn().mockResolvedValue(undefined)
    const Broken = () => {
      throw new Error('render broke')
    }
    render(
      <main>
        <nav>Shell-Navigation</nav>
        <ModuleHost
          {...labels}
          recoveryPolicy={{
            moduleFailure: 'retry-or-reload',
            renderFailure: 'remount-or-return'
          }}
          workspace="catalog"
          load={vi.fn().mockResolvedValue({ default: Broken })}
          componentProps={{}}
          returnLabel="Zur Session"
          returnToSafeSurface={returnToSafeSurface}
          reportIncident={reportIncident}
          reloadRenderer={vi.fn()}
        />
      </main>
    )

    expect(await screen.findByRole('alert')).toBeVisible()
    expect(screen.getByText('Shell-Navigation')).toBeVisible()
    expect(reportIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'workspace',
        workspace: 'catalog',
        phase: 'render',
        recoveryClass: 'return-session'
      })
    )
    expect(
      screen.queryByRole('button', { name: labels.reloadLabel })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Zur Session' }))
    expect(returnToSafeSurface).toHaveBeenCalledOnce()
  })
})
