export const builtinLocationSymbolCatalog = Object.freeze(
  [
    { id: 'location', displayName: 'Ort' },
    { id: 'settlement', displayName: 'Siedlung' },
    { id: 'gate', displayName: 'Tor' },
    { id: 'lair', displayName: 'Bau' },
    { id: 'camp', displayName: 'Lager' },
    { id: 'landmark', displayName: 'Wegmarke' },
    { id: 'treasure', displayName: 'Schatz' },
    { id: 'party', displayName: 'Gruppe' }
  ].map((entry) => Object.freeze(entry))
) as readonly Readonly<{
  id:
    | 'location'
    | 'settlement'
    | 'gate'
    | 'lair'
    | 'camp'
    | 'landmark'
    | 'treasure'
    | 'party'
  displayName: string
}>[]

export const builtinLocationSymbolIds = [
  'location',
  'settlement',
  'gate',
  'lair',
  'camp',
  'landmark',
  'treasure',
  'party'
] as const

export type BuiltinLocationSymbolId = (typeof builtinLocationSymbolIds)[number]
