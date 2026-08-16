import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import {
  expectAccessible,
  setElectronWindowSize
} from './support/e2e-assertions.js'
import { waitForGmRendererReady } from './support/e2e-ready.js'

describe('Loot distribution and ledger', () => {
  it('partially distributes, restarts, completes, and preserves provenance', async () => {
    const client = browser as unknown as WdioBrowser
    await setElectronWindowSize(client, 1280, 800)
    await (
      await client.$('h1=Session · Loot-Verteilung-Abnahme')
    ).waitForExist({ timeout: 20_000 })

    const prepared = await client.execute(async () => {
      const api = window.saltMarcher
      const party = await api.party.read()
      const inbox = await api.loot.inbox({ cursor: null, limit: 20 })
      const treasure = inbox.entries[0]?.treasure
      const character = party.members.find((member) => member.active)
      if (!treasure || !character)
        throw new Error('Prepared Loot fixture is incomplete.')
      const totalOpen = treasure.items.reduce(
        (total, item) => total + item.quantity - item.allocatedQuantity,
        0
      )
      if (totalOpen < 2)
        throw new Error('Prepared Loot needs at least two open units.')
      const item = treasure.items.find(
        (candidate) => candidate.quantity > candidate.allocatedQuantity
      )!
      const partial = await api.loot.distribute({
        commandId: crypto.randomUUID(),
        treasureId: treasure.id,
        expectedTreasureRevision: treasure.revision,
        expectedPartyRevision: party.revision,
        items: [
          {
            itemId: item.id,
            shares: [{ characterId: character.id, quantity: 1 }]
          }
        ]
      })
      if (partial.treasure.distributionState !== 'partial')
        throw new Error('Prepared partial distribution completed too early.')
      if (treasure.source.kind !== 'generated')
        throw new Error('Prepared Loot has no generated provenance.')
      return {
        treasureId: treasure.id,
        treasureLabel: treasure.label,
        partialItemName: item.name,
        characterId: character.id,
        characterName: character.name,
        partialRevision: partial.treasure.revision,
        runId: treasure.source.runId,
        generatedTreasureId: treasure.source.generatedTreasureId
      }
    })

    await (await client.$('button=Nicht zugeordnete Beute öffnen')).click()
    const openTreasure = await client.$('.unplaced-loot-section')
    await openTreasure.waitForDisplayed({ timeout: 10_000 })
    await (await openTreasure.$('button=Verteilen')).click()
    const distributionDialog = await client.$('.loot-distribution-dialog')
    await distributionDialog.waitForDisplayed({ timeout: 10_000 })
    await expectAccessible(client)
    expect(
      await client.execute(() => {
        const dialog = document.querySelector('.loot-distribution-dialog')
        return Boolean(
          dialog &&
          document.activeElement instanceof HTMLElement &&
          dialog.contains(document.activeElement)
        )
      })
    ).toBe(true)
    await client.keys('Escape')
    await distributionDialog.waitForExist({ reverse: true, timeout: 5_000 })

    await client.reloadSession()
    await waitForGmRendererReady(client)
    await (
      await client.$('h1=Session · Loot-Verteilung-Abnahme')
    ).waitForExist({ timeout: 20_000 })

    const completed = await client.execute(async (proof) => {
      const api = window.saltMarcher
      const party = await api.party.read()
      const treasure = await api.loot.read({ treasureId: proof.treasureId })
      if (treasure.revision !== proof.partialRevision)
        throw new Error('Treasure revision was not restored after restart.')
      const remaining = treasure.items.flatMap((item) => {
        const quantity = item.quantity - item.allocatedQuantity
        return quantity === 0
          ? []
          : [
              {
                itemId: item.id,
                shares: [{ characterId: proof.characterId, quantity }]
              }
            ]
      })
      const distribution = await api.loot.distribute({
        commandId: crypto.randomUUID(),
        treasureId: treasure.id,
        expectedTreasureRevision: treasure.revision,
        expectedPartyRevision: party.revision,
        items: remaining
      })
      const ledger = await api.loot.ledger({ characterId: proof.characterId })
      return {
        state: distribution.treasure.distributionState,
        allocated: distribution.treasure.items.every(
          (item) => item.allocatedQuantity === item.quantity
        ),
        entryCount: ledger.entries.length,
        itemNames: ledger.entries.map((entry) => entry.itemName),
        provenance: ledger.entries.map((entry) => entry.rewardProvenance)
      }
    }, prepared)
    expect(completed.state).toBe('complete')
    expect(completed.allocated).toBe(true)
    expect(completed.entryCount).toBeGreaterThan(1)
    expect(completed.itemNames).toContain(prepared.partialItemName)
    expect(
      completed.provenance.every(
        (entry) =>
          typeof entry === 'object' &&
          entry !== null &&
          entry.runId === prepared.runId &&
          entry.generatedTreasureId === prepared.generatedTreasureId
      )
    ).toBe(true)

    const partyCard = await client.$('.scene-party-card')
    await partyCard.waitForExist({ timeout: 10_000 })
    const partyExpansion = await partyCard.$('.group-expand')
    if ((await partyExpansion.getAttribute('aria-expanded')) !== 'true')
      await partyExpansion.click()
    await (
      await client.$(
        `button.scene-party-member[aria-label="Beute: ${prepared.characterName}"]`
      )
    ).click()
    const ledgerDialog = await client.$('.character-loot-dialog')
    await ledgerDialog.waitForDisplayed({ timeout: 10_000 })
    await client.waitUntil(
      async () =>
        (await ledgerDialog.getText()).includes(prepared.partialItemName),
      {
        timeout: 10_000,
        timeoutMsg: 'Character Loot ledger did not finish loading.'
      }
    )
    expect(await ledgerDialog.getText()).toContain(prepared.partialItemName)
    expect(await ledgerDialog.getText()).toContain(prepared.treasureLabel)
    await (
      await ledgerDialog.$('button[aria-label="Dialog schließen"]')
    ).click()
  })
})
