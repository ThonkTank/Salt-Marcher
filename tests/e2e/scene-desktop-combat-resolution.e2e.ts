import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { resumeCampaignFromScreen } from './support/campaign-navigation.js'
import { waitSaved, selectScene } from './support/scene-desktop-scenarios.js'

describe('per-scene desktop', () => {
  it('resolves result drafts and awards XP exactly once through completion and restart', async () => {
    const client = browser as unknown as WdioBrowser
    await resumeCampaignFromScreen(client)
    await selectScene(client, 'Hafen')
    const target = await client.execute(async () => {
      let stage = 'read session'
      try {
        const api = window.saltMarcher
        const campaignId = (await api.campaigns.list()).activeCampaignId!
        let snapshot = await api.session.read({ campaignId })
        stage = 'clear previous combat'
        if (snapshot.combat)
          await api.combat.complete({
            expectedRevision: snapshot.combat.revision
          })
        snapshot = await api.session.read({ campaignId })
        stage = 'set a combat-ready roster'
        const member = snapshot.party.members.find(
          (entry) => entry.level !== null
        )
        if (!member)
          throw new Error('Fixture requires a character with a level')
        const sceneId = snapshot.scene.focusedSceneId
        if (
          !snapshot.scene.scenes
            .find((scene) => scene.id === sceneId)!
            .partyMemberIds.includes(member.id)
        ) {
          if (!member.active) {
            await api.party.setMembership({
              id: member.id,
              active: true,
              expectedRevision: snapshot.party.revision
            })
          } else {
            await api.scene.assignPartyMember({
              sceneId,
              partyMemberId: member.id,
              assigned: true,
              expectedRevision: snapshot.scene.revision
            })
          }
          snapshot = await api.session.read({ campaignId })
        }
        await api.scene.setRoster({
          sceneId,
          memberIds: [member.id],
          expectedRevision: snapshot.scene.revision,
          expectedPartyRevision: snapshot.party.revision
        })
        snapshot = await api.session.read({ campaignId })
        stage = 'create resolution group'
        await api.scene.saveGroup({
          commandId: crypto.randomUUID(),
          sceneId,
          groupId: null,
          name: 'Resolution E2E',
          note: '',
          disposition: 'hostile',
          entries: [{ creatureId: 'wolf', quantity: 2 }],
          expectedRevision: snapshot.scene.revision,
          expectedGroupRevision: null
        })
        snapshot = await api.session.read({ campaignId })
        const groupId = snapshot.scene.scenes
          .find((scene) => scene.id === sceneId)!
          .groups.find((group) => group.name === 'Resolution E2E')!.id
        stage = 'prepare resolution combat'
        await api.combat.prepare({
          sceneId,
          groupIds: [groupId],
          expectedSceneRevision: snapshot.scene.revision
        })
        return { campaignId, sceneId, memberId: member.id }
      } catch (cause) {
        return {
          failureText: `${stage}: ${cause instanceof Error ? cause.message : JSON.stringify(cause)}`
        }
      }
    })
    if ('failureText' in target) throw new Error(target.failureText)
    const read = () =>
      client.execute(
        async (campaignId) => window.saltMarcher.session.read({ campaignId }),
        target.campaignId
      )
    await client.refresh()
    await resumeCampaignFromScreen(client)
    await client.$('.scene-desktop').waitForDisplayed({ timeout: 30_000 })
    await client.$('.desktop-toolbar').$('button=Kampf').click()
    await client
      .$('[data-window-id="combat"]')
      .$('button=Kampf starten')
      .click()
    await client.$('.combat-panel footer').$('button*=Auflösung').click()
    const panel = () => client.$('.resolution-panel')
    await panel().waitForDisplayed()
    const before = await read()
    await panel()
      .$('.resolution-controls select')
      .selectByAttribute('value', 'manual')
    const enemies = await panel().$$('input[type="checkbox"]')
    for (const enemy of enemies)
      if (!(await enemy.isSelected())) await enemy.click()
    const award = Number(
      (
        await panel().$('.resolution-award div:last-child dd').getText()
      ).replace(/[^0-9]/g, '')
    )
    expect(award).toBeGreaterThan(0)
    await panel().$('button=XP vergeben und beenden').click()
    const confirmation = () =>
      client.$('[role="alertdialog"][aria-label="Kampfaktion fortsetzen"]')
    await confirmation().waitForDisplayed()
    await confirmation().$('button=Abbrechen').click()
    expect((await read()).party).toEqual(before.party)
    await expect(panel().$('.resolution-controls select')).toHaveValue('manual')
    await panel().$('button=XP vergeben und beenden').click()
    await confirmation().waitForDisplayed()
    await confirmation().$('button=Speichern und fortfahren').click()
    await panel().waitForExist({ reverse: true })
    await client.waitUntil(async () => (await read()).combat === null)
    const after = await read()
    const assigned = before.scene.scenes.find(
      (scene) => scene.id === target.sceneId
    )!.partyMemberIds
    for (const member of before.party.members) {
      expect(
        after.party.members.find((entry) => entry.id === member.id)!.xp
      ).toBe(
        member.xp + (member.active && assigned.includes(member.id) ? award : 0)
      )
    }
    await expect(client.$('[data-error-scope="workspace"]')).not.toBeExisting()
    await waitSaved(client)
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await client.$('.scene-desktop').waitForDisplayed({ timeout: 30_000 })
    const restarted = await read()
    expect(restarted.combat).toBeNull()
    expect(restarted.party).toEqual(after.party)
  })
})
