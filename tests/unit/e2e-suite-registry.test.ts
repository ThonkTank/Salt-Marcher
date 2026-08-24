import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, expect } from 'vitest'
import {
  e2eSuiteHasType,
  e2eSuiteRegistry
} from '../../scripts/e2e-suite-registry.js'
import {
  validateVisualGoldenSuites,
  type VisualGoldenEntry
} from '../../scripts/visual-golden-policy.js'
import {
  callCount,
  hasCall,
  readTypeScriptModule
} from '../architecture/support/typescript-module.js'
import { architectureGate } from '../architecture/support/architecture-gate.js'

describe('E2E suite registry', () => {
  architectureGate(
    'typed-contract',
    'is the complete source for regular specs and fixture ownership',
    () => {
      const names = e2eSuiteRegistry.map((suite) => suite.name)
      expect(new Set(names).size).toBe(names.length)
      for (const suite of e2eSuiteRegistry) {
        expect(existsSync(suite.spec), `${suite.name} spec is missing`).toBe(
          true
        )
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
    }
  )

  architectureGate(
    'typed-contract',
    'accepts every visual manifest suite against the same registry',
    () => {
      const manifest = JSON.parse(
        readFileSync('tests/e2e/goldens/manifest.json', 'utf8')
      ) as { goldens: VisualGoldenEntry[] }
      expect(() =>
        validateVisualGoldenSuites(
          manifest.goldens,
          new Set(e2eSuiteRegistry.map((suite) => suite.name))
        )
      ).not.toThrow()
      const literalValues = [
        ...e2eSuiteRegistry.map((suite) => readTypeScriptModule(suite.spec)),
        readTypeScriptModule('tests/e2e/support/campaign-walking-scenarios.ts')
      ].flatMap(({ stringLiterals }) => stringLiterals)
      for (const golden of manifest.goldens)
        expect(
          literalValues,
          `${golden.name} has no executable E2E assertion`
        ).toContain(golden.name)
      for (const golden of manifest.goldens)
        expect(literalValues).toContain(golden.testPattern)
      expect(
        [...new Set(manifest.goldens.map((golden) => golden.suite))].toSorted()
      ).toEqual(
        e2eSuiteRegistry
          .filter((suite) => e2eSuiteHasType(suite, 'visual'))
          .map((suite) => suite.name)
          .toSorted()
      )
    }
  )

  architectureGate(
    'behavior-integration',
    'keeps behavior selectors free of positional DOM coupling',
    () => {
      const selectors = e2eSuiteRegistry
        .map((suite) => readTypeScriptModule(suite.spec))
        .flatMap(({ stringLiterals }) => stringLiterals)
      expect(
        selectors.filter((value) => /:nth-(?:child|of-type)\s*\(/.test(value))
      ).toEqual([])
      expect(
        selectors.filter(
          (value) =>
            value.includes('querySelector') && /(?::first|:last)/.test(value)
        )
      ).toEqual([])
    }
  )

  architectureGate(
    'behavior-integration',
    'keeps campaign scenarios independently startable from the empty fixture',
    () => {
      const campaigns = e2eSuiteRegistry.filter((suite) =>
        suite.name.startsWith('campaign')
      )
      expect(campaigns).toHaveLength(5)
      for (const campaign of campaigns) {
        expect(campaign.fixture).toBe('v1/empty-installation')
        expect(callCount(readTypeScriptModule(campaign.spec), 'it')).toBe(1)
      }
      expect(existsSync('tests/e2e/campaign-walking.e2e.ts')).toBe(false)
    }
  )

  architectureGate(
    'behavior-integration',
    'materializes a fresh per-suite profile and supports shuffled order',
    () => {
      const configuration = readTypeScriptModule('wdio.conf.ts')
      const passive = readTypeScriptModule('wdio.passive.conf.ts')
      const runner = readTypeScriptModule('scripts/run-e2e-suites.ts')
      for (const identifier of ['suite', 'runId', 'process', 'pid'])
        expect(configuration.identifiers.has(identifier)).toBe(true)
      for (const call of ['rmSync', 'cpSync', 'electronTestApplication'])
        expect(hasCall(configuration, call)).toBe(true)
      expect(configuration.objectProperties).not.toContain('appEntryPoint')
      expect(hasCall(passive, 'evaluateE2eResourcePreflight')).toBe(true)
      expect(hasCall(passive, 'electronTestApplication')).toBe(true)
      expect(passive.objectProperties).not.toContain('appEntryPoint')
      expect(hasCall(runner, 'argumentAfter')).toBe(true)
      expect(runner.stringLiterals).toContain('--shuffle-seed')
      expect(runner.identifiers.has('shuffledSuiteOrder')).toBe(true)
    }
  )
})
