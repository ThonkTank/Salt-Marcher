import { describe, expect, it } from 'vitest'
import {
  bundleGraphGrowth,
  bundleGraphRatchets,
  bundleGrowthAllowanceBytes,
  excessiveBundleGrowth
} from '../../scripts/bundle-budget-policy.js'
import { parseBundleBaselineUpdateArguments } from '../../scripts/bundle-baseline-update.js'
import { resolveBundleManifestEntry } from '../../scripts/bundle-manifest-entry.js'

describe('bundle baseline growth policy', () => {
  it('allows exactly 16 KiB and reports only larger graph growth', () => {
    const current = {
      shell: 100 + bundleGrowthAllowanceBytes,
      catalog: 20_000
    }
    const baseline = { shell: 100, catalog: 100 }
    expect(bundleGraphGrowth(current, baseline)).toEqual([
      {
        graph: 'catalog',
        bytes: 20_000,
        baseline: 100,
        growth: 19_900
      },
      {
        graph: 'shell',
        bytes: 100 + bundleGrowthAllowanceBytes,
        baseline: 100,
        growth: bundleGrowthAllowanceBytes
      }
    ])
    expect(excessiveBundleGrowth(current, baseline)).toEqual([
      {
        graph: 'catalog',
        bytes: 20_000,
        baseline: 100,
        growth: 19_900
      }
    ])
  })

  it('identifies every graph that must ratchet down', () => {
    expect(
      bundleGraphRatchets(
        { shell: 90, catalog: 200, hex: 300 },
        { shell: 100, catalog: 200, hex: 350 }
      )
    ).toEqual([
      { graph: 'hex', bytes: 300, baseline: 350, reduction: 50 },
      { graph: 'shell', bytes: 90, baseline: 100, reduction: 10 }
    ])
  })
})

describe('bundle baseline update arguments', () => {
  it('requires explicit change, dependency, and chunk rationales', () => {
    expect(() =>
      parseBundleBaselineUpdateArguments(['--reason', 'expected growth'])
    ).toThrow('--dependency')
    expect(
      parseBundleBaselineUpdateArguments([
        '--',
        '--reason',
        'editor frame',
        '--dependency',
        'no dependency change',
        '--chunk',
        'shared shell code remains in the shell graph'
      ])
    ).toEqual({
      reason: 'editor frame',
      dependencyRationale: 'no dependency change',
      chunkRationale: 'shared shell code remains in the shell graph'
    })
  })
})

describe('bundle manifest entry identity', () => {
  const manifest = {
    source: {
      file: 'source.js',
      src: 'features/example.ts',
      name: 'renamed',
      isDynamicEntry: true
    },
    fallback: {
      file: 'fallback.js',
      name: 'workspace',
      isDynamicEntry: true
    }
  }

  it('prefers the stable source path and falls back to a typed dynamic name', () => {
    expect(
      resolveBundleManifestEntry(manifest, {
        label: 'example',
        src: 'features/example.ts',
        name: 'workspace',
        isDynamicEntry: true
      })
    ).toBe('source')
    expect(
      resolveBundleManifestEntry(manifest, {
        label: 'workspace',
        src: 'features/missing.ts',
        name: 'workspace',
        isDynamicEntry: true
      })
    ).toBe('fallback')
  })

  it('reports every ambiguous graph candidate', () => {
    expect(() =>
      resolveBundleManifestEntry(
        {
          first: { file: 'first.js', name: 'leaf', isDynamicEntry: true },
          second: { file: 'second.js', name: 'leaf', isDynamicEntry: true }
        },
        { label: 'leaf', name: 'leaf', isDynamicEntry: true }
      )
    ).toThrow(/first\.js[\s\S]*second\.js/)
  })
})
