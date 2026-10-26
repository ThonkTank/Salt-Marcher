/** Native probes use the published canvas and its camera, never removed SVG object nodes. */
export async function atlasCanvasReady(page) {
  await page.waitForFunction(
    () =>
      document.querySelector('#campaign-atlas')?.dataset.regionState === 'ready' &&
      document.querySelector('#campaign-map')?.dataset.canvasState === 'loaded',
    null,
    { timeout: 60000 },
  );
}
export async function atlasCanvasPoint(page, point, scroll = true) {
  await atlasCanvasReady(page);
  return page.evaluate(
    ({ point, scroll }) => {
      const canvas = document.querySelector('#campaign-map'),
        view = JSON.parse(canvas.dataset.atlasView);
      const coordinates = () => {
        const r = canvas.getBoundingClientRect(),
          scale = Math.min(canvas.clientWidth / view.width, canvas.clientHeight / view.height);
        return {
          x:
            r.x +
            canvas.clientLeft +
            (canvas.clientWidth - view.width * scale) / 2 +
            (point.x - view.x) * scale,
          y:
            r.y +
            canvas.clientTop +
            (canvas.clientHeight - view.height * scale) / 2 +
            (point.y - view.y) * scale,
          unitsPerPixel: 1 / scale,
        };
      };
      if (scroll) {
        const p = coordinates();
        window.scrollBy({ top: p.y - innerHeight * 0.65, behavior: 'instant' });
      }
      return {
        ...coordinates(),
        target: document.elementFromPoint(coordinates().x, coordinates().y)?.id,
      };
    },
    { point, scroll },
  );
}

/** Wait for the exact source revision and completed GPU publication, not data arrival. */
export async function atlasTerrainRendered(page, revision, timeout = 90000) {
  await page.waitForFunction(
    (revision) => {
      const root = document.querySelector('#campaign-atlas'),
        canvas = document.querySelector('#campaign-map');
      if (
        root?.dataset.regionState !== 'ready' ||
        canvas?.dataset.canvasState !== 'loaded' ||
        canvas.dataset.terrainDraft
      )
        return false;
      const rendered = JSON.parse(canvas.dataset.terrainRendered ?? 'null');
      return (
        rendered?.revision === revision &&
        rendered.quality === 'detail' &&
        canvas.dataset.terrainQuality === 'detail' &&
        Number(canvas.dataset.atlasRegionRevision) === revision
      );
    },
    revision,
    { timeout },
  );
  return page.locator('#campaign-map').getAttribute('data-terrain-rendered');
}
