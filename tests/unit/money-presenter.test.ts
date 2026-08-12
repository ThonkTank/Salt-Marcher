import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatCopper } from '../../src/renderer/presenters/money.js'

describe('renderer Money presenter', () => {
  it('formats copper identically for whole and fractional gold marks', () => {
    expect(formatCopper(0)).toBe('0 GM')
    expect(formatCopper(1)).toBe('0,01 GM')
    expect(formatCopper(105)).toBe('1,05 GM')
    expect(formatCopper(12_300)).toBe('123 GM')
  })

  it('is shared by Planner, Session Loot, Distribution, and Ledger views', () => {
    for (const path of [
      'src/renderer/features/session-planner/scene-inspector.tsx',
      'src/renderer/features/loot/loot-treasure-card.tsx',
      'src/renderer/features/loot/reward-distribution-dialog.tsx',
      'src/renderer/features/loot/character-loot-ledger-dialog.tsx'
    ]) {
      const content = readFileSync(join(process.cwd(), path), 'utf8')
      expect(content, path).toContain("presenters/money.js'")
      expect(content, path).toContain('formatCopper(')
    }
  })
})
