// Renderer-clock measurements at the existing native presentation diagnostic seam.
// onAfterRender is GPU submission observation, never compositor/scanout latency.
export async function observeAtlasEfficiency(page, options = {}) {
  await page.evaluate((options) => {
    const r = window.__qaRiverRaster,
      deck = r.surface.deckValue;
    const q = (window.__atlasEfficiency = {
      inputs: [],
      frames: [],
      reads: [],
      receipts: [],
      longTasks: [],
      enabled: true,
    });
    window.__saltTerrainTrace = options.trace === false ? undefined : { events: [], dropped: 0 };
    const previous = deck.props.onAfterRender;
    const read = r.stream.getTile.bind(r.stream);
    r.stream.getTile = async (...args) => {
      const start = performance.now(),
        fetch = args[2];
      let backend = false;
      args[2] = (...a) => {
        backend = true;
        return fetch(...a);
      };
      try {
        return await read(...args);
      } finally {
        q.reads.push({ start, ms: performance.now() - start, backend, tile: args[0].tile });
      }
    };
    const reconcile = r.reconcile.bind(r);
    r.reconcile = (...args) => {
      q.receipts.push({ at: performance.now(), revision: args[0] });
      return reconcile(...args);
    };
    new PerformanceObserver((list) =>
      q.longTasks.push(...list.getEntries().map((e) => ({ start: e.startTime, ms: e.duration }))),
    ).observe({ type: 'longtask', buffered: false });
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'wheel'])
      window.addEventListener(
        type,
        (e) => {
          if (e.target?.id !== 'campaign-map') return;
          q.inputs.push({
            type,
            at: performance.now(),
            eventTimestamp: e.timeStamp,
            x: e.clientX,
            y: e.clientY,
            buttons: e.buttons,
            trusted: e.isTrusted,
            deltaY: e.deltaY,
          });
        },
        true,
      );
    deck.setProps({
      onAfterRender: (...args) => {
        previous?.(...args);
        if (!q.enabled) return;
        const at = performance.now(),
          p = r.cameraPose(),
          layers = (deck.props.layers ?? []).filter(
            (l) => l && 'isLoaded' in l && !l.isLoaded,
          ).length;
        const d = r.draft,
          tiles = r.tiles,
          active = q.active;
        // A new array alone is not terrain effect. Compare actual frozen mesh
        // values once, retaining only references during this bounded sample.
        const changed =
          active?.kind === 'terrain' &&
          (active.terrainEffectVerified ||
            tiles.some((t) => {
              const base = active.beforeTiles.get([t.tile.lod, t.tile.x, t.tile.y].join(':'));
              const heights = t.terrain.projection.grid.heights;
              return (
                base &&
                base !== heights &&
                base.length === heights.length &&
                heights.some((value, i) => value !== base[i])
              );
            }));
        if (changed && active) active.terrainEffectVerified = true;
        const entry = {
          at,
          pose: [p.frame.x, p.frame.y, p.frame.width, p.focusM, p.tilt],
          usable: r.surface.frameUsable,
          layers,
          revision: r.revision,
          displayRevision: Number(r.input.dataset.terrainRevision),
          quality: r.input.dataset.terrainQuality,
          gesturing: r.gesturing,
          draft: !!d,
          changed: !!changed,
          consumed: d?.consumed,
          samples: r.pendingStroke?.samples.length,
          lastT: r.pendingStroke?.samples.at(-1)?.t,
        };
        if (options.readback !== false && q.active && changed && !q.active.firstReadback) {
          const gl = r.surface.canvas.getContext('webgl2'),
            pixels = new Uint8Array(32 * 32 * 4),
            start = performance.now();
          gl.readPixels(
            Math.floor(gl.drawingBufferWidth / 2) - 16,
            Math.floor(gl.drawingBufferHeight / 2) - 16,
            32,
            32,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixels,
          );
          q.active.firstReadback = {
            at,
            ms: performance.now() - start,
            error: gl.getError(),
            pixels: Array.from(pixels),
          };
        }
        q.frames.push(entry);
        if (q.frames.length > 20000) q.frames.shift();
      },
    });
    q.begin = (kind) => {
      const gl = r.surface.canvas.getContext('webgl2'),
        pixels = new Uint8Array(32 * 32 * 4),
        start = performance.now();
      if (options.readback !== false)
        gl.readPixels(
          Math.floor(gl.drawingBufferWidth / 2) - 16,
          Math.floor(gl.drawingBufferHeight / 2) - 16,
          32,
          32,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
      const p = r.cameraPose();
      q.active = {
        kind,
        at: performance.now(),
        inputIndex: q.inputs.length,
        frameIndex: q.frames.length,
        readIndex: q.reads.length,
        receiptIndex: q.receipts.length,
        traceIndex: window.__saltTerrainTrace?.events.length ?? 0,
        longIndex: q.longTasks.length,
        beforePose: [p.frame.x, p.frame.y, p.frame.width, p.focusM, p.tilt],
        beforeRevision: r.revision,
        beforeTiles: new Map(
          r.tiles.map((t) => [
            [t.tile.lod, t.tile.x, t.tile.y].join(':'),
            t.terrain.projection.grid.heights,
          ]),
        ),
        observerRetainedMeshBytes: r.tiles.reduce(
          (sum, t) => sum + t.terrain.projection.grid.heights.byteLength,
          0,
        ),
        beforePixels: Array.from(pixels),
        initialReadMs: performance.now() - start,
      };
    };
    q.end = () => {
      const a = q.active;
      q.active = null;
      const inputs = q.inputs.slice(a.inputIndex),
        frames = q.frames.slice(a.frameIndex),
        receipt = q.receipts.slice(a.receiptIndex),
        reads = q.reads.slice(a.readIndex),
        traces = window.__saltTerrainTrace?.events.slice(a.traceIndex) ?? [],
        longTasks = q.longTasks.slice(a.longIndex);
      const down = inputs.find((e) => e.type === 'pointerdown' && e.buttons === 1),
        up = inputs.find((e) => e.type === 'pointerup'),
        nav = inputs.find((e) => e.type === 'wheel' || (e.type === 'pointermove' && e.buttons));
      const first =
        a.kind === 'terrain'
          ? frames.find((f) => f.changed && f.usable && f.layers === 0)
          : frames.find(
              (f) => f.pose.some((v, i) => Math.abs(v - a.beforePose[i]) > 1e-10) && f.layers === 0,
            );
      const fully = frames.find(
        (f) =>
          up &&
          f.at >= up.at &&
          f.revision > a.beforeRevision &&
          f.displayRevision === f.revision &&
          f.quality === 'detail' &&
          f.usable &&
          f.layers === 0 &&
          !f.draft,
      );
      const effects = frames
        .filter((f) => f.changed && f.usable && f.layers === 0 && up && f.at < up.eventTimestamp)
        .filter((f, i, arr) => i === 0 || f.lastT !== arr[i - 1].lastT);
      let changedPixels = null;
      if (a.firstReadback) {
        changedPixels = 0;
        for (let i = 0; i < a.beforePixels.length; i += 4)
          if (
            a.beforePixels[i] !== a.firstReadback.pixels[i] ||
            a.beforePixels[i + 1] !== a.firstReadback.pixels[i + 1] ||
            a.beforePixels[i + 2] !== a.firstReadback.pixels[i + 2]
          )
            changedPixels++;
      }
      delete a.beforeTiles;
      delete a.beforePixels;
      if (a.firstReadback) delete a.firstReadback.pixels;
      return {
        ...a,
        inputs,
        frames,
        reads,
        receipts: receipt,
        traces,
        longTasks,
        changedPixels,
        firstTerrainFrameMs:
          first && down && up && first.at < up.eventTimestamp
            ? first.at - down.eventTimestamp
            : null,
        firstTerrainEffectFrameMs: first && down ? first.at - down.eventTimestamp : null,
        firstTerrainEffectFromCaptureMs: first && down ? first.at - down.at : null,
        firstNavigationFrameMs: first && nav ? first.at - nav.eventTimestamp : null,
        pointerupToReceiptAdoptionMs:
          up && receipt.length ? receipt[0].at - up.eventTimestamp : null,
        pointerupToFullFrameMs: up && fully ? fully.at - up.eventTimestamp : null,
        heldUpdateIntervalsMs: effects.slice(1).map((f, i) => f.at - effects[i].at),
        frameIntervalsMs: frames.slice(1).map((f, i) => f.at - frames[i].at),
        endedAt: performance.now(),
        statistics: r.stream.statistics,
        gpu: JSON.parse(r.input.dataset.terrainGpu ?? 'null'),
        materialCache: r.tiles.map((t) => t.material.cache),
        jsHeap: performance.memory
          ? { used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize }
          : null,
      };
    };
  }, options);
}
export function timingQuantiles(values) {
  const v = values.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  return {
    count: v.length,
    missing: values.length - v.length,
    p50: v.length ? v[Math.ceil(v.length * 0.5) - 1] : null,
    p95: v.length ? v[Math.ceil(v.length * 0.95) - 1] : null,
    max: v.at(-1) ?? null,
  };
}
