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
  rendererAcknowledgesOuterWindowGeometry,
  rendererAcknowledgesWindowGeometry,
  type RendererWindowGeometry
} from './e2e-window-geometry.js'
import {
  selectedVisualGoldens,
  validateVisualGoldenSuites,
  visualGoldenBaselineDirectoryNames,
  type VisualGoldenEntry
} from '../../../scripts/visual-golden-policy.js'
import { e2eSuiteRegistry } from '../../../scripts/e2e-suite-registry.js'

const goldenManifest = JSON.parse(
  readFileSync(
    join(process.cwd(), 'tests', 'e2e', 'goldens', 'manifest.json'),
    'utf8'
  )
) as { version: 1; goldens: VisualGoldenEntry[] }
validateVisualGoldenSuites(
  goldenManifest.goldens,
  new Set(e2eSuiteRegistry.map((suite) => suite.name))
)

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
  const initialTheme = await client.execute(() =>
    document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light'
  )
  const alternateTheme = initialTheme === 'dark' ? 'light' : 'dark'
  await expectAccessible(client)
  await client.execute(
    (theme) => (document.documentElement.dataset['theme'] = theme),
    alternateTheme
  )
  await client.pause(250)
  try {
    await expectAccessible(client)
  } finally {
    await client.execute(
      (theme) => (document.documentElement.dataset['theme'] = theme),
      initialTheme
    )
    await client.pause(250)
  }
}

export async function setElectronWindowSize(
  client: WdioBrowser,
  width: number,
  height: number
): Promise<void> {
  type WindowGeometry = Readonly<{
    outerWidth: number
    outerHeight: number
    contentWidth: number
    contentHeight: number
  }>
  const electronClient = client as WdioBrowser & {
    electron: {
      execute: <Result, Arguments extends readonly unknown[]>(
        script: (
          electron: typeof import('electron'),
          ...arguments_: Arguments
        ) => Result,
        ...arguments_: Arguments
      ) => Promise<Result>
    }
  }
  const rendererUrl = await client.getUrl()
  const resizedWithElectron =
    process.env['SALT_MARCHER_E2E_FORCE_BROWSER_RESIZE'] === 'true'
      ? false
      : await electronClient.electron
          .execute(
            (electron, targetUrl, nextWidth, nextHeight) => {
              const candidates = electron.BrowserWindow.getAllWindows().filter(
                (candidate) => !candidate.isDestroyed()
              )
              const matching = candidates.filter(
                (candidate) => candidate.webContents.getURL() === targetUrl
              )
              const target =
                matching.find((candidate) => candidate.isFocused()) ??
                matching.find((candidate) => candidate.isVisible()) ??
                electron.BrowserWindow.getFocusedWindow() ??
                candidates.find((candidate) => candidate.isVisible()) ??
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
              if (target.isMaximized()) target.unmaximize()
              if (target.isFullScreen()) target.setFullScreen(false)
              target.setSize(nextWidth, nextHeight)
              return true
            },
            rendererUrl,
            width,
            height
          )
          .catch(() => false)
  if (!resizedWithElectron) {
    await setWindowSizeThroughBrowser(client, width, height)
    return
  }
  let geometry: WindowGeometry | null = null
  await client.waitUntil(
    async () => {
      geometry = await electronClient.electron.execute(
        (electron, targetUrl) => {
          const candidates = electron.BrowserWindow.getAllWindows().filter(
            (candidate) => !candidate.isDestroyed()
          )
          const matching = candidates.filter(
            (candidate) => candidate.webContents.getURL() === targetUrl
          )
          const target =
            matching.find((candidate) => candidate.isFocused()) ??
            matching.find((candidate) => candidate.isVisible()) ??
            electron.BrowserWindow.getFocusedWindow() ??
            candidates.find((candidate) => candidate.isVisible()) ??
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
          if (!target) return null
          const outer = target.getBounds()
          const content = target.getContentBounds()
          return {
            outerWidth: outer.width,
            outerHeight: outer.height,
            contentWidth: content.width,
            contentHeight: content.height
          }
        },
        rendererUrl
      )
      return geometry?.outerWidth === width && geometry.outerHeight === height
    },
    {
      timeout: 15_000,
      interval: 100,
      timeoutMsg: 'Electron did not confirm the requested outer window size.'
    }
  )
  const confirmed = geometry
  if (!confirmed) throw new Error('Electron window geometry is unavailable.')
  let lastObserved: RendererWindowGeometry | null = null
  try {
    await client.waitUntil(
      async () => {
        lastObserved = await client.execute(() => {
          const workspace =
            document.querySelector<HTMLElement>('.session-workspace')
          const renderedWidth = workspace?.getBoundingClientRect().width ?? 0
          const measuredWidth = Number(workspace?.dataset['workspaceWidth'])
          return {
            outerWidth: window.outerWidth,
            outerHeight: window.outerHeight,
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            workspace:
              workspace && renderedWidth > 0
                ? {
                    ready: workspace.dataset['sessionLayoutReady'] === 'true',
                    measuredWidth,
                    renderedWidth
                  }
                : null
          }
        })
        return (
          rendererAcknowledgesWindowGeometry(confirmed, lastObserved) ||
          rendererAcknowledgesOuterWindowGeometry(
            { width, height },
            lastObserved
          )
        )
      },
      {
        timeout: 750,
        interval: 100,
        timeoutMsg:
          'Renderer content geometry and owned layout did not acknowledge the Electron resize.'
      }
    )
  } catch {
    if (
      await setRendererViewportThroughPuppeteer(
        client,
        rendererUrl,
        width,
        height
      )
    )
      return
    await setWindowSizeThroughBrowser(client, width, height)
  }
}

async function setRendererViewportThroughPuppeteer(
  client: WdioBrowser,
  rendererUrl: string,
  width: number,
  height: number
): Promise<boolean> {
  try {
    const puppeteer = await client.getPuppeteer()
    const page = (await puppeteer.pages()).find(
      (candidate) => candidate.url() === rendererUrl
    )
    if (!page) return false
    await page.setViewport({ width, height, deviceScaleFactor: 1 })
    await client.waitUntil(
      async () =>
        client.execute(
          (nextWidth, nextHeight) =>
            Math.abs(window.innerWidth - nextWidth) <= 1 &&
            Math.abs(window.innerHeight - nextHeight) <= 1,
          width,
          height
        ),
      {
        timeout: 15_000,
        interval: 100,
        timeoutMsg: 'Renderer did not acknowledge the emulated viewport size.'
      }
    )
    return true
  } catch {
    return false
  }
}

async function setWindowSizeThroughBrowser(
  client: WdioBrowser,
  width: number,
  height: number
): Promise<void> {
  await client.execute(
    (nextWidth, nextHeight) => window.resizeTo(nextWidth, nextHeight),
    width,
    height
  )
  await client.waitUntil(
    async () => {
      const observed = await client.execute(() => {
        const workspace =
          document.querySelector<HTMLElement>('.session-workspace')
        const renderedWidth = workspace?.getBoundingClientRect().width ?? 0
        const measuredWidth = Number(workspace?.dataset['workspaceWidth'])
        return {
          outerWidth: window.outerWidth,
          outerHeight: window.outerHeight,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          workspace:
            workspace && renderedWidth > 0
              ? {
                  ready: workspace.dataset['sessionLayoutReady'] === 'true',
                  measuredWidth,
                  renderedWidth
                }
              : null
        }
      })
      return (
        rendererAcknowledgesOuterWindowGeometry({ width, height }, observed) ||
        (Math.abs(observed.outerWidth - width) <= 1 &&
          Math.abs(observed.outerHeight - height) <= 1) ||
        (Math.abs(observed.innerWidth - width) <= 1 &&
          Math.abs(observed.innerHeight - height) <= 1)
      )
    },
    {
      timeout: 15_000,
      interval: 100,
      timeoutMsg:
        'Renderer outer geometry and owned layout did not acknowledge the browser resize.'
    }
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

export async function replaceFieldValue(
  client: WdioBrowser,
  input: ChainablePromiseElement,
  value: string
): Promise<void> {
  await input.click()
  await client.keys([process.platform === 'darwin' ? 'Meta' : 'Control', 'a'])
  await client.keys(value)
  await client.waitUntil(async () => (await input.getValue()) === value, {
    timeout: 5_000,
    timeoutMsg: `Field value was not replaced with ${JSON.stringify(value)}.`
  })
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
  selector: string,
  resizeWindow = true
): Promise<void> {
  if (process.platform !== 'linux') return
  if (process.env['SALT_MARCHER_VISUAL_MODE'] !== 'true') return
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
  if (resizeWindow)
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
  await client.waitUntil(
    async () => client.execute(() => document.fonts.status === 'loaded'),
    { timeout: 10_000, timeoutMsg: 'Document fonts did not finish loading.' }
  )
  await client.pause(50)
  const goldensDirectory = join(process.cwd(), 'tests', 'e2e', 'goldens')
  const artifacts =
    process.env['SALT_MARCHER_E2E_ARTIFACT_DIR'] ??
    join(process.cwd(), '.tmp', 'visual-diffs')
  mkdirSync(artifacts, { recursive: true })
  const actualPath = join(artifacts, `${name}.png`)
  const defaultBaselinePath = join(goldensDirectory, 'linux', `${name}.png`)
  const baselinePath = selected.has(name)
    ? defaultBaselinePath
    : (visualGoldenBaselineDirectoryNames(
        process.env['SALT_MARCHER_VISUAL_GOLDEN_VARIANT']
      )
        .map((directory) => join(goldensDirectory, directory, `${name}.png`))
        .find((candidate) => existsSync(candidate)) ?? defaultBaselinePath)
  const element = client.$(selector)
  const bytes = await Promise.resolve(element.saveScreenshot(actualPath))
  if (selected.has(name)) {
    mkdirSync(join(goldensDirectory, 'linux'), { recursive: true })
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
