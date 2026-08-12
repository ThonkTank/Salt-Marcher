import campSvg from '../../assets/symbols/camp.svg?raw'
import campaignSvg from '../../assets/symbols/campaign.svg?raw'
import compassSvg from '../../assets/symbols/compass.svg?raw'
import creatureSvg from '../../assets/symbols/creature.svg?raw'
import gateSvg from '../../assets/symbols/gate.svg?raw'
import locationSvg from '../../assets/symbols/location.svg?raw'
import partySvg from '../../assets/symbols/party.svg?raw'
import treasureSvg from '../../assets/symbols/treasure.svg?raw'
import type {
  BuiltinLocationSymbolId,
  LocationSymbol,
  LocationSymbolDraft
} from '../../../shared/contracts/location-symbol.js'
import { builtinLocationSymbolCatalog } from '../../../shared/values/location-symbol-values.js'

export type LocationSymbolViewBox = LocationSymbol['viewBox']

export type RenderLocationSymbol = Readonly<{
  id: string
  displayName: string
  viewBox: LocationSymbol['viewBox']
  pathData: string
  fillRule: 'nonzero' | 'evenodd'
}>

const sourceById: Readonly<Record<BuiltinLocationSymbolId, string>> = {
  location: locationSvg,
  settlement: campaignSvg,
  gate: gateSvg,
  lair: creatureSvg,
  camp: campSvg,
  landmark: compassSvg,
  treasure: treasureSvg,
  party: partySvg
}

export const builtinLocationSymbols: readonly RenderLocationSymbol[] =
  builtinLocationSymbolCatalog.map(({ id, displayName }) => ({
    id,
    ...parseLocationSymbolSvg(sourceById[id], displayName),
    fillRule: 'nonzero'
  }))

export function allLocationSymbols(
  custom: readonly LocationSymbol[]
): readonly RenderLocationSymbol[] {
  return [...builtinLocationSymbols, ...custom]
}

export function parseLocationSymbolSvg(
  source: string,
  displayName: string
): LocationSymbolDraft {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml')
  if (document.querySelector('parsererror')) throw new Error('Ungültiges SVG')
  const root = document.documentElement
  if (root.localName !== 'svg') throw new Error('Keine SVG-Datei')
  const allowed = new Set(['svg', 'path', 'title', 'desc'])
  if (
    [...root.querySelectorAll('*')].some((node) => !allowed.has(node.localName))
  )
    throw new Error('Das SVG enthält nicht unterstützte Elemente')
  const paths = root.querySelectorAll('path')
  if (paths.length !== 1)
    throw new Error('Das SVG muss genau einen Pfad enthalten')
  const values = (root.getAttribute('viewBox') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value)))
    throw new Error('Das SVG benötigt eine gültige ViewBox')
  const [minX, minY, width, height] = values as [number, number, number, number]
  const name = displayName.trim()
  const pathData = (paths[0]!.getAttribute('d') ?? '').trim()
  const fillRule = paths[0]!.getAttribute('fill-rule') ?? 'nonzero'
  if (
    name.length < 1 ||
    name.length > 100 ||
    width <= 0 ||
    width > 1_000_000 ||
    height <= 0 ||
    height > 1_000_000 ||
    pathData.length < 1 ||
    pathData.length > 200_000 ||
    !/^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/.test(pathData) ||
    (fillRule !== 'nonzero' && fillRule !== 'evenodd')
  )
    throw new Error('Das SVG enthält ungültige Symboldaten')
  return {
    displayName: name,
    viewBox: { minX, minY, width, height },
    pathData,
    fillRule
  }
}
