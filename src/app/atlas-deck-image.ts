import { AtlasDeckVegetation } from './atlas-deck-vegetation';
import type { LandscapeRecord } from './atlas-landscape';
import { AtlasDeckSurface } from './atlas-deck-surface';
import { AtlasDeckDrawing } from './atlas-deck-drawing';
import { AtlasCanvasScene } from './atlas-canvas-scene';
import { atlasCanvasBytes, drawScene } from './campaign-atlas-export';
import type { AtlasPaint } from './atlas-paint';
import type { AtlasMetricCamera } from './atlas-metric-camera';
import type { AtlasTerrainTileModel } from './atlas-terrain-tile-model';
import type { AtlasSpatialSurface } from './atlas-spatial-surface';
import type { TerrainStyle } from './terrain-relief';
import type { AtlasDrawingMesh } from './atlas-drawing-geometry';

/** Same layers and camera as the editor; the GPU framebuffer stays at most 1024². */
export async function atlasDeckImage(
  input: {
    camera: AtlasMetricCamera;
    scene: AtlasPaint;
    surface: AtlasSpatialSurface & { closedObjectIds?: ReadonlySet<string> };
    terrain: readonly AtlasTerrainTileModel[];
    objects?: readonly AtlasDrawingMesh[];
    vegetation?: LandscapeRecord[];
    style: Readonly<TerrainStyle>;
    contours: number;
    seaLevelM: number;
  },
  width: number,
  height: number,
  format: 'png' | 'jpeg',
  current: () => boolean,
  progress: (done: number, total: number) => void,
  overlay?: AtlasPaint,
) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    Math.min(width, height) < 1 ||
    Math.max(width, height) > 8192
  )
    throw Error('Ungültige Bildgröße.');
  const check = () => {
    if (!current()) throw Error('Atlas-Ausgabe abgebrochen.');
  };
  check();
  const container = document.createElement('div'),
    output = document.createElement('canvas'),
    scene = new AtlasCanvasScene(input.scene),
    images = new Map<string, CanvasImageSource>();
  container.style.cssText = 'position:fixed;left:-20000px;top:0;pointer-events:none';
  document.body.append(container);
  let surface: AtlasDeckSurface | undefined, drawing: AtlasDeckDrawing | undefined;
  const vegetation = new AtlasDeckVegetation(input.vegetation ?? []);
  try {
    output.width = width;
    output.height = height;
    const ctx = output.getContext('2d');
    if (!ctx) throw Error('Bildausgabe nicht verfügbar.');
    if (input.camera.tilt > 60) {
      ctx.fillStyle = '#c5d7df';
      ctx.fillRect(0, 0, width, height);
    }
    for (const source of scene.images) {
      const image = new Image();
      image.src = source;
      await image.decode();
      check();
      images.set(source, image);
    }
    container.style.width = Math.min(1024, width) + 'px';
    container.style.height = Math.min(1024, height) + 'px';
    const styleScale = Math.max(1, Math.max(width, height) / 1024);
    surface = await AtlasDeckSurface.create({
      container,
      camera: input.camera,
      model: {
        objects: [],
        targets: new Map(),
        coverage: { complete: true, supportedKinds: [], unsupported: [] },
        verticalExaggeration: 1,
      },
      externalInput: true,
      pixelRatio: 1,
      styleScale,
    });
    check();
    surface.setTerrain(input.terrain, input.style, {
      contours: input.contours,
      seaLevelM: input.seaLevelM,
    });
    drawing = new AtlasDeckDrawing(
      scene,
      input.surface.origin,
      images,
      input.surface,
      input.objects,
    );
    surface.setDrawing((frame) => [
      ...drawing!.layers(frame, 'output', styleScale),
      ...vegetation.layers(frame, 'output', styleScale),
    ]);
    const total = Math.ceil(width / 1024) * Math.ceil(height / 1024);
    let done = 0;
    for (let y = 0; y < height; y += 1024)
      for (let x = 0; x < width; x += 1024) {
        check();
        const w = Math.min(1024, width - x),
          h = Math.min(1024, height - y);
        container.style.width = w + 'px';
        container.style.height = h + 'px';
        surface.setViewportCrop({ width, height, x, y });
        await surface.waitForFrame();
        check();
        ctx.drawImage(surface.canvas, 0, 0, w, h, x, y, w, h);
        progress(++done, total);
      }
    check();
    if (overlay)
      await drawScene(
        output,
        overlay,
        {
          x: input.camera.focus.x - (width * input.camera.metersPerPixel) / 2,
          y: input.camera.focus.y - (height * input.camera.metersPerPixel) / 2,
          width: width * input.camera.metersPerPixel,
          height: height * input.camera.metersPerPixel,
        },
        check,
        false,
      );
    return await atlasCanvasBytes(output, format, current);
  } finally {
    surface?.dispose();
    drawing?.dispose();
    vegetation.dispose();
    scene.dispose();
    images.clear();
    container.remove();
    output.width = output.height = 0;
  }
}
