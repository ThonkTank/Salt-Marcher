import type { MarkerPresentation } from '../runtime/world-contracts';

/** The same immutable built-ins feed the picker, validator and SVG renderer. */
export const markerSymbols = Object.freeze([
  Object.freeze({
    id: 'pin',
    name: 'Ortsmarke',
    path: 'M0 -15 A10 10 0 0 1 10 -5 Q10 3 0 16 Q-10 3 -10 -5 A10 10 0 0 1 0 -15 Z M-3 -6 A3 3 0 1 0 3 -6 A3 3 0 1 0 -3 -6',
  }),
  Object.freeze({
    id: 'town',
    name: 'Siedlung',
    path: 'M-16 0 L-8 -9 L0 0 V14 H-16 Z M0 -4 L8 -13 L16 -4 V14 H0 Z M-10 14 V6 H-5 V14 M5 14 V4 H11 V14',
  }),
  Object.freeze({
    id: 'castle',
    name: 'Burg',
    path: 'M-15 14 V-12 H-10 V-5 H-5 V-12 H0 V-5 H5 V-12 H10 V-5 H15 V14 Z M-4 14 V4 A4 4 0 0 1 4 4 V14',
  }),
  Object.freeze({
    id: 'ruin',
    name: 'Ruine',
    path: 'M-15 14 V-10 H-6 V-4 H-1 V3 H5 V-13 H13 V14 Z M-8 14 V7 H-3 V14',
  }),
  Object.freeze({
    id: 'cave',
    name: 'Höhle',
    path: 'M-18 14 L-11 -5 L-3 -15 L7 -10 L18 14 Z M-8 14 V5 Q0 -8 8 5 V14 Z',
  }),
  Object.freeze({
    id: 'temple',
    name: 'Tempel',
    path: 'M-16 -5 L0 -16 L16 -5 Z M-12 -4 V12 M-4 -4 V12 M4 -4 V12 M12 -4 V12 M-17 14 H17',
  }),
  Object.freeze({
    id: 'camp',
    name: 'Lager',
    path: 'M-18 14 L0 -14 L18 14 Z M0 -14 V14 M-8 14 L0 0 L8 14',
  }),
  Object.freeze({
    id: 'port',
    name: 'Hafen',
    path: 'M0 -12 V15 M-5 -9 A5 5 0 1 0 5 -9 A5 5 0 1 0 -5 -9 M-16 3 Q-16 15 0 15 Q16 15 16 3 M-16 3 L-20 8 M16 3 L20 8',
  }),
]);
export const defaultMarkerPresentation: Readonly<MarkerPresentation> = Object.freeze({
  title: '',
  symbol: 'pin',
  size: 1,
  labelPosition: 'above',
  curve: 0,
});
export function checkedMarkerPresentation(raw: unknown): MarkerPresentation {
  const value = raw as MarkerPresentation;
  if (
    !value ||
    typeof value.title !== 'string' ||
    value.title.length > 200 ||
    !markerSymbols.some((s) => s.id === value.symbol) ||
    !Number.isFinite(value.size) ||
    value.size < 0.5 ||
    value.size > 3 ||
    !['above', 'below', 'right', 'hidden'].includes(value.labelPosition) ||
    !Number.isFinite(value.curve) ||
    Math.abs(value.curve) > 1
  )
    throw new Error('Ungültige Ortsmarke: Titel, Symbol, Größe oder Beschriftung prüfen.');
  return {
    title: value.title,
    symbol: value.symbol,
    size: value.size,
    labelPosition: value.labelPosition,
    curve: value.curve,
  };
}
