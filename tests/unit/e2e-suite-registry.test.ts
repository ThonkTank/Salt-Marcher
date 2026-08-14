import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { e2eSuiteRegistry } from '../e2e/support/e2e-suite-registry.js'
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
      .join('\n')
    for (const golden of manifest.goldens)
      expect(
        e2eSources,
        `${golden.name} has no executable E2E assertion`
      ).toContain(`'${golden.name}'`)
  })
})
