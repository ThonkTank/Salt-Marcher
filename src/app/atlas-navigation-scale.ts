import type { CanvasBox } from './passive-map-canvas';
import { hexSize, formatDistance } from './atlas-landscape';

export const travelHexSizes = [
  { id: 'hour', label: '1 Stunde', miles: 3 },
  { id: 'day', label: '1 Tag', miles: 24 },
  { id: 'week', label: '1 Woche', miles: 168 },
  { id: 'month', label: '1 Monat', miles: 720 },
  { id: 'quarter', label: '3 Monate', miles: 2160 },
  { id: 'year', label: '12 Monate', miles: 8640 },
].map(p => ({ ...p, meters: p.miles * 1609.344 }));

/** Numeric levels are historical coordinates, never reinterpret them as travel presets. */
export function gridMeters(id: string | number): number {
  const preset = travelHexSizes.find(p => p.id === id);
  if (preset) return preset.meters;
  const level = Number(id);
  if (Number.isInteger(level) && level >= 0 && level <= 10) return hexSize(level);
  throw Error('Unbekannte Hexgröße.');
}
export const distanceLabel = formatDistance;
export function scaleBar(metersPerPixel: number, viewportWidth: number) {
  const pixels = Math.min(160, viewportWidth / 3);
  return { pixels, meters: pixels * metersPerPixel, label: distanceLabel(pixels * metersPerPixel) };
}
export function automaticGrid(mpp: number, previous: string | null): string {
  // Log distance treats zooming in and out symmetrically. Hysteresis retains
  // the selected size until the neighbouring size is noticeably more legible.
  const score = (meters: number) => Math.abs(Math.log(meters / mpp / 100));
  const best = travelHexSizes.reduce((a, b) => score(a.meters) <= score(b.meters) ? a : b);
  const old = travelHexSizes.find(p => p.id === previous);
  return old && score(old.meters) <= score(best.meters) + Math.log(1.35) ? old.id : best.id;
}
export function wheelZoomFactor(delta: number, mode: number, height: number): number {
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? height : 1);
  return Math.exp(Math.max(-1.2, Math.min(1.2, pixels * 0.002)));
}
export function zoomBox(box: CanvasBox, width: number, anchor: {x:number;y:number}): CanvasBox {
  const ratio = width / box.width;
  return {x: anchor.x - (anchor.x-box.x)*ratio, y: anchor.y-(anchor.y-box.y)*ratio, width, height:box.height*ratio};
}
export function fitReference(box: CanvasBox, aspect: number, padding = 1.1): CanvasBox {
  const width = Math.max(box.width, box.height * aspect) * padding;
  const height = width / aspect;
  return {x:box.x+(box.width-width)/2,y:box.y+(box.height-height)/2,width,height};
}
