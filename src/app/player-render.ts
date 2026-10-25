import type { PlayerFrame } from './player-contracts';
import { playerAtlas } from './player-atlas';
import { AtlasCanvasScene } from './atlas-canvas-scene';

const displays = new WeakMap<HTMLElement, () => void>();
export function renderPlayer(
  container: HTMLElement,
  frame: PlayerFrame,
  origin = 'campaign://player',
) {
  displays.get(container)?.();
  displays.delete(container);
  container.replaceChildren();
  container.className = 'player-stage';
  if (!frame || !['blank', 'image', 'map', 'dungeon'].includes(frame.mode)) return;
  container.className += ' player-' + frame.mode;
  if (frame.mode === 'blank') return;
  if (frame.title) {
    const title = document.createElement('h1');
    title.textContent = frame.title;
    container.append(title);
  }
  if (frame.mode === 'image') {
    const image = document.createElement('img');
    image.alt = frame.title || 'Freigegebenes Bild';
    image.src = origin + '/art/' + encodeURIComponent(frame.imageId!);
    container.append(image);
    return;
  }
  const projection = playerAtlas(frame);
  if (!projection) return;
  const host = document.createElement('div');
  host.className = 'player-atlas';
  host.setAttribute('role', 'img');
  host.setAttribute(
    'aria-label',
    frame.title ||
      (frame.mode === 'dungeon'
        ? 'Bekannter Dungeon und aktuelle Wahrnehmung'
        : 'Bekannte Reisekarte'),
  );
  container.append(host);
  let disposed = false,
    release = () => {};
  displays.set(container, () => {
    disposed = true;
    release();
  });
  return import('./atlas-deck-runtime')
    .then(async ({ AtlasDeckSurface, AtlasDeckDrawing }) => {
      if (disposed) return;
      const { box } = projection,
        scene = new AtlasCanvasScene(projection.scene);
      release = () => scene.dispose();
      const camera = () => ({
        focus: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
        focusHeightM: 0,
        metersPerPixel: Math.max(
          box.width / Math.max(1, host.clientWidth),
          box.height / Math.max(1, host.clientHeight),
        ),
        tilt: 0,
        rotation: 0,
        exaggeration: 1,
      });
      const surface = await AtlasDeckSurface.create({
        container: host,
        camera: camera(),
        model: {
          objects: [],
          targets: new Map(),
          coverage: { complete: true, supportedKinds: [], unsupported: [] },
          verticalExaggeration: 1,
        },
        externalInput: true,
      });
      if (disposed) {
        surface.dispose();
        scene.dispose();
        return;
      }
      const drawing = new AtlasDeckDrawing(scene, { x: 0, y: 0 }, new Map(), {
        origin: { x: box.x, y: box.y },
        focusM: 0,
        exaggeration: 1,
        height: () => 0,
        segment: Math.max(box.width, box.height),
        bounds: box,
      });
      surface.setDrawing((frame) => drawing.layers(frame, 'player'));
      const observer = new ResizeObserver(() => surface.setCamera(camera()));
      observer.observe(host);
      release = () => {
        observer.disconnect();
        surface.dispose();
        drawing.dispose();
        scene.dispose();
      };
      await surface.waitForFrame();
      if (!disposed) host.dataset.ready = 'true';
    })
    .catch((error) => {
      if (disposed) return;
      release();
      host.replaceChildren();
      host.dataset.ready = 'failed';
      host.textContent = 'Kartenanzeige nicht verfügbar.';
      console.error(error);
    });
}
