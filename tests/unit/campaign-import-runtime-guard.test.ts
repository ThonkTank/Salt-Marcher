import { describe, expect, it, vi } from 'vitest'
import { openAuthorizedCampaignImportRuntime } from '../../src/core/campaign-import/campaign-import-runtime-guard.js'

const runtimeSha = 'a'.repeat(40)

describe('campaign import runtime guard', () => {
  it('rejects a mismatched deployment receipt before profile access', () => {
    const openProfile = vi.fn()
    expect(() =>
      openAuthorizedCampaignImportRuntime(
        { kind: 'deployment-receipt', deploymentSha: 'b'.repeat(40) },
        runtimeSha,
        openProfile
      )
    ).toThrow('does not match runtime')
    expect(openProfile).not.toHaveBeenCalled()
  })

  it('allows the installed Utility and an exact receipt deployment', () => {
    expect(
      openAuthorizedCampaignImportRuntime(
        { kind: 'installed-utility' },
        runtimeSha,
        () => 'utility'
      )
    ).toBe('utility')
    expect(
      openAuthorizedCampaignImportRuntime(
        { kind: 'deployment-receipt', deploymentSha: runtimeSha },
        runtimeSha,
        () => 'receipt'
      )
    ).toBe('receipt')
  })
})
