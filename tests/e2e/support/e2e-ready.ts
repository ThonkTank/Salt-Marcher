import type { Browser as WdioBrowser } from 'webdriverio'

export async function waitForGmRendererReady(
  client: WdioBrowser
): Promise<void> {
  await client.waitUntil(
    async () => {
      for (const handle of await client.getWindowHandles()) {
        await client.switchToWindow(handle)
        const ready = await client.execute(
          () =>
            typeof window.saltMarcher === 'object' &&
            document.querySelector('[data-renderer-ready="gm"]') !== null
        )
        if (ready) return true
      }
      return false
    },
    {
      timeout: 20_000,
      interval: 100,
      timeoutMsg: 'GM window did not reach its renderer-ready marker.'
    }
  )
}
