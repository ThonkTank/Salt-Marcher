import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  entryPoints: ['desktop/player-window.ts'],
  outfile: '.build/planner-player-visual-contract/host.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { PlayerDisplay } = createRequire(import.meta.url)(
    '../../.build/planner-player-visual-contract/host.cjs',
  ),
  tick = () => new Promise((resolve) => setImmediate(resolve));
const makeState = (id = 'A', token = id + '-token') => ({
  owner: { id, token },
  settings: {
    revision: 1,
    blank: false,
    windowOpen: true,
    mode: 'image',
    imageId: id,
    title: id,
    labels: false,
    light: 'auto',
    displayId: 1,
    fullscreen: false,
    boundSceneId: id + '-scene',
  },
  frame: { mode: 'image', imageId: id, title: id },
});
class Window extends EventEmitter {
  constructor() {
    super();
    this.destroyed = false;
    this.shows = 0;
    this.closes = 0;
    this.hidden = 0;
    this.bounds = [];
    this.fullscreen = [];
    this.messages = [];
    this.webContents = {
      mainFrame: { url: 'campaign://player/player-display.html' },
      send: (_channel, value) => this.messages.push(value),
      setWindowOpenHandler: () => {},
      on: () => {},
    };
    this.loading = new Promise((resolve, reject) => {
      this.loaded = resolve;
      this.failed = reject;
    });
  }
  loadURL() {
    return this.loading;
  }
  isDestroyed() {
    return this.destroyed;
  }
  showInactive() {
    assert.equal(this.destroyed, false);
    this.shows++;
  }
  hide() {
    this.hidden++;
  }
  close() {
    this.closes++;
  }
  setBounds(value) {
    this.bounds.push(value);
  }
  setFullScreen(value) {
    this.fullscreen.push(value);
  }
  finishClose() {
    this.destroyed = true;
    this.emit('closed');
  }
}
function fixture() {
  let state = makeState(),
    stopping = false;
  const windows = [],
    closed = [],
    errors = [];
  let bounds = { x: 0, y: 0, width: 1280, height: 720 };
  const options = {
    current: () => {
      if (state instanceof Error) throw state;
      return state;
    },
    create: () => {
      const w = new Window();
      windows.push(w);
      return w;
    },
    origin: 'campaign://player/player-display.html',
    layout: (s) => ({ bounds, fullscreen: s.fullscreen }),
    closed: (token) => {
      closed.push(token);
      if (state?.owner?.token === token) state.settings.windowOpen = false;
    },
    stopping: () => stopping,
    error: (error) => errors.push(error),
  };
  const display = new PlayerDisplay(options);
  return {
    display,
    windows,
    closed,
    errors,
    setState: (s) => {
      state = s;
    },
    setBounds: (b) => {
      bounds = b;
    },
    stop: () => {
      stopping = true;
    },
  };
}

test('host pull and push reject unsupported legacy text and mechanics frames', async () => {
  for (const mode of ['scene', 'combat', 'chase']) {
    const x = fixture(),
      state = makeState();
    state.frame = {
      mode,
      title: 'GM-Überschrift',
      scene: { text: 'Nicht publizieren' },
      combat: { hp: 12 },
      chase: { speed: 9 },
    };
    x.setState(state);
    await x.display.sync();
    x.windows[0].loaded();
    await tick();
    assert.deepEqual((await x.display.frame()).frame, { mode: 'blank', title: '' });
    assert.deepEqual(x.windows[0].messages.at(-1).frame, { mode: 'blank', title: '' });
    x.display.shutdown();
  }
});
test('host publishes only visual fields rather than extra data on otherwise valid images', async () => {
  const x = fixture(),
    state = makeState();
  state.frame = {
    ...state.frame,
    scene: { text: 'Nicht übertragen' },
    combat: { hp: 12 },
    reason: 'Private Fehlermeldung',
  };
  x.setState(state);
  await x.display.sync();
  x.windows[0].loaded();
  await tick();
  assert.deepEqual((await x.display.frame()).frame, { mode: 'image', title: 'A', imageId: 'A' });
  assert.deepEqual(x.windows[0].messages.at(-1).frame, { mode: 'image', title: 'A', imageId: 'A' });
  x.display.shutdown();
});

test('host strips unused prose from nested map and dungeon visual fields', async () => {
  for (const mode of ['map', 'dungeon']) {
    const x = fixture(),
      state = makeState(),
      p = { x: 1, y: 2, notes: 'GM_POINT' };
    state.frame =
      mode === 'map'
        ? {
            mode,
            title: 'Öffentliche Karte',
            map: {
              hexMeters: 100,
              position: { q: 0, r: 0, notes: 'GM_POSE' },
              cells: [
                {
                  q: 0,
                  r: 0,
                  terrain: 'plain',
                  road: false,
                  river: false,
                  visible: true,
                  label: 'Öffentlich',
                  notes: 'GM_CELL',
                },
              ],
              markers: [],
              notes: 'GM_MAP',
            },
          }
        : {
            mode,
            title: 'Dungeon',
            dungeon: {
              position: p,
              known: [{ outer: [p], holes: [], notes: 'GM_POLYGON' }],
              visible: [],
              labels: [],
              markers: [{ point: p, kind: 'door', open: true, label: 'GM_DOOR' }],
              tracks: [{ from: p, to: p, label: 'GM_TRACK' }],
              floorLabel: 'GM_FLOOR',
              description: 'GM_DESCRIPTION',
              clues: ['GM_CLUE'],
            },
          };
    x.setState(state);
    await x.display.sync();
    x.windows[0].loaded();
    await tick();
    const frame = (await x.display.frame()).frame;
    assert.equal(frame.mode, mode);
    assert.doesNotMatch(JSON.stringify(frame), /GM_/);
    assert.doesNotMatch(JSON.stringify(x.windows[0].messages.at(-1)), /GM_/);
    x.display.shutdown();
  }
});

test('late asynchronous refresh errors cannot retire a newer player window', async () => {
  const x = fixture();
  let reject;
  x.setState(new Promise((_, r) => (reject = r)));
  const stale = x.display.sync();
  x.setState(makeState('B'));
  await x.display.sync();
  const current = x.windows.at(-1);
  current.loaded();
  await tick();
  reject(Error('old read failed'));
  await stale;
  assert.equal(x.display.window, current);
  assert.equal(current.closes, 0);
  assert.deepEqual(x.errors, []);
  x.display.shutdown();
});
test('late close lookup cannot close a replacement window of the same owner', async () => {
  const x = fixture();
  await x.display.sync();
  const old = x.windows[0];
  let release;
  x.setState(new Promise((r) => (release = r)));
  old.finishClose();
  x.setState(makeState());
  await x.display.sync();
  const current = x.windows[1];
  release(makeState());
  await tick();
  assert.deepEqual(x.closed, []);
  assert.equal(x.display.window, current);
  x.display.shutdown();
});

test('a delayed frame pull retains its original generation behind a newer pushed frame', async () => {
  const x = fixture();
  await x.display.sync();
  x.windows[0].loaded();
  await tick();
  let release;
  x.setState(new Promise((r) => (release = r)));
  const stale = x.display.frame();
  const newer = makeState();
  newer.frame.title = 'Newer';
  x.setState(newer);
  await x.display.sync();
  const pushed = x.windows[0].messages.at(-1);
  release(makeState());
  const old = await stale;
  assert(old.generation < pushed.generation);
  assert.equal(pushed.frame.title, 'Newer');
  x.display.shutdown();
});
