import { AxeBuilder } from '@axe-core/webdriverio'
import type { Browser as WdioBrowser } from 'webdriverio'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

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

export async function expectElementGolden(
  client: WdioBrowser,
  name: string,
  selector: string
): Promise<void> {
  if (process.platform !== 'linux') return
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
  if (process.env['UPDATE_VISUAL_GOLDENS'] === '1') {
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
