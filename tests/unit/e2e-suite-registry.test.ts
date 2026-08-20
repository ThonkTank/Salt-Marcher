import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { e2eSuiteRegistry } from '../../scripts/e2e-suite-registry.js'
import {
  validateVisualGoldenSuites,
  type VisualGoldenEntry
} from '../../scripts/visual-golden-policy.js'

describe('E2E suite registry', () => {
  it('is the complete source for regular specs and fixture ownership', () => {
    const names = e2eSuiteRegistry.map((suite) => suite.name)
    expect(new Set(names).size).toBe(names.length)
    for (const suite of e2eSuiteRegistry) {
      expect(existsSync(suite.spec), `${suite.name} spec is missing`).toBe(true)
      expect(
        existsSync(`tests/e2e/fixtures/${suite.fixture}/fixture.json`),
        `${suite.name} fixture is missing`
      ).toBe(true)
    }
    const regularSpecs = readdirSync('tests/e2e')
      .filter(
        (file) => file.endsWith('.e2e.ts') && file !== 'passive-window.e2e.ts'
      )
      .map((file) => `./tests/e2e/${file}`)
      .toSorted()
    expect(e2eSuiteRegistry.map((suite) => suite.spec).toSorted()).toEqual(
      regularSpecs
    )
  })

  it('accepts every visual manifest suite against the same registry', () => {
    const manifest = JSON.parse(
      readFileSync('tests/e2e/goldens/manifest.json', 'utf8')
    ) as { goldens: VisualGoldenEntry[] }
    expect(() =>
      validateVisualGoldenSuites(
        manifest.goldens,
        new Set(e2eSuiteRegistry.map((suite) => suite.name))
      )
    ).not.toThrow()
    const e2eSources = e2eSuiteRegistry
      .map((suite) => readFileSync(suite.spec, 'utf8'))
      .concat(
        readFileSync('tests/e2e/support/campaign-walking-scenarios.ts', 'utf8')
      )
      .join('\n')
    for (const golden of manifest.goldens)
      expect(
        e2eSources,
        `${golden.name} has no executable E2E assertion`
      ).toContain(`'${golden.name}'`)
    for (const golden of manifest.goldens)
      expect(e2eSources).toContain(golden.testPattern)
  })

  it('keeps behavior selectors free of positional DOM coupling', () => {
    const e2eSources = e2eSuiteRegistry
      .map((suite) => readFileSync(suite.spec, 'utf8'))
      .join('\n')
    expect(e2eSources).not.toMatch(/:nth-(?:child|of-type)\s*\(/)
    expect(e2eSources).not.toMatch(
      /querySelector(?:All)?\([^\n]*(?::first|:last)/
    )
  })

  it('keeps campaign scenarios independently startable from the empty fixture', () => {
    const campaigns = e2eSuiteRegistry.filter((suite) =>
      suite.name.startsWith('campaign')
    )
    expect(campaigns).toHaveLength(4)
    for (const campaign of campaigns) {
      expect(campaign.fixture).toBe('v1/empty-installation')
      expect(readFileSync(campaign.spec, 'utf8').match(/\bit\(/g)).toHaveLength(
        1
      )
    }
    expect(existsSync('tests/e2e/campaign-walking.e2e.ts')).toBe(false)
  })

  it('materializes a fresh per-suite profile and supports shuffled order', () => {
    const configuration = readFileSync('wdio.conf.ts', 'utf8')
    const passiveConfiguration = readFileSync('wdio.passive.conf.ts', 'utf8')
    const runner = readFileSync('scripts/run-e2e-suites.ts', 'utf8')
    expect(configuration).toContain('`${suite}-${runId}-${process.pid}`')
    expect(configuration).toContain(
      'rmSync(userData, { recursive: true, force: true })'
    )
    expect(configuration).toContain(
      "cpSync(join(process.cwd(), 'tests', 'e2e', 'fixtures', fixture)"
    )
    expect(configuration).toContain('electronTestApplication(')
    expect(configuration).not.toContain('appEntryPoint:')
    expect(passiveConfiguration).toContain('evaluateE2eResourcePreflight(')
    expect(passiveConfiguration).toContain('electronTestApplication(')
    expect(passiveConfiguration).not.toContain('appEntryPoint:')
    expect(runner).toContain("argumentAfter('--shuffle-seed')")
    expect(runner).toContain('shuffledSuiteOrder')
  })
})
