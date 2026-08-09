import { AxeBuilder } from '@axe-core/webdriverio'
import type {
  Browser as WdioBrowser,
  ChainablePromiseElement
} from 'webdriverio'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { mainWindowGeometry } from '../../../src/shared/contracts/window-geometry.js'
import {
  selectedVisualGoldens,
  type VisualGoldenEntry
} from '../../../scripts/visual-golden-policy.js'

const goldenManifest = JSON.parse(
  readFileSync(
    join(process.cwd(), 'tests', 'e2e', 'goldens', 'manifest.json'),
    'utf8'
  )
) as { version: 1; goldens: VisualGoldenEntry[] }

export async function expectAccessible(client: WdioBrowser): Promise<void> {
  const results = await new AxeBuilder({ client }).setLegacyMode().analyze()
  if (results.violations.length > 0)
    throw new Error(
      `Accessibility violations: ${JSON.stringify(results.violations)}`
    )
}

export async function expectAccessibleInBothThemes(
  client: WdioBrowser
): Promise<void> {
  await expectAccessible(client)
  await client.execute(() => {
    document.querySelector<HTMLButtonElement>('.theme-toggle')?.click()
  })
  try {
    await expectAccessible(client)
  } finally {
    await client.execute(() => {
      document.querySelector<HTMLButtonElement>('.theme-toggle')?.click()
    })
  }
}

export async function setElectronWindowSize(
  client: WdioBrowser,
  width: number,
  height: number
): Promise<void> {
  const electronClient = client as WdioBrowser & {
    electron: {
      execute: (
        script: (
          electron: typeof import('electron'),
          width: number,
          height: number
        ) => boolean,
        width: number,
        height: number
      ) => Promise<boolean>
    }
  }
  await client.waitUntil(
    async () => {
      try {
        return await electronClient.electron.execute(
          (electron, nextWidth, nextHeight) => {
            const target =
              electron.BrowserWindow.getFocusedWindow() ??
              electron.BrowserWindow.getAllWindows().find(
                (candidate) => !candidate.isDestroyed() && candidate.isVisible()
              ) ??
              electron.webContents
                .getAllWebContents()
                .map((contents) =>
                  electron.BrowserWindow.fromWebContents(contents)
                )
                .find(
                  (candidate) =>
                    candidate !== null &&
                    !candidate.isDestroyed() &&
                    candidate.isVisible()
                )
            if (!target) return false
            target.setSize(nextWidth, nextHeight)
            return true
          },
          width,
          height
        )
      } catch {
        return false
      }
    },
    {
      timeout: 10_000,
      interval: 250,
      timeoutMsg: 'No Electron window was available to resize.'
    }
  )
  await client.waitUntil(
    async () =>
      (
        await client.execute(() => ({
          width: window.innerWidth,
          height: window.innerHeight
        }))
      ).width <= width,
    { timeout: 15_000, timeoutMsg: 'Renderer did not observe window resize' }
  )
}

export function setWindowToMinimumResponsiveSize(
  client: WdioBrowser
): Promise<void> {
  return setElectronWindowSize(
    client,
    mainWindowGeometry.minimumWidth,
    mainWindowGeometry.minimumHeight
  )
}

export async function clickWhenInteractable(
  element: ChainablePromiseElement
): Promise<void> {
  await element.scrollIntoView({ block: 'center', inline: 'nearest' })
  await element.waitForClickable({ timeout: 10_000 })
  await element.click()
}

export async function expectEditorFrameGeometry(
  client: WdioBrowser,
  selector: string
): Promise<void> {
  const geometry = await client.execute((frameSelector) => {
    const frame = document.querySelector<HTMLElement>(frameSelector)
    const header = frame?.querySelector<HTMLElement>('.editor-dialog-header')
    const body = frame?.querySelector<HTMLElement>('.editor-dialog-body')
    const footer = frame?.querySelector<HTMLElement>('.editor-dialog-footer')
    if (!frame || !header || !body || !footer) return null
    const bounds = (element: HTMLElement) => {
      const box = element.getBoundingClientRect()
      return { top: box.top, bottom: box.bottom }
    }
    const frameBox = frame.getBoundingClientRect()
    return {
      frame: {
        top: frameBox.top,
        right: frameBox.right,
        bottom: frameBox.bottom,
        left: frameBox.left
      },
      header: bounds(header),
      body: bounds(body),
      footer: bounds(footer),
      bodyOverflowY: getComputedStyle(body).overflowY,
      viewport: { width: window.innerWidth, height: window.innerHeight }
    }
  }, selector)
  if (!geometry) throw new Error(`Editor frame is incomplete: ${selector}`)
  if (
    geometry.frame.top < 0 ||
    geometry.frame.left < 0 ||
    geometry.frame.right > geometry.viewport.width ||
    geometry.frame.bottom > geometry.viewport.height ||
    geometry.header.bottom > geometry.body.top + 1 ||
    geometry.body.bottom > geometry.footer.top + 1 ||
    !['auto', 'scroll'].includes(geometry.bodyOverflowY)
  )
    throw new Error(
      `Invalid editor frame geometry: ${JSON.stringify(geometry)}`
    )
}

export async function expectElementGolden(
  client: WdioBrowser,
  name: string,
  selector: string
): Promise<void> {
  if (process.platform !== 'linux') return
  const entry = goldenManifest.goldens.find(
    (candidate) => candidate.name === name
  )
  if (!entry)
    throw new Error(`Golden is not registered in the manifest: ${name}`)
  if (entry.selector !== selector)
    throw new Error(
      `Golden selector mismatch for ${name}: ${selector}; manifest: ${entry.selector}`
    )
  const suite = process.env['SALT_MARCHER_E2E_SUITE']
  if (suite && entry.suite !== suite)
    throw new Error(
      `Golden ${name} belongs to suite ${entry.suite}, not ${suite}.`
    )
  await setElectronWindowSize(
    client,
    entry.viewport.width,
    entry.viewport.height
  )
  const selected = selectedVisualGoldens(
    process.env['UPDATE_VISUAL_GOLDENS'],
    goldenManifest.goldens
  )
  await client.execute(() => {
    const style = document.createElement('style')
    style.dataset['visualTest'] = 'true'
    style.textContent =
      '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'
    document.head.append(style)
  })
  const directory = join(process.cwd(), 'tests', 'e2e', 'goldens', 'linux')
  const artifacts = join(process.cwd(), '.tmp', 'visual-diffs')
  mkdirSync(directory, { recursive: true })
  mkdirSync(artifacts, { recursive: true })
  const actualPath = join(artifacts, `${name}.png`)
  const baselinePath = join(directory, `${name}.png`)
  const element = client.$(selector)
  const bytes = await Promise.resolve(element.saveScreenshot(actualPath))
  if (selected.has(name)) {
    writeFileSync(baselinePath, bytes)
    return
  }
  if (!existsSync(baselinePath))
    throw new Error(`Missing golden ${baselinePath}`)
  const expected = PNG.sync.read(readFileSync(baselinePath))
  const actual = PNG.sync.read(bytes)
  if (actual.width !== expected.width || actual.height !== expected.height)
    throw new Error(
      `Golden ${name} has ${actual.width}x${actual.height}, expected ${expected.width}x${expected.height}.`
    )
  const diff = new PNG({ width: actual.width, height: actual.height })
  const changed = pixelmatch(
    expected.data,
    actual.data,
    diff.data,
    actual.width,
    actual.height,
    { threshold: 0.2 }
  )
  writeFileSync(join(artifacts, `${name}.diff.png`), PNG.sync.write(diff))
  const ratio = changed / (actual.width * actual.height)
  if (ratio > 0.03)
    throw new Error(`Golden ${name} differs by ${(ratio * 100).toFixed(2)}%.`)
}
