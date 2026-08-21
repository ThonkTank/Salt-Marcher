import type {
  Browser as WdioBrowser,
  ChainablePromiseElement
} from 'webdriverio'

export type E2eElementLocator = () => Promise<ChainablePromiseElement>

export async function clickWhenInteractable(
  client: WdioBrowser,
  locate: E2eElementLocator
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      let element = await locate()
      await element.waitForExist({ timeout: 15_000 })
      await client.execute((target) => {
        ;(target as unknown as HTMLElement).scrollIntoView({
          block: 'center',
          inline: 'nearest'
        })
      }, element)
      element = await locate()
      await element.waitForClickable({ timeout: 15_000 })
      await element.click()
      return
    } catch (error) {
      if (attempt === 0 && isStaleElementError(error)) continue
      throw error
    }
  }
}

export async function selectByVisibleTextWhenInteractable(
  client: WdioBrowser,
  locate: E2eElementLocator,
  visibleText: string
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const element = await locate()
      await element.waitForExist({ timeout: 15_000 })
      const selectedValue = await client.execute(
        (target, nextVisibleText) => {
          const select = target as unknown as HTMLSelectElement
          const option = [...select.options].find(
            (candidate) => candidate.text.trim() === nextVisibleText
          )
          if (!option)
            throw new Error(`Select option is missing: ${nextVisibleText}`)
          select.value = option.value
          select.dispatchEvent(new Event('input', { bubbles: true }))
          select.dispatchEvent(new Event('change', { bubbles: true }))
          return option.value
        },
        element,
        visibleText
      )
      await client.waitUntil(
        async () => (await (await locate()).getValue()) === selectedValue,
        {
          timeout: 15_000,
          timeoutMsg: `Select did not accept ${JSON.stringify(visibleText)}.`
        }
      )
      return
    } catch (error) {
      if (attempt === 0 && isStaleElementError(error)) continue
      throw error
    }
  }
}

export function isStaleElementError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : JSON.stringify(error)
  return /stale element(?: reference)?/i.test(message)
}
