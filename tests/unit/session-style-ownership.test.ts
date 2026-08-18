import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('session style ownership', () => {
  it('keeps workspace CSS limited to layout composition', () => {
    const workspace = css('session-workspace.css')
    expect(workspace).toContain('@scope (.session-mockup)')
    expect(workspace).not.toMatch(/\.group-dialog|\.monster-picker/)
    expect(workspace).not.toMatch(/^\s*(?:select|progress|\.muted)\s*\{/m)
  })

  it('keeps control, group, dialog, and encounter rules with their owners', () => {
    expect(css('session-control-panel.css')).not.toContain('.session-groups')
    expect(css('session-groups-panel.css')).toContain('.groups-heading')
    expect(css('session-dialogs.css')).toContain('.monster-picker')
    expect(
      readFileSync('src/renderer/features/encounter/encounter.css', 'utf8')
    ).toContain('@scope (.session-mockup)')
    expect(
      readFileSync('src/renderer/features/loot/loot-dialogs.css', 'utf8')
    ).not.toContain('.session-group-manager')
  })
})

function css(name: string): string {
  return readFileSync(`src/renderer/features/session/${name}`, 'utf8')
}
