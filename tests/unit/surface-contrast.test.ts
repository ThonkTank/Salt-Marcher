import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  rubricSurfacePairs
} from '../../src/renderer/shell/surface-contrast.js'
import { legitimateLiteralGate } from '../architecture/support/architecture-gate.js'

describe('surface-specific rubric colors', () => {
  it('meet WCAG AA on control, card and sunken surfaces in both themes', () => {
    for (const pairs of Object.values(rubricSurfacePairs))
      for (const [foreground, background] of pairs)
        expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(
          4.5
        )
  })

  legitimateLiteralGate({
    name: 'keeps the verified colors in the renderer token source',
    path: 'src/renderer/shell/tokens.css',
    owner: 'renderer-surface-contrast',
    rationale:
      'Verified theme colors and CSS custom-property names are stylesheet literal contracts.',
    inspect: (css) => {
      for (const pairs of Object.values(rubricSurfacePairs))
        for (const [foreground] of pairs) expect(css).toContain(foreground)
      expect(css).toContain('--text-rubric-on-control')
      expect(css).toContain('--text-rubric-on-card')
      expect(css).toContain('--text-rubric-on-sunken')
    }
  })

  legitimateLiteralGate({
    name: 'applies each rubric token on its matching editor surface',
    path: 'src/renderer/shell/editor-dialog-frame.css',
    owner: 'renderer-editor-surfaces',
    rationale:
      'The mapping from semantic rubric tokens to owning CSS surfaces is a stylesheet literal boundary.',
    inspect: () => {
      const editorCss = [
        'src/renderer/shell/editor-dialog-frame.css',
        'src/renderer/features/worldplanner/world-location-dialog.css',
        'src/renderer/features/worldplanner/world-faction-dialog.css',
        'src/renderer/features/creature-collection/creature-collection.css'
      ]
        .map((path) => readFileSync(path, 'utf8'))
        .join('\n')
      expect(editorCss).toContain('var(--text-rubric-on-control)')
      expect(editorCss).toContain('var(--text-rubric-on-card)')
      expect(editorCss).toContain('var(--text-rubric-on-sunken)')
    }
  })
})
