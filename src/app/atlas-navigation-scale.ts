import {
  atlasNumberLabel,
  atlasUnits,
  FOOT,
  MILE,
  lengthLabel,
  type AtlasUnits,
} from './atlas-units';
import type { CanvasBox } from './passive-map-canvas';
import { hexSize } from './atlas-landscape';

export const travelHexSizes = [
  { id: 'hour', label: '1 Stunde', miles: 3 },
  { id: 'day', label: '1 Tag', miles: 24 },
  { id: 'week', label: '1 Woche', miles: 168 },
  { id: 'month', label: '1 Monat', miles: 720 },
  { id: 'quarter', label: '3 Monate', miles: 2160 },
  { id: 'year', label: '12 Monate', miles: 8640 },
].map((p) => ({ ...p, meters: p.miles * 1609.344 }));

/** Numeric levels are historical coordinates, never reinterpret them as travel presets. */
export function gridMeters(id: string | number): number {
  const preset = travelHexSizes.find((p) => p.id === id);
  if (preset) return preset.meters;
  const level = Number(id);
  if (Number.isInteger(level) && level >= 0 && level <= 10) return hexSize(level);
  throw Error('Unbekannte Hexgröße.');
}
export const distanceLabel = lengthLabel;
export function scaleBar(
  metersPerPixel: number,
  viewportWidth: number,
  system: AtlasUnits = atlasUnits(),
) {
  const maxPixels = Math.min(160, viewportWidth / 3),
    maxMeters = maxPixels * metersPerPixel;
  const base = system === 'dnd' ? (maxMeters >= MILE ? MILE : FOOT) : maxMeters >= 1000 ? 1000 : 1;
  const value = maxMeters / base,
    power = 10 ** Math.floor(Math.log10(value));
  const nice = ([5, 2, 1].find((n) => n * power <= value) ?? 1) * power;
  const meters = nice * base;
  return { pixels: meters / metersPerPixel, meters, label: lengthLabel(meters, system) };
}
export function hexTravelLabel(meters: number) {
  const hours = meters / MILE / 3,
    days = hours / 8;
  if (hours < 8) return `${atlasNumberLabel(hours)} ${hours === 1 ? 'Stunde' : 'Stunden'}`;
  if (days >= 30 - 1e-8 && Math.abs(days / 30 - Math.round(days / 30)) < 1e-8)
    return `${atlasNumberLabel(days / 30)} ${Math.round(days / 30) === 1 ? 'Monat' : 'Monate'}`;
  if (days >= 7 - 1e-8 && Math.abs(days / 7 - Math.round(days / 7)) < 1e-8)
    return `${atlasNumberLabel(days / 7)} ${Math.round(days / 7) === 1 ? 'Woche' : 'Wochen'}`;
  return `${atlasNumberLabel(days)} ${Math.abs(days - 1) < 1e-8 ? 'Reisetag' : 'Reisetage'}`;
}
export function automaticGrid(mpp: number, previous: string | null): string {
  // Log distance treats zooming in and out symmetrically. Hysteresis retains
  // the selected size until the neighbouring size is noticeably more legible.
  const score = (meters: number) => Math.abs(Math.log(meters / mpp / 100));
  const best = travelHexSizes.reduce((a, b) => (score(a.meters) <= score(b.meters) ? a : b));
  const old = travelHexSizes.find((p) => p.id === previous);
  return old && score(old.meters) <= score(best.meters) + Math.log(1.35) ? old.id : best.id;
}
export function wheelZoomFactor(delta: number, mode: number, height: number): number {
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? height : 1);
  return Math.exp(Math.max(-1.2, Math.min(1.2, pixels * 0.002)));
}
export function zoomBox(
  box: CanvasBox,
  width: number,
  anchor: { x: number; y: number },
): CanvasBox {
  const ratio = width / box.width;
  return {
    x: anchor.x - (anchor.x - box.x) * ratio,
    y: anchor.y - (anchor.y - box.y) * ratio,
    width,
    height: box.height * ratio,
  };
}
export function fitReference(box: CanvasBox, aspect: number, padding = 1.1): CanvasBox {
  const width = Math.max(box.width, box.height * aspect) * padding;
  const height = width / aspect;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}
