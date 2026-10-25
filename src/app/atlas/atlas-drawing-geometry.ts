import { atlasRouteGeometry } from './atlas-route-geometry';
import { ShapeGeometry, Vector3, BufferGeometry, Float32BufferAttribute, Color } from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { atlasSpatialPaths, atlasStrokeParts } from './atlas-spatial-geometry';
import { drapeAtlasGeometry, type AtlasSpatialSurface } from './atlas-spatial-surface';
import { atlasSpatialColor } from './atlas-spatial-color';
import { atlasWorkplaneHeight } from './atlas-workplane';
import { routeSegmentRange } from './terrain-route-clip';
import type { AtlasCanvasScene, AtlasPaintCommand } from './atlas-canvas-scene';
import type { Point } from '../shared/contracts';

export interface AtlasDrawingMesh {
  positions: Float32Array;
  indices: Uint32Array;
  uv?: Float32Array;
  colors?: Float32Array;
  color: [number, number, number, number];
  texture?: CanvasImageSource;
  hitAlpha?: { pixels: Uint8ClampedArray; width: number; height: number };
  command?: AtlasPaintCommand;
  target?: Record<string, string>;
  solid?: boolean;
  publicForestScale?: number;
  billboard?: { anchor: [number, number, number]; offsets: Float32Array };
}

/** CPU triangulation produces plain local-metre buffers, never a second scene graph. */
export function atlasDrawingGeometry(
  source: AtlasCanvasScene,
  origin: Point,
  images: ReadonlyMap<string, CanvasImageSource>,
  surface: AtlasSpatialSurface & { closedObjectIds?: ReadonlySet<string> },
) {
  const meshes: AtlasDrawingMesh[] = [],
    routes = new Set<string>();
  for (const c of source.commands) {
    if (
      c.hud ||
      c.ancestry.some(
        (n) =>
          n.data.spatialGround === 'true' ||
          n.data.landscapeRaster === 'true' ||
          n.data.vegetationInstance !== undefined,
      )
    )
      continue;
    if (
      c.node.kind !== 'text' &&
      c.ancestry.some((n) => surface.closedObjectIds?.has(n.data.cityUnit ?? ''))
    )
      continue;
    const routeOwner = c.ancestry.find((n) => surface.routes?.has(n.data.landscapeId ?? '')),
      route = routeOwner && surface.routes?.get(routeOwner.data.landscapeId!);
    if (route?.route && c.node.kind !== 'text') {
      if (!routes.has(route.id)) {
        routes.add(route.id);
        for (const mesh of atlasRouteGeometry(
          route,
          surface.height,
          { ...surface.origin, z: surface.focusM },
          1,
          surface.segment,
          false,
          surface.bounds,
          undefined,
          surface.displayMpp,
        ))
          meshes.push({
            ...mesh,
            color: [mesh.color[0], mesh.color[1], mesh.color[2], mesh.color[3] * c.alpha],
            command: c,
          });
      }
      continue;
    }
    const { node, style: s, matrix: m } = c,
      g = node.geometry;
    const world = (x: number, y: number) => ({
      x: m.a * x + m.c * y + m.e + origin.x,
      y: m.b * x + m.d * y + m.f + origin.y,
    });
    const object = c.ancestry.find((n) =>
      surface.objectHeights?.has(n.data.cityUnit ?? n.data.id ?? ''),
    );
    const scope = c.ancestry.find((n) => n.data.spatialScope !== undefined);
    const elevation = object
      ? surface.objectHeights!.get(object.data.cityUnit ?? object.data.id!)!
      : scope
        ? atlasWorkplaneHeight(
            {
              scopeId: scope.data.spatialScope!,
              elevationM: Number(scope.data.spatialFloor ?? 0),
              anchor: {
                x: Number(scope.data.spatialAnchorX ?? 0),
                y: Number(scope.data.spatialAnchorY ?? 0),
              },
            },
            surface,
          )
        : undefined;
    const position = (p: Point) =>
      new Vector3(
        p.x - surface.origin.x,
        p.y - surface.origin.y,
        (elevation ?? surface.height(p)) - surface.focusM,
      );
    const add = (
      geometry: BufferGeometry,
      color: string,
      alpha: number,
      texture?: CanvasImageSource,
      transform = world,
    ) => {
      const draped = drapeAtlasGeometry(geometry, transform, position, surface),
        p = draped.getAttribute('position'),
        uv = draped.getAttribute('uv');
      const rgba = atlasSpatialColor(color, alpha),
        rgb = new Color(rgba.color).convertLinearToSRGB();
      meshes.push({
        positions: Float32Array.from(p.array),
        indices: Uint32Array.from({ length: p.count }, (_, i) => i),
        uv: uv ? Float32Array.from(uv.array) : undefined,
        color: [rgb.r * 255, rgb.g * 255, rgb.b * 255, rgba.opacity * 255],
        texture,
        command: c,
        publicForestScale: Number(node.data.publicForestScale) || undefined,
      });
      draped.dispose();
    };
    const quad = (x: number, y: number, w: number, h: number) => {
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        'position',
        new Float32BufferAttribute(
          [x, y, 0, x + w, y, 0, x, y + h, 0, x + w, y, 0, x + w, y + h, 0, x, y + h, 0],
          3,
        ),
      );
      geometry.setAttribute(
        'uv',
        new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1], 2),
      );
      return geometry;
    };
    if (c.cuts?.length) {
      // Masks are bounded alpha textures; only this command is rasterized.
      const b = surface.bounds;
      if (!b) throw Error('Maskierter Ausschnitt fehlt.');
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = Math.max(1, Math.min(1024, Math.round((1024 * b.height) / b.width)));
      const ctx = canvas.getContext('2d')!;
      source.draw(
        ctx,
        new DOMMatrix()
          .scale(canvas.width / b.width, canvas.height / b.height)
          .translate(origin.x - b.x, origin.y - b.y),
        new Map(images),
        { x: 0, y: 0 },
        (command) => command === c,
      );
      add(quad(b.x, b.y, b.width, b.height), 'white', 1, canvas, (x, y) => ({ x, y }));
      meshes.at(-1)!.hitAlpha = {
        pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        width: canvas.width,
        height: canvas.height,
      };
      continue;
    }
    if (node.kind === 'image') {
      const image = images.get(g.source ?? '');
      if (image)
        add(quad(g.x ?? 0, g.y ?? 0, g.width ?? 0, g.height ?? 0), 'white', c.alpha, image);
      continue;
    }
    if (node.kind === 'text') {
      const font = s.fontSize ?? 16;
      if (!font || !node.text) continue;
      const scaleM = Math.hypot(m.a, m.b),
        pixelFont = surface.textPixelsPerMeter
          ? Math.max(8, Math.min(512, font * scaleM * surface.textPixelsPerMeter))
          : 48,
        padding = pixelFont / 6,
        baseline = (pixelFont * 7) / 6;
      const canvas = document.createElement('canvas'),
        ctx = canvas.getContext('2d')!;
      const css = `${s.fontWeight ?? 'normal'} ${pixelFont}px ${s.fontFamily ?? 'sans-serif'}`;
      ctx.font = css;
      canvas.width = Math.min(4096, Math.ceil(ctx.measureText(node.text).width + padding * 2));
      canvas.height = Math.ceil((pixelFont * 5) / 3);
      ctx.font = css;
      ctx.textBaseline = 'alphabetic';
      if (s.stroke) {
        ctx.strokeStyle = s.stroke;
        ctx.lineJoin = s.lineJoin ?? 'miter';
        ctx.lineWidth = ((s.lineWidth ?? 1) / font) * pixelFont;
        ctx.globalAlpha = s.strokeOpacity ?? 1;
        ctx.strokeText(node.text, padding, baseline);
      }
      if (s.fill) {
        ctx.fillStyle = s.fill;
        ctx.globalAlpha = s.fillOpacity ?? 1;
        ctx.fillText(node.text, padding, baseline);
      }
      const scale = font / pixelFont,
        w = canvas.width * scale,
        h = canvas.height * scale;
      const left =
        s.textAlign === 'center'
          ? w / 2
          : s.textAlign === 'right' || s.textAlign === 'end'
            ? w
            : padding * scale;
      const top =
        s.textBaseline === 'middle'
          ? h / 2
          : s.textBaseline === 'top' || s.textBaseline === 'hanging'
            ? 0
            : baseline * scale;
      const anchor = position(world(g.x ?? 0, g.y ?? 0));
      const geometry = quad(-left, -top, w, h),
        offsets = Float32Array.from(geometry.getAttribute('position').array, (v) => v * scaleM);
      meshes.push({
        positions: new Float32Array(offsets.length),
        indices: Uint32Array.from({ length: 6 }, (_, i) => i),
        uv: Float32Array.from(geometry.getAttribute('uv').array),
        color: [255, 255, 255, c.alpha * 255],
        texture: canvas,
        command: c,
        billboard: { anchor: [anchor.x, anchor.y, anchor.z], offsets },
      });
      geometry.dispose();
      continue;
    }
    const paths = atlasSpatialPaths(node);
    if (s.fill && paths.shapes.length)
      add(new ShapeGeometry(paths.shapes, 12), s.fill, c.alpha * (s.fillOpacity ?? 1));
    if (s.stroke && (s.lineWidth ?? 1) > 0) {
      const margin = (s.lineWidth ?? 1) * Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d)) * 4,
        b = surface.bounds;
      const coverage = b
        ? {
            x: b.x - margin,
            y: b.y - margin,
            width: b.width + 2 * margin,
            height: b.height + 2 * margin,
          }
        : undefined;
      const window = coverage
        ? (a: Point, b: Point) => routeSegmentRange(world(a.x, a.y), world(b.x, b.y), coverage)
        : undefined;
      for (const line of paths.lines)
        for (const part of atlasStrokeParts(line, s.lineDash, s.lineDashOffset, window)) {
          if (part.length < 2) continue;
          const geometry = SVGLoader.pointsToStroke(
            part,
            SVGLoader.getStrokeStyle(
              s.lineWidth ?? 1,
              s.stroke,
              s.lineJoin ?? 'miter',
              s.lineCap ?? 'butt',
            ),
            8,
            0,
          );
          if (geometry) add(geometry, s.stroke, c.alpha * (s.strokeOpacity ?? 1));
        }
    }
  }
  return meshes;
}
