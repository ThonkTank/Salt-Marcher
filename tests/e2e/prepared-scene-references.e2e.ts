import { openSceneWindow } from './support/scene-desktop-navigation.js'
import { selectScene } from './support/scene-desktop-scenarios.js'
import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'
import { resumeCampaignFromScreen } from './support/campaign-navigation.js'
import {
  expectAccessibleInBothThemes,
  replaceFieldValue,
  setElectronWindowSize
} from './support/e2e-assertions.js'
describe('GM prepared scene retrieval', () => {
  it('checks saved notes are available while running the table', async () => {
    const client = browser as unknown as WdioBrowser
    await resumeCampaignFromScreen(client)
    await setElectronWindowSize(client, 1200, 900)
    await selectScene(client, 'Hafen')
    const combat = await openSceneWindow(client, 'combat')
    await combat.$('.encounter-group-choice input').click()
    await combat.$('button=Initiative vorbereiten').click()
    await combat.$('button=Kampf starten').waitForEnabled()
    await combat.$('button=Kampf starten').click()
    await combat.$('.combat-panel').waitForExist()

    const campaignId = await client.execute(
      async () => (await window.saltMarcher.campaigns.list()).activeCampaignId!
    )
    const liveBefore = await client.execute(
      (id) => window.saltMarcher.session.read({ campaignId: id }),
      campaignId
    )
    expect(liveBefore.combat).not.toBeNull()
    await client.$('button[aria-label="Session-Planer"]').click()
    await client.$('button=+ Szene').waitForClickable({ timeout: 30000 })
    const sessionName =
      'Die vierte Reise nach Glassteg – Zeugen und Erinnerungen '
        .repeat(3)
        .trim()
    await client.$('.planner-session-actions').$('button=Umbenennen').click()
    const nameDialog = client.$('.planner-name-dialog')
    await nameDialog.$('input').setValue(sessionName)
    await nameDialog.$('button=Speichern').click()
    await client.$('button=+ Szene').waitForClickable()
    await client.$('button=+ Szene').click()
    await client.$('.planner-fields input').setValue('Verhör am Glassteg')
    await client
      .$('.planner-notes-field textarea')
      .setValue(
        'Die Zeugin erwähnt eine kobaltblaue Erinnerung. Erst bei Vertrauen verrät sie das Losungswort.'
      )
    const save = client.$('.planner-primary-actions').$('button=Speichern')
    await save.waitForEnabled()
    await save.click()
    await client.waitUntil(async () => !(await save.isEnabled()), {
      timeout: 10000
    })
    const saved = await client.execute(async () =>
      (await window.saltMarcher.sessionPlanner.read()).session.scenes.find(
        (s) => s.title === 'Verhör am Glassteg'
      )
    )
    expect(saved?.notes).toContain('kobaltblaue Erinnerung')
    await client.saveScreenshot('.tmp/gm-planned-notes-saved.png')
    await client.$('button[aria-label="Session"]').click()
    const liveTitles = await client
      .$$('select[aria-label="Szene"] option')
      .map((o) => o.getText())
    await client.$('.desktop-toolbar').$('button*=Nachschlagen').click()
    await replaceFieldValue(
      client,
      client.$('[data-window-id="search"] input[type="search"]'),
      'kobaltblaue Erinnerung'
    )
    await client.waitUntil(
      () =>
        client.execute((expected) => {
          const pane = document.querySelector(
            '[data-window-id="search"] .desktop-reference-scroll'
          )
          const result = pane?.querySelector(
            '[data-reference-kind="planned-scene"]'
          )
          const context = result?.querySelector('small')
          if (!pane || !result || !context?.textContent?.includes(expected))
            return false
          const bounds = pane.getBoundingClientRect(),
            row = result.getBoundingClientRect(),
            text = context.getBoundingClientRect()
          return row.right <= bounds.right + 1 && text.right <= bounds.right + 1
        }, sessionName),
      {
        timeout: 10000,
        timeoutMsg:
          'Full session context must identify the saved Scene without overflowing lookup'
      }
    )
    await client.keys('Enter')
    const reader = client.$('[data-window-id="reader"] .reference-document')
    await expect(reader).toHaveText(
      expect.stringContaining('kobaltblaue Erinnerung')
    )
    await expect(reader).toHaveText(expect.stringContaining('Sitzung'))
    expect(
      await client.execute(
        (id) => window.saltMarcher.session.read({ campaignId: id }),
        campaignId
      )
    ).toEqual(liveBefore)
    await client.$('button[aria-label="Session-Planer"]').click()
    await client
      .$('.planner-notes-field textarea')
      .setValue('Die Zeugin nennt jetzt eine bronzene Erinnerung.')
    const saveChanged = client
      .$('.planner-primary-actions')
      .$('button=Speichern')
    await saveChanged.click()
    await client.waitUntil(async () => !(await saveChanged.isEnabled()), {
      timeout: 10000
    })
    await client.$('button[aria-label="Session"]').click()
    await expect(
      client.$('[data-window-id="reader"] .reference-document')
    ).toHaveText(expect.stringContaining('bronzene Erinnerung'))
    await expect(
      client.$('[data-window-id="reader"] .reference-document')
    ).not.toHaveText(expect.stringContaining('kobaltblaue Erinnerung'))
    expect(
      await client.execute(
        (id) => window.saltMarcher.session.read({ campaignId: id }),
        campaignId
      )
    ).toEqual(liveBefore)
    await client.saveScreenshot('.tmp/gm-planned-notes-after.png')
    await expectAccessibleInBothThemes(client)
    await client.reloadSession()
    await resumeCampaignFromScreen(client)
    await expect(
      client.$('[data-window-id="reader"] .reference-document')
    ).toHaveText(expect.stringContaining('bronzene Erinnerung'))
    process.stdout.write(
      JSON.stringify({
        kind: 'gm-prepared-scene-retrieval',
        savedTitle: saved?.title,
        liveTitles,
        lookupFound: true,
        readerFreshAfterEdit: true,
        readerRestoredAfterRestart: true,
        activeCombatPreserved: true
      }) + '\n'
    )
  })
})
