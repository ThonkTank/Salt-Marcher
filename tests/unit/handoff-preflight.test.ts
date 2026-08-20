import { describe, expect, it } from 'vitest'
import { assertHandoffResourcePreflight } from '../../scripts/handoff-preflight.js'

describe('handoff resource preflight', () => {
  it('accepts capacity for build output plus two campaign-data copies', () => {
    expect(() =>
      assertHandoffResourcePreflight({
        workspaceAvailableBytes: 2 * 1024 ** 3,
        installationAvailableBytes: 3 * 1024 ** 3,
        campaignDataBytes: 1024 ** 3
      })
    ).not.toThrow()
  })

  it('fails before material state when workspace capacity is insufficient', () => {
    expect(() =>
      assertHandoffResourcePreflight({
        workspaceAvailableBytes: 512 * 1024 ** 2 - 1,
        installationAvailableBytes: 4 * 1024 ** 3,
        campaignDataBytes: 0
      })
    ).toThrow(/workspace preflight/)
  })

  it('fails before material state when backup capacity is insufficient', () => {
    expect(() =>
      assertHandoffResourcePreflight({
        workspaceAvailableBytes: 2 * 1024 ** 3,
        installationAvailableBytes: 2 * 1024 ** 3,
        campaignDataBytes: 1024 ** 3
      })
    ).toThrow(/installation preflight/)
  })
})
