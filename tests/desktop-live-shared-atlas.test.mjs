import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { parseHTML } from './helpers/dom.mjs';
buildSync({
  stdin: {
    contents:
      "export {LiveAtlasPortal} from './src/app/live-atlas-portal';export {atlasWorldRoute} from './src/app/atlas-runtime-model';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/live-shared-atlas-tests.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { LiveAtlasPortal, atlasWorldRoute } = createRequire(import.meta.url)(
  '../.build/live-shared-atlas-tests.cjs',
);
function dom(t) {
  const prior = { window: globalThis.window, document: globalThis.document },
    { window, document } = parseHTML(
      '<html><body><main><p id="before">before</p><section id="campaign-atlas"><div id="bar"><button id="atlas-to-party">Gruppe</button><button id="atlas-overview">Welt</button></div><div id="stage"><div class="map-canvas-controls" data-canvas-for="campaign-map"><button id="history">Zurück</button></div><svg id="campaign-map" viewBox="100 200 300 400"></svg><p id="atlas-save-status">Gespeichert</p></div><aside><div id="atlas-local-console">Lokaler Laufstand</div></aside></section><p id="after">after</p><section id="map"></section><div id="navigation"></div><div id="console"></div></main></body></html>',
    );
  Object.assign(globalThis, { window, document });
  t.after(() => Object.assign(globalThis, prior));
  return { id: (id) => document.getElementById(id), document };
}
test('Live moves the exact shared Atlas and camera controls, preserving listeners and camera through repeated returns', (t) => {
  const { id, document } = dom(t),
    root = id('campaign-atlas'),
    svg = id('campaign-map'),
    calls = [],
    zoom = [],
    parent = root.parentNode,
    local = id('atlas-local-console'),
    history = id('history');
  let clicks = 0;
  history.onclick = () => clicks++;
  const portal = new LiveAtlasPortal(
    root,
    svg,
    (v) => calls.push(v),
    (f) => zoom.push(f),
  );
  for (let i = 0; i < 2; i++) {
    portal.mount(id('map'), id('navigation'), id('console'));
    portal.mount(id('map'), id('navigation'), id('console'));
    assert.equal(id('map').firstElementChild, root);
    assert.equal(document.querySelectorAll('#campaign-map').length, 1);
    assert.equal(id('campaign-map'), svg);
    assert.equal(svg.getAttribute('viewBox'), '100 200 300 400');
    assert.equal(history.closest('#navigation'), id('navigation'));
    history.click();
    assert.equal(id('live-atlas-local-travel').contains(local), true);
    assert.equal(id('console').contains(id('atlas-save-status')), true);
    portal.show(true);
    id('live-atlas-zoom').querySelector('button').click();
    portal.show(false);
    portal.unmount();
    assert.equal(portal.mounted, false);
    assert.equal(root.parentNode, parent);
    assert.equal(root.previousElementSibling, id('before'));
    assert.equal(root.nextElementSibling, id('after'));
    assert.equal(root.contains(local), true);
    assert.equal(root.contains(history), true);
    assert.equal(root.dataset.liveSurface, undefined);
    assert.equal(id('live-atlas-zoom'), null);
    assert.equal(id('map').children.length, 0);
  }
  assert.equal(clicks, 2);
  assert.deepEqual(zoom, [0.5, 0.5]);
  assert.deepEqual(calls, [true, false, false, true, false, false]);
});
test('shared Atlas shows only the current owner preview or an open journey, including its last committed Hex', () => {
  const route = [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 },
    ],
    a = {
      terrain: { id: 'world' },
      scene: {
        scene: { id: 'group' },
        journey: {
          sceneId: 'group',
          mapId: 'world',
          route,
          nextIndex: 2,
          status: 'active',
        },
      },
    };
  assert.deepEqual(atlasWorldRoute(a, null), route.slice(1));
  for (const status of ['paused', 'interrupted']) {
    a.scene.journey.status = status;
    assert.deepEqual(atlasWorldRoute(a, null), route.slice(1));
  }
  for (const status of ['ended', 'arrived']) {
    a.scene.journey.status = status;
    assert.deepEqual(atlasWorldRoute(a, null), []);
  }
  const preview = {
    request: { sceneId: 'group', mapId: 'world' },
    route: [
      { q: 7, r: 2 },
      { q: 8, r: 2 },
    ],
  };
  assert.equal(atlasWorldRoute(a, preview), preview.route);
  assert.deepEqual(
    atlasWorldRoute(a, {
      ...preview,
      request: { ...preview.request, sceneId: 'old' },
    }),
    [],
  );
  assert.deepEqual(
    atlasWorldRoute(a, {
      ...preview,
      request: { ...preview.request, mapId: 'missing' },
    }),
    [],
  );
  a.scene = null;
  assert.deepEqual(atlasWorldRoute(a, preview), []);
});
