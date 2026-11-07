import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Bounded error capture at the existing read-only presentation seam. No GPU readback.
export async function observeStrokeDiagnostic(page, persistFailure) {
  await page.exposeFunction('__persistStrokeFailure', persistFailure);
  const code = await readFile('.build/desktop/ui/renderer.js', 'utf8');
  const guard = code.indexOf('if ((tilePairs ??', code.indexOf('function applyTerrainBrush('));
  assert(guard > 0, 'Height work guard condition exists');
  const offset = code.indexOf('throw Error(', guard);
  assert(offset > guard, 'Height work guard diagnostic seam exists');
  const debuggerSession = await page.context().newCDPSession(page);
  await debuggerSession.send('Debugger.enable');
  await debuggerSession.send('Debugger.setBreakpointByUrl', {
    urlRegex: 'renderer\\.js$',
    lineNumber: code.slice(0, offset).split('\n').length - 1,
    condition:
      '(globalThis.__strokeGuardFailure = { at: performance.now(), stroke: structuredClone(s), box, pixel, tiles, tilePairs, dabs: dabs.length, product: (tilePairs ?? dabs.length * tiles.length) * 4096 }, false)',
  });
  await page.evaluate(() => {
    const r = window.__qaRiverRaster;
    const q = (window.__strokeDiagnostic = { inputs: [], picks: [], previews: [], failure: null });
    const push = (list, value) => {
      list.push(value);
      if (list.length > 512) list.shift();
    };
    const originalPoint = r.point.bind(r);
    r.point = (e) => {
      const start = performance.now(),
        point = originalPoint(e);
      push(q.picks, {
        start,
        at: performance.now(),
        eventTimestamp: e.timeStamp,
        x: e.clientX,
        y: e.clientY,
        point: { ...point },
        source: q.lastAuthor?.source,
        gesturing: r.gesturing,
        terrainRaster: r.needsTerrainRaster,
        workplane: r.host.workplane?.() ?? null,
      });
      return point;
    };
    const originalAuthor = r.authorPoint.bind(r);
    r.authorPoint = (x, y) => {
      const point = originalAuthor(x, y);
      q.lastAuthor = {
        x,
        y,
        point,
        source: r.needsTerrainRaster
          ? 'zero-plane'
          : r.host.workplane?.()
            ? 'workplane'
            : point
              ? 'terrain'
              : 'miss-retains-last-point',
      };
      return point;
    };
    const originalPreview = r.previewHeight.bind(r);
    q.snapshot = () => ({
      ...q,
      snapshot: undefined,
      stroke: structuredClone(q.stroke),
      guard: window.__strokeGuardFailure,
      pose: r.cameraPose(),
      revision: r.revision,
      draftConsumed: r.draft?.consumed,
      sourceRevision: r.draftSource?.revision,
      sourceFence: r.draftSource?.fence,
      draftBase: r.draft?.baseTiles.map((t) => ({
        tile: t.tile,
        view: t.terrain.projection.grid.view,
        authorRevision: t.terrain.projection.grid.editing?.author?.revision,
      })),
      lastAuthor: q.lastAuthor,
    });
    r.previewHeight = (stroke) => {
      q.stroke = stroke;
      push(q.previews, {
        at: performance.now(),
        count: stroke.samples.length,
        last: { ...stroke.samples.at(-1) },
        pose: r.cameraPose(),
      });
      try {
        const result = originalPreview(stroke);
        if (globalThis.__qaVisibilityContract && r.draft?.consumed === stroke.samples.length) {
          q.previewAuthorHeights = (
            r.draft.tiles[0]?.terrain.projection.grid.editing?.author?.records ?? []
          )
            .filter((record) => record.height)
            .map((record) => ({ id: record.id, height: record.height }));
          q.previewSamples = stroke.samples.length;
        }
        return result;
      } catch (error) {
        if (!q.failure) {
          q.failure = { at: performance.now(), message: error.stack ?? String(error) };
          const snapshot = q.snapshot();
          delete snapshot.strokeDiagnostic;
          void window.__persistStrokeFailure(snapshot);
        }
        throw error;
      }
    };
    for (const type of [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
      'lostpointercapture',
    ])
      window.addEventListener(
        type,
        (e) => {
          if (e.target?.id !== 'campaign-map') return;
          push(q.inputs, {
            type,
            at: performance.now(),
            eventTimestamp: e.timeStamp,
            x: e.clientX,
            y: e.clientY,
            buttons: e.buttons,
            pointerId: e.pointerId,
            trusted: e.isTrusted,
          });
        },
        true,
      );
  });
}
