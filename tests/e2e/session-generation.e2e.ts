import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'

describe('generator preset integration', () => {
  it('persists one copied assignment and exposes it to Scene and Session', async () => {
    const client = browser as unknown as WdioBrowser
    const campaignName = await client.$('#campaign-name')
    await campaignName.waitForDisplayed({ timeout: 30_000 })
    await campaignName.setValue('Preset E2E')
    await (await client.$('button=Anlegen')).click()
    await (
      await client.$('h1=Session · Preset E2E')
    ).waitForExist({ timeout: 10_000 })

    await (await client.$('button[aria-label="Menü"]')).click()
    await (
      await (await client.$('#campaign-menu')).$('button=Einstellungen')
    ).click()
    const dialog = await client.$('section.encounter-settings-dialog')
    await dialog.waitForDisplayed({ timeout: 5_000 })
    await (await dialog.$('.preset-toolbar input')).setValue('E2E Generator')
    await (
      await dialog.$('input[aria-label="Als Mob führen ab"]')
    ).setValue('7')
    await (await dialog.$('button=Als Kopie speichern')).click()
    await (
      await dialog.$(
        'p=Das geschützte System-Preset wurde als Kopie gespeichert.'
      )
    ).waitForExist({ timeout: 5_000 })
    await (await dialog.$('button=Für aktive Kampagne zuweisen')).click()
    await (
      await dialog.$('p=Preset der aktiven Kampagne zugewiesen.')
    ).waitForExist({ timeout: 5_000 })
    await (await dialog.$('button[aria-label="Schließen"]')).click()

    await client.refresh()
    await (
      await client.$('h1=Session · Preset E2E')
    ).waitForExist({ timeout: 15_000 })
    const proof = await client.execute(async () => {
      const api = window.saltMarcher
      const presets = await api.generatorPresets.readEditor({
        campaignId: (await api.campaigns.list()).activeCampaignId
      })
      const custom = presets.registry.presets.find(
        (preset) => preset.name === 'E2E Generator'
      )
      if (!custom) throw new Error('Copied E2E preset is missing after reload.')

      let party = await api.party.read()
      for (const member of party.members)
        party = await api.party.setMembership(member.id, true, party.revision)
      const live = await api.session.read()
      const scene = await api.scene.generateGroupDraft(
        live.scene.focusedSceneId,
        [],
        'replace',
        {
          name: '',
          sizes: [],
          types: [],
          subtypes: [],
          biomes: [],
          alignments: [],
          encounterTableIds: [],
          factionIds: [],
          locationId: null,
          sort: 'name',
          direction: 'asc',
          offset: 0,
          limit: 50
        },
        {
          difficulty: 'preset',
          amount: 'preset',
          balance: 'preset',
          diversity: 'preset'
        },
        179974,
        live.scene.revision
      )
      const session = await api.sessionGeneration.generateEncounterIntents({
        party: [{ level: 3, count: 4 }],
        adventureDayFraction: '0.25',
        encounterCount: 1,
        seed: 179974
      })
      if (session.status !== 'success')
        throw new Error(`Session generator failed: ${session.status}`)
      return {
        custom: {
          id: custom.id,
          revision: custom.revision,
          mobThreshold: custom.config.combat.mobThreshold
        },
        activePresetId: presets.assignment?.effectivePresetId,
        assignment: presets.assignment,
        scene: {
          id: scene.context.generatorPresetId,
          revision: scene.context.generatorPresetRevision,
          hash: scene.context.generatorConfigHash
        },
        session: session.generatorPreset
      }
    })

    expect(proof.custom.mobThreshold).toBe(7)
    expect(proof.activePresetId).toBe(proof.custom.id)
    expect(proof.assignment?.assignedPresetId).toBe(proof.custom.id)
    expect(proof.scene.id).toBe(proof.custom.id)
    expect(proof.scene.revision).toBe(proof.custom.revision)
    expect(proof.scene.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(proof.session.id).toBe(proof.custom.id)
    expect(proof.session.revision).toBe(proof.custom.revision)
    expect(proof.session.configHash).toBe(proof.scene.hash)
  })
})
