import { readFileSync } from 'node:fs'
import { describe, expect } from 'vitest'
import { legitimateLiteralGate } from '../architecture/support/architecture-gate.js'

describe('session style ownership', () => {
  styleGate(
    'uses the theme-specific contrast token for primary hover states',
    'src/renderer/shell/tokens.css',
    () => {
      const tokens = file('src/renderer/shell/tokens.css')
      const scenario = file(
        'src/renderer/features/session/session-scenario-panel.css'
      )
      const travel = file('src/renderer/features/hex/hex-travel.css')
      expect(tokens.match(/--text-on-accent-line:/g)).toHaveLength(2)
      expect(scenario).toContain('color: var(--text-on-accent-line)')
      expect(travel).toContain('color: var(--text-on-accent-line)')
    }
  )
  styleGate(
    'keeps workspace CSS limited to layout composition',
    'src/renderer/features/session/session-workspace.css',
    () => {
      const workspace = css('session-workspace.css')
      expect(workspace).toContain('@scope (.session-mockup)')
      expect(workspace).not.toMatch(/\.group-dialog|\.monster-picker/)
      expect(workspace).not.toMatch(/^\s*(?:select|progress|\.muted)\s*\{/m)
    }
  )

  styleGate(
    'keeps control, group, dialog, and encounter rules with their owners',
    'src/renderer/features/session/session-control-panel.css',
    () => {
      expect(css('session-control-panel.css')).not.toContain('.session-groups')
      expect(css('session-groups-panel.css')).toContain('.groups-heading')
      expect(css('session-dialogs.css')).toContain('.monster-picker')
      expect(
        readFileSync('src/renderer/features/encounter/encounter.css', 'utf8')
      ).toContain('@scope (.session-mockup)')
      expect(
        readFileSync('src/renderer/features/loot/loot-dialogs.css', 'utf8')
      ).not.toContain('.session-group-manager')
    }
  )
})

function css(name: string): string {
  return file(`src/renderer/features/session/${name}`)
}

function file(path: string): string {
  return readFileSync(path, 'utf8')
}

function styleGate(name: string, path: string, inspect: () => void): void {
  legitimateLiteralGate({
    name,
    path,
    owner: 'session-style-ownership',
    rationale:
      'CSS token and selector ownership are stylesheet literal constraints outside the TypeScript semantic graph.',
    inspect
  })
}
