import type { Browser as WdioBrowser } from 'webdriverio'

export async function waitSaved(client: WdioBrowser) {
  await client.waitUntil(
    async () =>
      (await client.$('.desktop-toolbar [role="status"]').getText()) === '',
    { timeout: 10_000 }
  )
  await client.waitUntil(
    async () => !(await client.$('.desktop-error').isExisting()),
    { timeoutMsg: 'Desktop shows an error after saving' }
  )
}
export async function geometry(client: WdioBrowser) {
  return client.execute(() => {
    const frame = document.querySelector<HTMLElement>('.desktop-window')!
    return {
      x: frame.style.left,
      y: frame.style.top,
      width: frame.style.width,
      height: frame.style.height
    }
  })
}

export async function selectScene(client: WdioBrowser, title: string) {
  const target = await client.execute(async (name) => {
    const campaignId = (await window.saltMarcher.campaigns.list())
      .activeCampaignId!
    return (
      (await window.saltMarcher.session.read({ campaignId })).scene.scenes.find(
        (scene) => scene.title === name
      )?.id ?? ''
    )
  }, title)
  if (!target) throw new Error(`Missing scene ${title}`)
  await client
    .$('select[aria-label="Szene"]')
    .selectByAttribute('value', target)
  await client.waitUntil(
    async () =>
      (await client.$('.scene-desktop').getAttribute('data-scene-id')) ===
      target,
    { timeoutMsg: `Desktop did not select scene ${title}` }
  )
}
