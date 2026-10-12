import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { performance } from 'node:perf_hooks'
import { resumeCampaignFromScreen } from './support/campaign-navigation.js'
import {
  expectAccessibleInBothThemes,
  replaceFieldValue,
  setElectronWindowSize
} from './support/e2e-assertions.js'
import { waitSaved, selectScene } from './support/scene-desktop-scenarios.js'
import { clickWhenInteractable } from './support/e2e-interactions.js'

describe('per-scene desktop', () => {
  it('reads independent item and location documents with history and restored scroll', async () => {
    const client = browser as unknown as WdioBrowser
    await resumeCampaignFromScreen(client)
    await selectScene(client, 'Hafen')
    await client.$('.scene-desktop').waitForDisplayed()
    await setElectronWindowSize(client, 1200, 900)
    const original = await client.$('select[aria-label="Szene"]').getValue()
    const sceneIds = await client
      .$$('select[aria-label="Szene"] option')
      .map((option) => option.getAttribute('value'))
    const other = sceneIds.find((id) => id !== original)!
    await client.$('.desktop-toolbar').$('button*=Nachschlagen').click()
    let search = client.$('[data-window-id="search"]')
    await expect(search.$('input[type="search"]')).toBeFocused()
    const campaignId = await client.execute(
      async () => (await window.saltMarcher.campaigns.list()).activeCampaignId!
    )
    const liveBefore = await client.execute(
      (id) => window.saltMarcher.session.read({ campaignId: id }),
      campaignId
    )
    await search.$('input[type="search"]').setValue('DU\u0308STERWALD')
    await expect(
      search.$('[data-reference-kind="location"] button:first-child')
    ).toHaveText(expect.stringContaining('Düsterwald'))
    const noteSearchStarted = performance.now()
    await replaceFieldValue(
      client,
      search.$('input[type="search"]'),
      'Salzmarschhafen Kai 30'
    )
    const noteMatch = search.$(
      '[data-reference-kind="location"] button:first-child'
    )
    await noteMatch.waitForClickable({ timeout: 10_000 })
    await expect(noteMatch).toHaveText(
      expect.stringContaining('Salzmarschhafen')
    )
    await client.keys('Enter')
    await expect(
      client.$('[data-window-id="reader"] .reference-document')
    ).toHaveText(expect.stringContaining('Kai 30'))
    await client.waitUntil(
      () =>
        client.execute(() => {
          const highlight = CSS.highlights.get('reference-search')
          const range = highlight ? [...highlight][0] : null
          const scroll = document.querySelector(
            '[data-window-id="reader"] .desktop-reference-scroll'
          )!
          if (!(range instanceof Range)) return false
          const match = range.getBoundingClientRect(),
            pane = scroll.getBoundingClientRect()
          return (
            range.toString() === 'Kai 30' &&
            match.top >= pane.top &&
            match.bottom <= pane.bottom
          )
        }),
      {
        timeout: 10_000,
        timeoutMsg:
          'The matching note must be highlighted and actually visible, not merely present in the document'
      }
    )
    const noteSearchMs = performance.now() - noteSearchStarted
    await client.saveScreenshot('.tmp/gm-ux-search-after.png')
    expect(
      await client.execute(
        (id) => window.saltMarcher.session.read({ campaignId: id }),
        campaignId
      )
    ).toEqual(liveBefore)
    await waitSaved(client)
    const noteScroll = await client.execute(
      () =>
        document.querySelector(
          '[data-window-id="reader"] .desktop-reference-scroll'
        )!.scrollTop
    )
    expect(noteScroll).toBeGreaterThan(0)
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await client
      .$('[data-window-id="reader"] .reference-document')
      .waitForDisplayed({ timeout: 30_000 })
    await client.waitUntil(() =>
      client.execute(
        (expected) =>
          document.querySelector(
            '[data-window-id="reader"] .desktop-reference-scroll'
          )!.scrollTop === expected,
        noteScroll
      )
    )
    search = client.$('[data-window-id="search"]')
    process.stdout.write(
      `${JSON.stringify({
        kind: 'gm-ux-note-lookup',
        query: 'Salzmarschhafen Kai 30',
        target: 'Salzmarschhafen',
        noteSearchMs: Number(noteSearchMs.toFixed(3)),
        sceneAndCombatUnchanged: true,
        matchedTextVisible: true,
        noteScrollRestoredAfterRestart: true,
        claim: 'one-automated-desktop-sample-not-a-human-speed-benchmark'
      })}\n`
    )
    await client.$('.desktop-taskbar').$('button*=Nachschlagen').click()
    await replaceFieldValue(
      client,
      search.$('input[type="search"]'),
      'Longsword'
    )
    await search.$('[data-reference-kind="item"] button:first-child').click()
    const reader = client.$('[data-window-id="reader"]')
    await client
      .$('[data-window-id="reader"] .reference-document')
      .waitForDisplayed()
    await reader.$('button[aria-label="Maximieren"]').click()
    await reader.$('button[aria-label="Wiederherstellen"]').click()
    await reader.$('button=Separat öffnen').click()
    const separateSelector =
      '.desktop-window:not([data-window-id="reader"]):not([data-window-id="search"]):not([data-window-id="groups"]):not([data-window-id="party"])'
    await client.$(separateSelector).waitForDisplayed()
    await client.$(separateSelector).$('summary').click()
    await client.$(separateSelector).$('button=Linke Hälfte').click()
    await client.$('.desktop-taskbar').$('button*=Nachschlagen').click()
    await replaceFieldValue(
      client,
      search.$('input[type="search"]'),
      'Salzmarschhafen'
    )
    await search
      .$('[data-reference-kind="location"] button:first-child')
      .click()
    await expect(reader.$('.reference-document')).toHaveText(
      expect.stringContaining('Kai 30')
    )
    await reader.$('summary').click()
    await reader.$('button=Rechte Hälfte').click()
    await client.$('.desktop-taskbar').$('button*=Nachschlagen').click()
    await search.$('button[aria-label="Minimieren"]').click()
    const scrollRange = await client.execute(() => {
      const scroll = document.querySelector<HTMLElement>(
        '[data-window-id="reader"] .desktop-reference-scroll'
      )!
      scroll.scrollTop = 200
      scroll.dispatchEvent(new Event('scroll', { bubbles: true }))
      return scroll.scrollHeight - scroll.clientHeight
    })
    expect(scrollRange).toBeGreaterThan(200)
    await waitSaved(client)
    await reader.$('button[aria-label="Zurück"]').click()
    await expect(reader.$('h2')).toHaveText('Longsword')
    await reader.$('button[aria-label="Vorwärts"]').click()
    await expect(reader.$('h2')).toHaveText('Salzmarschhafen')
    await client.waitUntil(() =>
      client.execute(
        () =>
          document.querySelector(
            '[data-window-id="reader"] .desktop-reference-scroll'
          )!.scrollTop === 200
      )
    )
    await expectAccessibleInBothThemes(client)
    await client
      .$('select[aria-label="Szene"]')
      .selectByAttribute('value', other)
    await expect(client.$('.scene-desktop')).toHaveAttribute(
      'data-scene-id',
      other
    )
    await waitSaved(client)
    await expect(client.$('[data-window-id="reader"]')).not.toBeExisting()
    await client
      .$('select[aria-label="Szene"]')
      .selectByAttribute('value', original)
    await expect(client.$('.scene-desktop')).toHaveAttribute(
      'data-scene-id',
      original
    )
    await client
      .$('[data-window-id="reader"] .reference-document')
      .waitForDisplayed()
    await waitSaved(client)
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await client
      .$('[data-window-id="reader"] .reference-document')
      .waitForDisplayed({ timeout: 30_000 })
    await expect(client.$('[data-window-id="reader"] h2')).toHaveText(
      'Salzmarschhafen'
    )
    await client.waitUntil(() =>
      client.execute(
        () =>
          document.querySelector(
            '[data-window-id="reader"] .desktop-reference-scroll'
          )!.scrollTop === 200
      )
    )
    await expect(client.$$(separateSelector)).toBeElementsArrayOfSize(1)
    await client.$('.desktop-taskbar').$('button*=Nachschlagen').click()
    const restoredSearch = client.$('[data-window-id="search"]')
    await replaceFieldValue(
      client,
      restoredSearch.$('input[type="search"]'),
      'Longsword'
    )
    const barOrder = await client
      .$$('.desktop-taskbar button')
      .map((button) => button.getText())
    await restoredSearch
      .$('[data-reference-kind="item"] button[title="Separat öffnen"]')
      .click()
    await expect(client.$$(separateSelector)).toBeElementsArrayOfSize(1)
    await expect(client.$(separateSelector)).toHaveElementClass('raised')
    expect(
      await client
        .$$('.desktop-taskbar button')
        .map((button) => button.getText())
    ).toEqual(barOrder)
    await verifyFurtherResults(client)
  })
})

async function verifyFurtherResults(client: WdioBrowser) {
  // Isolated fixture preparation through the production capability, not a lookup shortcut.
  await client.execute(async () => {
    let snapshot = await window.saltMarcher.locations.read()
    for (let index = 1; index <= 105; index++) {
      const saved = await window.saltMarcher.locations.save({
        commandId: crypto.randomUUID(),
        locationId: null,
        expectedRevision: snapshot.revision,
        placement: { kind: 'keep' },
        location: {
          displayName: `Archiv ${String(index).padStart(3, '0')}`,
          tags: ['Ort'],
          readAloud: '',
          notes: `sableinvoice: Eintrag ${index}.`,
          factionIds: [],
          encounterTableIds: []
        }
      })
      if (saved.status !== 'saved')
        throw new Error('Fixture record was not completely saved')
      snapshot = saved.snapshot
    }
  })
  await client.$('.desktop-toolbar').$('button=Nachschlagen').click()
  const search = client.$('[data-window-id="search"]')
  await client
    .$('[data-window-id="search"] button[aria-label="Minimieren"]')
    .click()
  await client.keys([process.platform === 'darwin' ? 'Meta' : 'Control', 'k'])
  await expect(search.$('input[type="search"]')).toBeFocused()
  await replaceFieldValue(
    client,
    search.$('input[type="search"]'),
    'sableinvoice'
  )
  await expect(search.$$('.desktop-search-result')).toBeElementsArrayOfSize(100)
  await clickWhenInteractable(
    client,
    async () => await search.$('button=Weitere Treffer')
  )
  await expect(search.$$('.desktop-search-result')).toBeElementsArrayOfSize(105)
  await clickWhenInteractable(
    client,
    async () => await search.$('button*=Archiv 101')
  )
  await expect(client.$('[data-window-id="reader"] h2')).toHaveText(
    'Archiv 101'
  )
  await expect(
    client.$('[data-window-id="reader"] .reference-document')
  ).toHaveText(expect.stringContaining('Eintrag 101.'))
  await waitSaved(client)
}
