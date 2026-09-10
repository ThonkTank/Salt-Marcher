import { beginCampaignCreation } from './support/campaign-navigation.js'
import { browser, expect } from '@wdio/globals'
import type { Browser as WdioBrowser } from 'webdriverio'

describe('isolated workspace routes', () => {
  it('loads Session, Catalog and Hex through the persistent shell', async () => {
    const client = browser as unknown as WdioBrowser
    await beginCampaignCreation(client)
    const campaignName = await client.$('#campaign-name')
    await campaignName.waitForDisplayed({ timeout: 30_000 })
    await campaignName.setValue('Workspace Isolation')
    await (await client.$('button=Erstellen & öffnen')).click()
    await (await client.$('.scene-desktop')).waitForExist({ timeout: 10_000 })

    const menu = await client.$('button[aria-label="Menü"]')
    await expect(menu).toBeExisting()
    await expect(await client.$('.scene-desktop')).toBeExisting()

    await (await client.$('button[aria-label="Katalog"]')).click()
    await expect(await client.$('.catalog-workspace')).toBeExisting()
    await expect(menu).toBeExisting()

    await (await client.$('button[aria-label="Hex-Editor"]')).click()
    await expect(await client.$('.hex-editor-workspace')).toBeExisting()
    await expect(menu).toBeExisting()

    await (await client.$('button[aria-label="Session"]')).click()
    await expect(await client.$('.scene-desktop')).toBeExisting()
    await expect(menu).toBeExisting()
  })

  it('keeps workspace geometry stable while shell errors are visible', async () => {
    const client = browser as unknown as WdioBrowser
    const geometry = await client.execute(() => {
      const shell = document.querySelector<HTMLElement>('.app-shell')
      const workspace = document.querySelector<HTMLElement>('.scene-desktop')
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

describe('workspace draft transitions', () => {
  it('keeps an unsubmitted character on cancel, then saves or discards before leaving', async () => {
    const client = browser as unknown as WdioBrowser
    const openCharacters = async () => {
      await client.$('button[aria-label="Katalog"]').click()
      await client.$('.catalog-workspace').waitForExist({ timeout: 10_000 })
      await client.$('.catalog-section-selector').$('button=Charaktere').click()
      await client
        .$('.character-catalog-host')
        .$('button=Neu')
        .waitForClickable({ timeout: 10_000 })
    }
    await openCharacters()
    await client.$('.character-catalog-host').$('button=Neu').click()
    const input = () => client.$('.character-profile-form input[name="name"]')
    await input().setValue('Entwurf vor Bereichswechsel')
    await client.$('button[aria-label="Session"]').click()
    const dialog = () =>
      client.$('[role="alertdialog"][aria-label="Arbeitsbereich wechseln"]')
    await dialog().waitForDisplayed({ timeout: 10_000 })
    await expect(input()).toHaveValue('Entwurf vor Bereichswechsel')
    await expect(input()).toBeDisabled()
    await dialog().$('button=Abbrechen').click()
    await expect(input()).toHaveValue('Entwurf vor Bereichswechsel')
    await expect(input()).toBeEnabled()
    await client.$('button[aria-label="Session"]').click()
    await dialog().waitForDisplayed({ timeout: 10_000 })
    await dialog().$('button=Speichern und fortfahren').click()
    await client.$('.scene-desktop').waitForExist({ timeout: 10_000 })
    await openCharacters()
    await expect(client.$('.character-catalog-host')).toHaveText(
      expect.stringContaining('Entwurf vor Bereichswechsel')
    )
    await client.$('.character-catalog-host').$('button=Neu').click()
    await input().setValue('Dieser Entwurf wird verworfen')
    await client.$('button[aria-label="Session"]').click()
    await dialog().waitForDisplayed({ timeout: 10_000 })
    await dialog().$('button=Verwerfen und fortfahren').click()
    await client.$('.scene-desktop').waitForExist({ timeout: 10_000 })
    await openCharacters()
    await expect(client.$('.character-catalog-host')).not.toHaveText(
      expect.stringContaining('Dieser Entwurf wird verworfen')
    )
    await expect(client.$('.character-catalog-host')).toHaveText(
      expect.stringContaining('Entwurf vor Bereichswechsel')
    )
    await client.$('button[aria-label="Session"]').click()
    await client.$('.scene-desktop').waitForExist({ timeout: 10_000 })
  })
})
