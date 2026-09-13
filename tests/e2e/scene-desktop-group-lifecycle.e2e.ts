import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { resumeCampaignFromScreen } from './support/campaign-navigation.js'
import { waitSaved, selectScene } from './support/scene-desktop-scenarios.js'

describe('per-scene desktop', () => {
  it('restores archived groups and deletes only after confirmation across restart', async () => {
    const client = browser as unknown as WdioBrowser
    await resumeCampaignFromScreen(client)
    await selectScene(client, 'Hafen')
    const target = await client.execute(async () => {
      const api = window.saltMarcher
      const campaignId = (await api.campaigns.list()).activeCampaignId!
      const snapshot = await api.session.read({ campaignId })
      const sceneId = snapshot.scene.focusedSceneId
      await api.scene.saveGroup({
        commandId: crypto.randomUUID(),
        sceneId,
        groupId: null,
        name: 'Lifecycle E2E',
        note: 'Preserve through restore',
        disposition: 'neutral',
        entries: [],
        expectedRevision: snapshot.scene.revision,
        expectedGroupRevision: null
      })
      const current = await api.session.read({ campaignId })
      const group = current.scene.scenes
        .find((scene) => scene.id === sceneId)!
        .groups.find((group) => group.name === 'Lifecycle E2E')!
      return { campaignId, sceneId, groupId: group.id }
    })
    const openGroup = async () => {
      await client.refresh()
      await resumeCampaignFromScreen(client)
      await client.$('.scene-desktop').waitForDisplayed({ timeout: 30_000 })
      await client.$('.desktop-toolbar').$('button=Gruppen').click()
      await client.$('button[aria-label="Lifecycle E2E aufklappen"]').click()
    }
    const readGroup = () =>
      client.execute(async (input) => {
        const snapshot = await window.saltMarcher.session.read({
          campaignId: input.campaignId
        })
        return (
          snapshot.scene.scenes
            .find((scene) => scene.id === input.sceneId)!
            .groups.find((group) => group.id === input.groupId) ?? null
        )
      }, target)
    const archiveGroup = async (edit: boolean) => {
      await client.refresh()
      await resumeCampaignFromScreen(client)
      await client.$('.scene-desktop').waitForDisplayed({ timeout: 30_000 })
      await client.$('.desktop-toolbar').$('button=Gruppen').click()
      const expand = client.$('button[aria-label="Lifecycle E2E aufklappen"]')
      if (await expand.isExisting()) await expand.click()
      await client
        .$('.group-register[aria-label="Lifecycle E2E"]')
        .$('button=Monster hinzufügen')
        .click()
      const manager = client.$('section[aria-labelledby="group-builder-title"]')
      await manager.waitForDisplayed({ timeout: 10_000 })
      if (edit) {
        await manager.$('summary=Gruppendetails').click()
        await manager
          .$('.group-editor-details select')
          .selectByAttribute('value', 'allied')
      }
      await manager.$('button=Archivieren').click()
      if (edit) {
        const confirmation = client.$(
          '[role="alertdialog"][aria-label="Gruppe archivieren"]'
        )
        await confirmation.waitForDisplayed()
        await confirmation.$('button=Speichern und fortfahren').click()
      }
      await manager.waitForExist({ reverse: true, timeout: 10_000 })
      expect((await readGroup())?.archived).toBe(true)
      expect((await readGroup())?.disposition).toBe('allied')
    }
    await archiveGroup(true)
    await openGroup()
    await client
      .$('[data-window-id="groups"]')
      .$('button=Wiederherstellen')
      .click()
    await client.waitUntil(async () => (await readGroup())?.archived === false)
    expect((await readGroup())?.note).toBe('Preserve through restore')
    await archiveGroup(false)
    await openGroup()
    await client.$('[data-window-id="groups"]').$('button=Löschen').click()
    await client.$('.group-delete-confirm').$('button=Abbrechen').click()
    expect((await readGroup())?.archived).toBe(true)
    await client.$('[data-window-id="groups"]').$('button=Löschen').click()
    await client.$('.group-delete-confirm').$('button=Wirklich löschen').click()
    await client.waitUntil(async () => (await readGroup()) === null)
    await expect(client.$('.group-name=Lifecycle E2E')).not.toBeExisting()
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await client.$('.scene-desktop').waitForDisplayed({ timeout: 30_000 })
    expect(await readGroup()).toBeNull()
    await waitSaved(client)
  })
})
