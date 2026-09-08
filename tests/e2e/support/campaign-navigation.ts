import type { Browser as WdioBrowser } from 'webdriverio'

export async function openCampaignScreen(client: WdioBrowser): Promise<void> {
  const screen = client.$('.campaign-screen')
  if (await screen.isDisplayed()) return
  await client.$('button[aria-label="Menü"]').click()
  const menu = client.$('nav#campaign-menu')
  await menu.waitForDisplayed({ timeout: 10_000 })
  await menu.$('button=Kampagnen').click()
  await screen.waitForDisplayed({ timeout: 10_000 })
}

export async function beginCampaignCreation(
  client: WdioBrowser
): Promise<void> {
  await openCampaignScreen(client)
  const button = client.$('button=+ Neue Kampagne')
  await button.waitForClickable({ timeout: 30_000 })
  await button.click()
  await client.$('#campaign-name').waitForDisplayed({ timeout: 10_000 })
}

export async function resumeCampaignFromScreen(
  client: WdioBrowser
): Promise<void> {
  await client.$('.campaign-screen').waitForDisplayed({ timeout: 30_000 })
  const resume = client.$('button=Fortsetzen')
  await resume.waitForClickable({ timeout: 10_000 })
  await resume.click()
  await client.$('[data-screen="workspace"]').waitForExist({ timeout: 15_000 })
}
