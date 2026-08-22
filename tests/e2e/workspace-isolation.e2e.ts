import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'

describe('isolated workspace routes', () => {
  it('loads Session, Catalog and Hex through the persistent shell', async () => {
    const client = browser as unknown as WdioBrowser
    const campaignName = await client.$('#campaign-name')
    await campaignName.waitForDisplayed({ timeout: 30_000 })
    await campaignName.setValue('Workspace Isolation')
    await (await client.$('button=Anlegen')).click()
    await (
      await client.$('section[aria-label="Session Steuerung"]')
    ).waitForExist({ timeout: 10_000 })

    const menu = await client.$('button[aria-label="Menü"]')
    await expect(menu).toBeExisting()
    await expect(
      await client.$('section[aria-label="Session Steuerung"]')
    ).toBeExisting()

    await (await client.$('button[aria-label="Katalog"]')).click()
    await expect(await client.$('.catalog-workspace')).toBeExisting()
    await expect(menu).toBeExisting()

    await (await client.$('button[aria-label="Hex-Editor"]')).click()
    await expect(await client.$('.hex-editor-workspace')).toBeExisting()
    await expect(menu).toBeExisting()

    await (await client.$('button[aria-label="Session"]')).click()
    await expect(
      await client.$('section[aria-label="Session Steuerung"]')
    ).toBeExisting()
    await expect(menu).toBeExisting()
  })

  it('keeps workspace geometry stable while shell errors are visible', async () => {
    const client = browser as unknown as WdioBrowser
    const geometry = await client.execute(async () => {
      const shell = document.querySelector<HTMLElement>('.app-shell')
      const workspace = document.querySelector<HTMLElement>('.session-mockup')
      if (!shell || !workspace) return null
      const snapshot = () => {
        const bounds = workspace.getBoundingClientRect()
        return {
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height
        }
      }
      const before = snapshot()
      const stack = document.createElement('div')
      stack.className = 'workspace-error-stack'
      const alert = document.createElement('p')
      alert.className = 'error-message'
      alert.setAttribute('role', 'alert')
      const message = document.createElement('span')
      message.textContent = 'Ein interner Fehler ist aufgetreten.'
      const close = document.createElement('button')
      close.textContent = 'Schließen'
      alert.append(message, close)
      stack.append(alert)
      shell.append(stack)
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      )
      const after = snapshot()
      const stackStyle = getComputedStyle(stack)
      const stackBounds = stack.getBoundingClientRect()
      const result = {
        before,
        after,
        stackPosition: stackStyle.position,
        stackHeight: stackBounds.height,
        viewportHeight: window.innerHeight,
        mountedOutsideWorkArea: stack.closest('.work-area') === null
      }
      stack.remove()
      return result
    })

    if (!geometry) throw new Error('Session workspace geometry is unavailable')
    if (JSON.stringify(geometry.before) !== JSON.stringify(geometry.after))
      throw new Error(
        `Workspace error changed cockpit geometry: ${JSON.stringify(geometry)}`
      )
    if (
      geometry.stackPosition !== 'fixed' ||
      !geometry.mountedOutsideWorkArea ||
      geometry.stackHeight >= geometry.viewportHeight
    )
      throw new Error(
        `Workspace error stack is not isolated: ${JSON.stringify(geometry)}`
      )
  })
})
