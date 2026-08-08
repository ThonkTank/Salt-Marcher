import { describe, expect, it } from 'vitest'
import { parseLocationSymbolSource } from '../../src/core/worldplanner/location-symbol-import.js'

describe('location symbol SVG import', () => {
  it('extracts one path without retaining the SVG document', () => {
    expect(
      parseLocationSymbolSource(
        '<svg viewBox="0 0 24 24"><path fill="red" d="M2 2 L22 22 Z"/></svg>',
        'Klinge'
      )
    ).toEqual({
      displayName: 'Klinge',
      viewBox: { minX: 0, minY: 0, width: 24, height: 24 },
      pathData: 'M2 2 L22 22 Z',
      fillRule: 'nonzero'
    })
  })

  it('rejects multiple paths and active or unsupported SVG elements', () => {
    expect(() =>
      parseLocationSymbolSource(
        '<svg viewBox="0 0 24 24"><path d="M0 0Z"/><path d="M1 1Z"/></svg>',
        'Doppelt'
      )
    ).toThrow('validation_failed')
    expect(() =>
      parseLocationSymbolSource(
        '<svg viewBox="0 0 24 24"><script>alert(1)</script><path d="M0 0Z"/></svg>',
        'Aktiv'
      )
    ).toThrow('unsupported_svg')
    expect(() =>
      parseLocationSymbolSource(
        '<svg viewBox="0 0 24 24"><path onclick="alert(1)" d="M0 0Z"/></svg>',
        'Handler'
      )
    ).toThrow('validation_failed')
    expect(() =>
      parseLocationSymbolSource(
        '<svg viewBox="0 0 24 24"><path transform="scale(2)" d="M0 0Z"/></svg>',
        'Transformiert'
      )
    ).toThrow('unsupported_svg')
    expect(() =>
      parseLocationSymbolSource(
        '<!DOCTYPE svg [<!ENTITY x "M0 0Z">]><svg viewBox="0 0 24 24"><path d="&x;"/></svg>',
        'Entität'
      )
    ).toThrow('unsupported_svg')
  })

  it('preserves the supported fill rule and rejects excessive path commands', () => {
    expect(
      parseLocationSymbolSource(
        '<svg viewBox="-2 -3 20 30"><path fill-rule="evenodd" d="M0 0L10 0L10 10Z"/></svg>',
        'Ring'
      )
    ).toMatchObject({
      viewBox: { minX: -2, minY: -3, width: 20, height: 30 },
      fillRule: 'evenodd'
    })
    expect(() =>
      parseLocationSymbolSource(
        `<svg viewBox="0 0 10 10"><path d="${'M0 0'.repeat(4_097)}"/></svg>`,
        'Zu groß'
      )
    ).toThrow('validation_failed')
  })
})
