import type { Browser as WdioBrowser } from 'webdriverio'

export async function openSceneWindow(
  client: WdioBrowser,
  kind: 'party' | 'groups' | 'map' | 'combat' | 'loot' | 'search',
  maximize = false
) {
  const labels = {
    groups: 'Gruppen',
    party: 'Party',
    map: 'Karte & Reise',
    combat: 'Kampf',
    loot: 'Beute',
    search: 'Nachschlagen'
  }
  await client.$('.desktop-toolbar').waitForDisplayed({ timeout: 15000 })
  await client.$('.desktop-toolbar').$(`button=${labels[kind]}`).click()
  const frame = client.$(`.desktop-window[data-window-id="${kind}"]`)
  await frame.waitForDisplayed({ timeout: 10000 })
  if (maximize) {
    const button = frame.$('button[aria-label="Maximieren"]')
    if (await button.isExisting()) {
      await button.click()
      await frame
        .$('button[aria-label="Wiederherstellen"]')
        .waitForExist({ timeout: 5_000 })
    }
  }
  return frame
}
