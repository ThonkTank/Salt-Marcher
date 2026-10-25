import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  entryPoints: ['src/app/music-player.ts'],
  outfile: '.build/planner-audio-layer-recovery/player.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});

const { LocalAudioPlayer } = createRequire(import.meta.url)(
  '../.build/planner-audio-layer-recovery/player.cjs',
);
const tick = () => new Promise((resolve) => setImmediate(resolve));
function fixture() {
  let now = 0,
    next = 0;
  const frames = new Map(),
    audio = [],
    failures = [];
  class Element {
    children = [];
    dataset = {};
    parent = null;
    id = '';
    paused = true;
    ended = false;
    volume = 1;
    currentTime = 0;
    duration = 60;
    readyState = 1;
    requests = [];
    pauses = 0;
    append(...elements) {
      for (const e of elements) {
        e.parent = this;
        this.children.push(e);
      }
    }
    remove() {
      if (this.parent) this.parent.children = this.parent.children.filter((e) => e !== this);
      this.parent = null;
    }
    removeAttribute(name) {
      if (name === 'src') delete this.src;
    }
    pause() {
      this.paused = true;
      this.pauses++;
    }
    load() {
      this.currentTime = 0;
    }
    play() {
      return new Promise((resolve, reject) =>
        this.requests.push({
          resolve: () => {
            this.paused = false;
            resolve();
          },
          reject: (error) => {
            this.paused = true;
            reject(error);
          },
        }),
      );
    }
  }
  const body = new Element(),
    find = (e, id) => (e.id === id ? e : e.children.map((c) => find(c, id)).find(Boolean));
  const saved = {
    document: globalThis.document,
    performance: globalThis.performance,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  Object.assign(globalThis, {
    document: {
      body,
      createElement: (tag) => {
        const e = new Element();
        if (tag === 'audio') audio.push(e);
        return e;
      },
      getElementById: (id) => find(body, id),
    },
    performance: { now: () => now },
    requestAnimationFrame: (fn) => {
      const id = ++next;
      frames.set(id, fn);
      return id;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
  });
  const player = new LocalAudioPlayer({
    ended: () => {},
    failed: (...args) => failures.push(args),
    timing: () => {},
  });
  const view = (id = 'A', changes = {}, layers = []) => ({
    state: {
      revision: 1,
      autoplay: false,
      autoAmbience: false,
      current: id
        ? { assetId: id, playbackId: 'play-' + id, positionSeconds: 0, mode: 'manual' }
        : null,
      queue: [],
      history: [],
      status: 'playing',
      loop: 'none',
      manualHold: 'none',
      volume: 0.8,
      ambienceVolume: 0.4,
      fadeSeconds: 2,
      forcedAmbience: [],
      mutedAmbience: [],
      contextSignature: '',
      lastError: null,
      ...changes,
    },
    layers,
  });
  return {
    player,
    audio,
    failures,
    view,
    frames,
    frame(ms) {
      now = ms;
      for (const [id, fn] of [...frames]) {
        frames.delete(id);
        fn(ms);
      }
    },
    cleanup() {
      player.reset();
      Object.assign(globalThis, saved);
    },
  };
}

test('a failed ambience layer is removed when no longer desired and can be explicitly selected again', async () => {
  const x = fixture();
  try {
    const v = x.view(null, {}, [{ assetId: 'wind', gain: 0.4, manual: true }]);
    x.player.apply(v);
    const broken = x.audio[2];
    broken.requests[0].resolve();
    await tick();
    x.frame(2000);
    broken.onerror();
    assert.equal(x.failures.length, 1);
    x.player.apply(v);
    assert.equal(broken.requests.length, 1, 'failure does not authorize automatic retry');
    x.player.apply(x.view(null));
    assert.equal(broken.parent === null, true, 'failed obsolete media must be released');
    x.player.apply(v);
    const repaired = x.audio.at(-1);
    assert.notEqual(repaired, broken);
    assert.equal(repaired.requests.length, 1);
    repaired.requests[0].resolve();
    await tick();
    x.frame(4000);
    assert.equal(repaired.paused, false);
    assert.equal(repaired.volume, 0.4);
    broken.onerror();
    assert.equal(x.failures.length, 1, 'obsolete decoder callbacks have no authority');
  } finally {
    x.cleanup();
  }
});
test('removing a failed layer preserves the other layer and its ongoing fade', async () => {
  const x = fixture();
  try {
    x.player.apply(
      x.view(null, {}, [
        { assetId: 'wind', gain: 0.2, manual: false },
        { assetId: 'rain', gain: 0.4, manual: true },
      ]),
    );
    const wind = x.audio[2],
      rain = x.audio[3];
    wind.requests[0].resolve();
    rain.requests[0].resolve();
    await tick();
    x.frame(1000);
    wind.onerror();
    x.player.apply(x.view(null, {}, [{ assetId: 'rain', gain: 0.4, manual: true }]));
    assert.equal(wind.parent === null, true);
    x.frame(2000);
    assert.equal(rain.paused, false);
    assert.equal(rain.volume, 0.4);
    assert.equal(x.frames.size, 0);
    assert.equal(x.failures.length, 1);
  } finally {
    x.cleanup();
  }
});
