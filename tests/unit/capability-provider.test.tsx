// @vitest-environment jsdom

import { StrictMode, useContext, useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CapabilityContext } from '../../src/renderer/capabilities/capability-context.js'
import { CapabilityProvider } from '../../src/renderer/capabilities/capability-provider.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import type { InstallationSettings } from '../../src/shared/contracts/settings.js'

const campaignId = '00000000-0000-4000-8000-000000000010'
const now = '2026-09-02T09:00:00.000Z'

describe('Capability Provider lifecycle', () => {
  it('replaces the StrictMode probe owner and keeps the committed owner usable', async () => {
    const fixture = capabilityFixture('light')
    const view = render(
      <StrictMode>
        <CapabilityProvider api={fixture.api}>
          <CapabilityProbe />
        </CapabilityProvider>
      </StrictMode>
    )

    await screen.findByRole('button', { name: 'Kampagne anlegen' })
    expect(fixture.onChanged).toHaveBeenCalledTimes(2)
    expect(fixture.unsubscribe).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Kampagne anlegen' }))
    await screen.findByText('test:0')
    expect(fixture.list).toHaveBeenCalledOnce()
    expect(fixture.create).toHaveBeenCalledOnce()
    expect(fixture.create.mock.calls[0]?.[0]).toMatchObject({
      expectedRegistryRevision: 0,
      name: 'test'
    })
    expect(fixture.readSession).toHaveBeenCalledWith({ campaignId })

    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen lesen' }))
    await screen.findByText('light')
    expect(fixture.readSettings).toHaveBeenCalledOnce()

    view.unmount()
    expect(fixture.unsubscribe).toHaveBeenCalledTimes(2)
  })

  it('stops exposing an old owner when the capability API changes', async () => {
    const first = capabilityFixture('light')
    const second = capabilityFixture('dark')
    const view = render(
      <StrictMode>
        <CapabilityProvider api={first.api}>
          <CapabilityProbe />
        </CapabilityProvider>
      </StrictMode>
    )
    await screen.findByRole('button', { name: 'Kampagne anlegen' })

    view.rerender(
      <StrictMode>
        <CapabilityProvider api={second.api}>
          <CapabilityProbe />
        </CapabilityProvider>
      </StrictMode>
    )
    await waitFor(() => expect(first.unsubscribe).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Kampagne anlegen' }))
    await screen.findByText('test:0')

    expect(first.create).not.toHaveBeenCalled()
    expect(second.create).toHaveBeenCalledOnce()
  })
})

function CapabilityProbe() {
  const context = useContext(CapabilityContext)
  if (!context) throw new Error('Capability context missing')
  const [campaign, setCampaign] = useState('')
  const [theme, setTheme] = useState('')

  return (
    <>
      <button
        onClick={() => {
          void context.campaignWorkspace
            .load()
            .then(() => context.campaignWorkspace.createCampaign('test'))
            .then(() => context.campaignWorkspace.refreshActiveSession())
            .then(() => {
              const snapshot = context.campaignWorkspace.snapshot()
              setCampaign(
                `${snapshot.campaigns.campaigns[0]?.name}:${snapshot.session?.revision}`
              )
            })
        }}
      >
        Kampagne anlegen
      </button>
      <button
        onClick={() => {
          void context.installationSettings.load().then((outcome) => {
            if (outcome.status === 'accepted' || outcome.status === 'cached')
              setTheme(outcome.value.preferences.theme)
          })
        }}
      >
        Einstellungen lesen
      </button>
      <span>{campaign}</span>
      <span>{theme}</span>
    </>
  )
}

function capabilityFixture(theme: 'light' | 'dark') {
  const unsubscribe = vi.fn()
  const onChanged = vi.fn<SaltMarcherApi['session']['onChanged']>(
    () => unsubscribe
  )
  const list = vi.fn<SaltMarcherApi['campaigns']['list']>(() =>
    Promise.resolve(campaignSnapshot(null, 0))
  )
  const create = vi.fn<SaltMarcherApi['campaigns']['create']>((input) =>
    Promise.resolve({
      kind: 'created',
      commandId: input.commandId,
      campaignId,
      snapshot: campaignSnapshot(campaignId, 1)
    })
  )
  const readSession = vi.fn<SaltMarcherApi['session']['read']>(() =>
    Promise.resolve(Object.freeze({ revision: 0 }) as LiveSessionSnapshot)
  )
  const readSettings = vi.fn<SaltMarcherApi['settings']['read']>(() =>
    Promise.resolve(settings(theme))
  )
  const api = {
    campaigns: {
      list,
      create,
      commandReceipt: vi.fn(() => Promise.resolve(null))
    },
    session: { read: readSession, onChanged },
    settings: { read: readSettings }
  } as unknown as SaltMarcherApi
  return {
    api,
    create,
    list,
    onChanged,
    readSession,
    readSettings,
    unsubscribe
  }
}

function campaignSnapshot(activeCampaignId: string | null, revision: number) {
  return {
    revision,
    activeCampaignId,
    campaigns:
      activeCampaignId === null
        ? []
        : [{ id: campaignId, name: 'test', createdAt: now }],
    trashedCampaigns: []
  }
}

function settings(
  theme: 'light' | 'dark'
): Awaited<ReturnType<SaltMarcherApi['settings']['read']>> {
  return Object.freeze({
    revision: 0,
    preferences: Object.freeze({
      theme,
      sessionLayout: Object.freeze({
        schemaVersion: 2,
        controlPaneWidth: 300,
        scenarioPaneWidth: 264,
        centerTab: 'details'
      })
    })
  }) satisfies InstallationSettings
}
