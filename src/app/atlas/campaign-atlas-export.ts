import { atlasUnits, type AtlasUnits } from './atlas-units';
import { AtlasPaint, atlasPaint } from './atlas-paint';
import { AtlasCanvasScene } from './atlas-canvas-scene';
import { drawScale } from './atlas-landscape-view';
import type { AtlasRenderView } from './campaign-atlas-contracts';
import type { CanvasBox } from '../runtime/passive-map-canvas';
import type { PlayerFrame } from '../runtime/player-contracts';
import { atlasFrame, frameMatrix, atlasHexPoint, localToAtlas } from './campaign-atlas-model';
import { regionValue } from './atlas-region-contracts';
import { terrainColors } from '../runtime/world-model';
/** Full current-floor bounds come from the source index, including offscreen rooms. */
export function dungeonExportBox(
  a: AtlasRenderView,
  scopeId: string | null,
  floorId: string,
  scale = false,
  size = 2048,
): CanvasBox | null {
  if (!scopeId || a.region?.scopeId !== scopeId || a.region.floorId !== floorId) return null;
  const b = regionValue(a.region.scopeBounds, scopeId),
    binding = a.bindings.find((b) => b.kind === 'dungeon' && b.ownerId === scopeId);
  if (
    !b ||
    !binding ||
    ![b.x, b.y, b.width, b.height].every(Number.isFinite) ||
    b.width < 0 ||
    b.height < 0 ||
    b.width + b.height <= 0
  )
    return null;
  const frame = atlasFrame(a, binding),
    points = [
      { x: b.x, y: b.y },
      { x: b.x + b.width, y: b.y },
      { x: b.x + b.width, y: b.y + b.height },
      { x: b.x, y: b.y + b.height },
    ].map((p) => localToAtlas(p, frame));
  const x = Math.min(...points.map((p) => p.x)),
    y = Math.min(...points.map((p) => p.y)),
    width = Math.max(...points.map((p) => p.x)) - x,
    height = Math.max(...points.map((p) => p.y)) - y;
  const margin = Math.max(1.524, Math.max(width, height) * 0.05);
  const box = {
    x: x - margin,
    y: y - margin,
    width: width + 2 * margin,
    height: height + 2 * margin,
  };
  // Keep the metric overlay below the authored plan, including at 256 px.
  if (scale) {
    const pixels = Math.min(1024, Math.max(256, size));
    box.height += Math.max((72 * box.width) / pixels, (72 * box.height) / (pixels - 72));
  }
  return box;
}
/** Public output uses only the public projection, never hidden GM nodes. */
export function publicAtlasPaint(a: AtlasRenderView, box: CanvasBox, frame?: PlayerFrame) {
  const scene = atlasPaint('group');
  const add = (...args: Parameters<typeof atlasPaint>) => {
    const node = atlasPaint(...args);
    scene.append(node);
    return node;
  };
  add('rect', {
    width: box.width,
    height: box.height,
    style: { fill: '#20282a' },
  });
  if (a.geometry.position && a.perception) {
    const pose = a.geometry.position,
      b = a.bindings.find((b) => b.kind === 'dungeon' && b.ownerId === pose.scopeId);
    if (!b) throw new Error('Raum ist nicht im Atlas verortet.');
    const f = atlasFrame(a, b),
      at = (p: { x: number; y: number }) => {
        const n = localToAtlas(p, f);
        return { x: n.x - box.x, y: n.y - box.y };
      },
      matrix = frameMatrix({ ...f, x: f.x - box.x, y: f.y - box.y });
    for (const [polys, fill] of [
      [a.perception.known, '#7c7e74'],
      [a.perception.visible, '#ded7bd'],
    ] as const)
      if (polys.length)
        add('polygons', {
          polygons: polys,
          matrix: matrix,
          style: { fill: fill, fillRule: 'evenodd' },
        });
    for (const label of a.perception.labels) {
      const p = at(label.point);
      add(
        'text',
        {
          ...p,
          style: {
            fontSize: box.width / 100,
            textAlign: 'center',
            fill: '#203532',
          },
        },
        label.text,
      );
    }
    for (const m of a.perception.markers) {
      const p = at(m.point);
      add('circle', {
        x: p.x,
        y: p.y,
        radius: box.width / 250,
        style: { fill: m.kind === 'npc' ? '#8964a5' : '#39766a' },
      });
    }
    const p = at(pose);
    add('circle', {
      x: p.x,
      y: p.y,
      radius: box.width / 180,
      style: { fill: '#244f87', stroke: 'white', lineWidth: box.width / 900 },
    });
  } else if (frame?.mode === 'map' && frame.map) {
    const map = frame.map;
    for (const cell of map.cells) {
      const p = atlasHexPoint(cell.q, cell.r, map.hexMeters),
        r = map.hexMeters / Math.sqrt(3),
        points = Array.from({ length: 6 }, (_, i) => {
          const angle = ((30 + i * 60) * Math.PI) / 180;
          return {
            x: p.x - box.x + Math.cos(angle) * r,
            y: p.y - box.y + Math.sin(angle) * r,
          };
        });
      add('polygon', {
        points: points,
        data: cell.terrain === 'forest' ? { publicForestScale: '1' } : undefined,
        opacity: cell.visible ? 1 : 0.55,
        style: {
          fill: terrainColors[cell.terrain as keyof typeof terrainColors] ?? '#7fa8bd',
        },
      });
      if (cell.label)
        add(
          'text',
          {
            x: p.x - box.x,
            y: p.y - box.y,
            style: {
              fontSize: map.hexMeters / 15,
              fill: '#203532',
              textAlign: 'center',
            },
          },
          cell.label,
        );
    }
    // Remembered cells deliberately keep their public snapshot. Current GM
    // contours must not replace unseen terrain, even inside a known hex.
    const p = atlasHexPoint(map.position.q, map.position.r, map.hexMeters);
    add('circle', {
      x: p.x - box.x,
      y: p.y - box.y,
      radius: box.width / 180,
      style: { fill: '#244f87' },
    });
  } else
    throw new Error(
      'Für den aktuellen Gruppenkontext ist keine öffentliche Kartenprojektion verfügbar.',
    );
  return scene;
}
/** Metric overlay is composed once after all scene tiles, at a readable image size. */
export function atlasExportScale(
  box: CanvasBox,
  width: number,
  height: number,
  level?: number | string,
  system: AtlasUnits = atlasUnits(),
) {
  if (width < 256 || height < 100) return undefined;
  const scene = atlasPaint('group'),
    mpp =
      (box.width / width) *
      Math.max(1, Math.min(width / 1024, height / (level === undefined ? 100 : 140)));
  drawScale(scene, box, mpp, level, system);
  return scene;
}
/** A scene is drawn directly; GM scenes stream through one reusable tile surface. */
export async function atlasImage(
  source: AtlasPaint | AsyncIterable<import('./atlas-landscape-export').AtlasExportTile>,
  width: number,
  height: number,
  box: CanvasBox,
  format: 'png' | 'jpeg' = 'png',
  current: () => boolean = () => true,
  overlay?: AtlasPaint,
): Promise<Uint8Array> {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 8192 ||
    height > 8192 ||
    !Number.isFinite(box.width) ||
    !Number.isFinite(box.height) ||
    box.width <= 0 ||
    box.height <= 0
  )
    throw Error('Ungültige Bildgröße.');
  const checkCurrent = () => {
    if (!current()) throw Error('Atlas-Ausgabe abgebrochen.');
  };
  checkCurrent();
  const canvas = document.createElement('canvas');
  let tileCanvas: HTMLCanvasElement | undefined;
  try {
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw Error('Bildausgabe nicht verfügbar.');
    if (source instanceof AtlasPaint) await drawScene(canvas, source, box, checkCurrent);
    else {
      tileCanvas = document.createElement('canvas');
      for await (const tile of source) {
        checkCurrent();
        tileCanvas.width = tile.width;
        tileCanvas.height = tile.height;
        await drawScene(tileCanvas, tile.scene, tile.box, checkCurrent);
        checkCurrent();
        ctx.drawImage(tileCanvas, tile.x, tile.y);
      }
    }
    checkCurrent();
    if (overlay) await drawScene(canvas, overlay, box, checkCurrent, false);
    return await atlasCanvasBytes(canvas, format, current);
  } finally {
    canvas.width = canvas.height = 0;
    if (tileCanvas) tileCanvas.width = tileCanvas.height = 0;
  }
}

export async function drawScene(
  canvas: HTMLCanvasElement,
  scene: AtlasPaint,
  box: CanvasBox,
  checkCurrent: () => void,
  clear = true,
) {
  const compiled = new AtlasCanvasScene(scene),
    images = new Map<string, CanvasImageSource>();
  try {
    for (const source of compiled.images) {
      checkCurrent();
      const image = new Image();
      image.src = source;
      await image.decode();
      checkCurrent();
      images.set(source, image);
    }
    checkCurrent();
    const ctx = canvas.getContext('2d');
    if (!ctx) throw Error('Bildausgabe nicht verfügbar.');
    ctx.resetTransform();
    if (clear) ctx.clearRect(0, 0, canvas.width, canvas.height);
    compiled.draw(
      ctx,
      new DOMMatrix([canvas.width / box.width, 0, 0, canvas.height / box.height, 0, 0]),
      images,
      { x: 0, y: 0 },
    );
  } finally {
    compiled.dispose();
    images.clear();
  }
}

export async function atlasCanvasBytes(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpeg',
  current: () => boolean,
) {
  const checkCurrent = () => {
    if (!current()) throw Error('Atlas-Ausgabe abgebrochen.');
  };
  checkCurrent();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error('Bild konnte nicht erzeugt werden.'))),
      'image/' + format,
      0.94,
    ),
  );
  checkCurrent();
  // Match the IPC/file limit before reading the encoded bytes.
  if (blob.size > 64 * 1024 * 1024)
    throw Error('Atlas-Bild ist größer als 64 MiB. Kleinere Ausgabegröße wählen.');
  return new Uint8Array(await blob.arrayBuffer());
}
