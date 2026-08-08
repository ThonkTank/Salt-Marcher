import { describe, expect, it } from 'vitest'
import {
  endpointSchemas,
  monsterSourceSchema
} from '../../scripts/reference-compiler/source-schemas.js'
import { compileCreatureActions } from '../../scripts/reference-compiler/creature-parts.js'

describe('pinned reference compiler contracts', () => {
  it('rejects source rows that no longer match their pinned endpoint schema', () => {
    expect(() =>
      endpointSchemas.spells.parse({ index: 'light', name: 'Light' })
    ).toThrow()
    expect(() =>
      monsterSourceSchema.parse({ index: 'wolf', name: 'Wolf' })
    ).toThrow()
  })

  it('requires explicit stable-ID overrides for colliding creature parts', () => {
    const rows = [
      { name: 'Bite', desc: 'First' },
      { name: 'Bite', desc: 'Second' }
    ]
    expect(() =>
      compileCreatureActions('wolf', 'action', rows, {}, new Set())
    ).toThrow('wolf:action:bite:1')

    const used = new Set<string>()
    expect(
      compileCreatureActions(
        'wolf',
        'action',
        rows,
        {
          'wolf:action:bite:1': 'bite-primary',
          'wolf:action:bite:2': 'bite-secondary'
        },
        used
      ).map((action) => action.id)
    ).toEqual(['bite-primary', 'bite-secondary'])
    expect([...used]).toHaveLength(2)
  })
})
