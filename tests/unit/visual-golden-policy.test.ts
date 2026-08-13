import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  parseVisualGoldenUpdateArguments,
  selectedVisualGoldens,
  validateVisualGoldenSuites,
  visualGoldenBaselineDirectoryNames,
  type VisualGoldenEntry
} from '../../scripts/visual-golden-policy.js'

const entries: readonly VisualGoldenEntry[] = [
  {
    name: 'location-dialog',
    suite: 'locations',
    selector: '.location-dialog',
    viewport: { width: 720, height: 540 }
  }
]

describe('visual golden update policy', () => {
  it('rejects unrestricted and unknown updates', () => {
    expect(() => selectedVisualGoldens('1', entries)).toThrow('forbidden')
    expect(() => selectedVisualGoldens('missing', entries)).toThrow('Unknown')
    expect(() => parseVisualGoldenUpdateArguments([], entries)).toThrow(
      'Exactly one --golden'
    )
  })

  it('requires one matching suite and can reuse an existing build', () => {
    const selection = parseVisualGoldenUpdateArguments(
      [
        '--',
        '--golden',
        'location-dialog',
        '--suite',
        'locations',
        '--reuse-build'
      ],
      entries
    )
    expect([...selection.names]).toEqual(['location-dialog'])
    expect(selection.suite).toBe('locations')
    expect(selection.reuseBuild).toBe(true)
    expect(() =>
      parseVisualGoldenUpdateArguments(
        ['--golden', 'location-dialog', '--suite', 'other'],
        entries
      )
    ).toThrow('belongs to suite locations')
    expect(() =>
      parseVisualGoldenUpdateArguments(
        [
          '--golden',
          'location-dialog',
          '--golden',
          'location-dialog',
          '--suite',
          'locations'
        ],
        entries
      )
    ).toThrow('Exactly one --golden')
  })

  it('resolves a validated runner-specific baseline before Linux fallback', () => {
    expect(visualGoldenBaselineDirectoryNames(undefined)).toEqual(['linux'])
    expect(visualGoldenBaselineDirectoryNames('  ')).toEqual(['linux'])
    expect(visualGoldenBaselineDirectoryNames('ubuntu-24.04')).toEqual([
      'linux-ubuntu-24.04',
      'linux'
    ])
    expect(() => visualGoldenBaselineDirectoryNames('../unexpected')).toThrow(
      'Invalid visual golden variant'
    )
  })

  it('drives selector, suite and viewport from the manifest at capture time', () => {
    const assertions = readFileSync(
      'tests/e2e/support/e2e-assertions.ts',
      'utf8'
    )
    expect(assertions).toContain('entry.selector')
    expect(assertions).toContain('entry.suite')
    expect(assertions).toContain('entry.viewport.width')
    expect(assertions).toContain('entry.viewport.height')
  })

  it('rejects duplicate names and suites missing from the E2E registry', () => {
    expect(() =>
      validateVisualGoldenSuites(entries, new Set(['locations']))
    ).not.toThrow()
    expect(() =>
      validateVisualGoldenSuites(entries, new Set(['other']))
    ).toThrow('unknown E2E suite')
    expect(() =>
      validateVisualGoldenSuites(
        [...entries, entries[0]!],
        new Set(['locations'])
      )
    ).toThrow('Duplicate')
  })
})
