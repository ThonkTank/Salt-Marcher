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
    testPattern: 'renders the location dialog',
    selector: '.location-dialog',
    viewport: { width: 720, height: 540 }
  },
  {
    name: 'location-dialog-dark',
    suite: 'locations',
    testPattern: 'renders the location dialog',
    selector: '.location-dialog',
    viewport: { width: 720, height: 540 }
  },
  {
    name: 'other-dialog',
    suite: 'other',
    testPattern: 'renders the other dialog',
    selector: '.other-dialog',
    viewport: { width: 720, height: 540 }
  }
]

describe('visual golden update policy', () => {
  it('rejects unrestricted and unknown updates', () => {
    expect(() => selectedVisualGoldens('1', entries)).toThrow('forbidden')
    expect(() => selectedVisualGoldens('missing', entries)).toThrow('Unknown')
    expect(() => parseVisualGoldenUpdateArguments([], entries)).toThrow(
      'At least one --golden'
    )
  })

  it('requires one matching suite, accepts named batches and can reuse a build', () => {
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
    const batch = parseVisualGoldenUpdateArguments(
      [
        '--golden',
        'location-dialog',
        '--golden',
        'location-dialog-dark',
        '--suite',
        'locations'
      ],
      entries
    )
    expect([...batch.names]).toEqual([
      'location-dialog',
      'location-dialog-dark'
    ])
    expect(() =>
      parseVisualGoldenUpdateArguments(
        [
          '--golden',
          'location-dialog',
          '--golden',
          'other-dialog',
          '--suite',
          'locations'
        ],
        entries
      )
    ).toThrow('belongs to suite other')
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
    const updater = readFileSync('scripts/update-visual-golden.ts', 'utf8')
    const verifier = readFileSync('scripts/run-visual-suites.ts', 'utf8')
    expect(updater).toContain('SALT_MARCHER_E2E_GREP')
    expect(updater).toContain('SALT_MARCHER_VISUAL_MODE')
    expect(verifier).toContain('golden.testPattern')
  })

  it('rejects duplicate names and suites missing from the E2E registry', () => {
    expect(() =>
      validateVisualGoldenSuites(entries, new Set(['locations', 'other']))
    ).not.toThrow()
    expect(() =>
      validateVisualGoldenSuites(entries, new Set(['missing']))
    ).toThrow('unknown E2E suite')
    expect(() =>
      validateVisualGoldenSuites(
        [...entries, entries[0]!],
        new Set(['locations', 'other'])
      )
    ).toThrow('Duplicate')
  })
})
