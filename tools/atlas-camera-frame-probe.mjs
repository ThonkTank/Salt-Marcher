/** Renderer-only diagnostic. Counts GPU submissions and camera state within RAF;
 * this does not measure compositor presentation or actual pixel latency. */
export function installCameraFrameProbe() {
  const map = document.querySelector('#campaign-map'),
    gl = document.querySelector('#atlas-terrain-spatial').getContext('webgl2');
  const request = window.requestAnimationFrame.bind(window),
    clear = gl.clear.bind(gl);
  let current = null,
    frames = new Map(),
    outside = 0,
    wheels = [];
  window.requestAnimationFrame = (callback) =>
    request((time) => {
      const previous = current;
      current = frames.get(time);
      if (!current) {
        current = { time, draws: [], callbacks: [], lastView: map.dataset.atlasView };
        if (frames.size < 2048) frames.set(time, current);
      }
      const start = performance.now();
      try {
        callback(time);
      } finally {
        current.callbacks.push({ name: callback.name, ms: performance.now() - start });
        current.lastView = map.dataset.atlasView;
        current = previous;
      }
    });
  gl.clear = (...args) => {
    if (current) current.draws.push({ time: performance.now(), view: map.dataset.atlasView });
    else outside++;
    return clear(...args);
  };
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.target === map && wheels.length < 256)
        wheels.push({
          event: e.timeStamp,
          handled: performance.now(),
          view: map.dataset.atlasView,
        });
    },
    true,
  );
  window.__cameraFrameProbe = {
    reset() {
      frames = new Map();
      outside = 0;
      wheels = [];
    },
    snapshot() {
      const entries = [...frames.values()],
        drawn = entries.filter((f) => f.draws.length),
        stale = drawn.filter((f) => f.draws.at(-1).view !== f.lastView);
      return {
        frames: entries,
        wheels,
        outside,
        drawnFrames: drawn.length,
        staleFrames: stale.length,
        multipleDrawFrames: drawn.filter((f) => f.draws.length > 1).length,
      };
    },
  };
}
