import type { MapLabelSource } from './atlas-label-source';
import type { Polygon } from '../contracts';
/** Local drawing data shared by the Canvas screen and raster exports. */
export type Affine = [number, number, number, number, number, number];
export type PaintKind =
  | 'group'
  | 'path'
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'polygons'
  | 'polygon'
  | 'polyline'
  | 'text'
  | 'image';
export interface PaintStyle {
  fill?: string | null;
  stroke?: string | null;
  lineWidth?: number;
  fillRule?: CanvasFillRule;
  lineCap?: CanvasLineCap;
  lineJoin?: CanvasLineJoin;
  lineDash?: number[];
  lineDashOffset?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  textAlign?: CanvasTextAlign;
  textBaseline?: CanvasTextBaseline;
  fillOpacity?: number;
  strokeOpacity?: number;
}
export interface PaintOptions {
  /** Immutable local geometry: share compiled paths across scene publications. */
  retainGeometry?: boolean;
  x?: number;
  y?: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  radius?: number;
  radiusX?: number;
  radiusY?: number;
  /** Authored symbol path literals; generated contours stay numeric. */
  path?: string;
  polygons?: Polygon[];
  points?: { x: number; y: number }[];
  source?: string;
  optionalImage?: boolean;
  matrix?: Affine;
  opacity?: number;
  pointer?: boolean;
  hidden?: boolean;
  hud?: boolean;
  maskCuts?: { polygons: Polygon[]; alpha: number }[];
  size?: { width: number; height: number };
  style?: PaintStyle;
  data?: Record<string, string>;
  title?: string;
}
export class AtlasPaint {
  readonly children: AtlasPaint[] = [];
  mapLabels?: MapLabelSource;
  /** Same world grid for vector consumers and the terrain shader. */
  mapGrid?: { size: number };
  readonly style: PaintStyle;
  readonly data: Record<string, string>;
  title: string;
  constructor(
    readonly kind: PaintKind,
    readonly geometry: PaintOptions = {},
    public text = '',
  ) {
    this.style = geometry.style ?? {};
    this.data = geometry.data ?? {};
    this.title = geometry.title ?? '';
  }
  append(...nodes: AtlasPaint[]) {
    this.children.push(...nodes);
  }
}
export const atlasPaint = (kind: PaintKind, options: PaintOptions = {}, text = '') =>
  new AtlasPaint(kind, options, text);
export function rotation(angle: number, x = 0, y = 0): Affine {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return [c, s, -s, c, x - x * c + y * s, y - x * s - y * c];
}
