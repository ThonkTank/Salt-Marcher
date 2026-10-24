import {COORDINATE_SYSTEM} from '@deck.gl/core';
import {TextLayer} from '@deck.gl/layers';
import {MapLabelLayout, type PlacedMapLabel} from './atlas-cartography';
import type {MapLabelCandidate} from './atlas-label-source';
import {ATLAS_FONT_FAMILY} from './atlas-assets';
import type {atlasMetricFrame} from './atlas-metric-camera';

type Frame = ReturnType<typeof atlasMetricFrame>;
export interface AtlasDeckLabel {candidate: MapLabelCandidate; heightM: number}
export interface AtlasDeckLabelPlacement {label: AtlasDeckLabel; placed: PlacedMapLabel; anchor: {x: number; y: number}; depthFactor: number}

/** Renderer-independent placement remains the same screen-space rectangle
 * policy used by Atlas cartography. Export uses this method at its full image
 * dimensions, not independently per output tile. */
export class AtlasDeckLabels {
  private readonly layout = new MapLabelLayout();
  private readonly widths = new Map<string, number>();
  constructor(private readonly measure: (text: string, size: number) => number) {}
  place(frame: Frame, labels: readonly AtlasDeckLabel[], selected?: string): AtlasDeckLabelPlacement[] {
    const byId = new Map(labels.map(label => [label.candidate.id, label]));
    const anchors = new Map<string, {x: number; y: number; depthM: number}>();
    const placed = this.layout.layout(labels.map(label => label.candidate),
      {x: 0, y: 0, width: frame.viewport.width, height: frame.viewport.height}, 1,
      (text, size) => {
        const key = `${size}:${text}`;
        let width = this.widths.get(key);
        if (width === undefined) { width = this.measure(text, size); if (this.widths.size > 4096) this.widths.clear(); this.widths.set(key, width); }
        return width;
      }, selected, false, candidate => {
        const heightM = byId.get(candidate.id)!.heightM;
        const point = frame.project({...candidate.point, heightM});
        if (!point.visible || !Number.isFinite(point.x + point.y)) return null;
        const angle = candidate.angle ?? 0, step = frame.camera.metersPerPixel;
        const next = frame.project({x: candidate.point.x + Math.cos(angle) * step,
          y: candidate.point.y + Math.sin(angle) * step, heightM});
        const pixels = Math.hypot(next.x - point.x, next.y - point.y);
        if (pixels <= 0 || !Number.isFinite(pixels)) return null;
        anchors.set(candidate.id, point);
        return {point, mpp: step / pixels, angle: candidate.angle === undefined ? 0 : Math.atan2(next.y - point.y, next.x - point.x)};
      });
    return placed.map(placed => {
      const anchor = anchors.get(placed.candidate.id)!;
      // Deck billboards use focalDistance / clip.w. Cancel that perspective
      // factor so glyph size and screen offsets match the collision rectangles.
      return {label: byId.get(placed.candidate.id)!, placed, anchor,
        depthFactor: anchor.depthM / frame.viewport.focalDistance};
    });
  }
  layer(frame: Frame, labels: readonly AtlasDeckLabel[], selected?: string): TextLayer<AtlasDeckLabelPlacement> {
    return new TextLayer<AtlasDeckLabelPlacement>({id: 'atlas-labels', data: this.place(frame, labels, selected),
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN, fontFamily: ATLAS_FONT_FAMILY,
      characterSet: 'auto', fontSettings: {sdf: true}, getText: d => d.label.candidate.text,
      getPosition: d => [d.label.candidate.point.x - frame.origin.x, d.label.candidate.point.y - frame.origin.y,
        (d.label.heightM - frame.origin.z) * frame.camera.exaggeration],
      getPixelOffset: d => [(d.placed.point.x - d.anchor.x) * d.depthFactor, (d.placed.point.y - d.anchor.y) * d.depthFactor],
      getSize: d => d.placed.font * d.depthFactor, sizeUnits: 'pixels', getAngle: d => -(d.placed.angle ?? 0) * 180 / Math.PI,
      getColor: d => [36, 40, 34, Math.round(255 * (d.placed.opacity ?? 1))],
      getTextAnchor: 'middle', getAlignmentBaseline: 'center', pickable: false,
      parameters: {depthWriteEnabled: false, depthCompare: 'always'}});
  }
}

export function createAtlasDeckLabels(document: Document): AtlasDeckLabels {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) throw new Error('Atlas labels need text measurement');
  return new AtlasDeckLabels((text, size) => {
    context.font = `${size}px "${ATLAS_FONT_FAMILY}"`; return context.measureText(text).width;
  });
}
