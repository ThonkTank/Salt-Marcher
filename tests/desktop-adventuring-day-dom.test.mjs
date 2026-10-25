import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from './helpers/dom.mjs';

buildSync({
  stdin: {
    contents:
      "export * from './src/app/adventuring-day-ui';export {calculateDay} from './src/app/adventuring-day-model';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  outfile: '.build/adventuring-day-dom.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  tick = () => new Promise((resolve) => setImmediate(resolve));
const settled = () => new Promise((resolve) => setTimeout(resolve, 160));
function fixture(t) {
  const previous = { window: globalThis.window, document: globalThis.document },
    dom = parseHTML(readFileSync('src/app/index.html', 'utf8'));
  Object.assign(globalThis, { window: dom.window, document: dom.document });
  delete require.cache[require.resolve('../.build/adventuring-day-dom.cjs')];
  const ui = require('../.build/adventuring-day-dom.cjs'),
    get = (id) => dom.document.getElementById('day-' + id),
    calls = [];
  const saved = new Map();
  dom.window.localStorage = {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: (key) => saved.delete(key),
  };
  dom.window.innerWidth = 1000;
  dom.window.innerHeight = 800;
  get('trigger').getBoundingClientRect = () => ({
    left: 700,
    right: 800,
    top: 20,
    bottom: 60,
    width: 100,
    height: 40,
  });
  let open = false;
  get('popover').matches = () => open;
  get('popover').showPopover = () => {
    open = true;
  };
  get('popover').hidePopover = () => {
    open = false;
  };
  dom.window.campaign = {
    adventuringDay: async (_token, request) => {
      calls.push(structuredClone(request));
      let calculation = null,
        problem = null;
      try {
        calculation = ui.calculateDay(
          request.source === 'active' ? [{ level: 1, count: 1 }] : request.rows,
          request.totalXp,
          request.rewardXp,
        );
      } catch (error) {
        problem = error.message;
      }
      return {
        ok: true,
        value: {
          snapshot: {
            available: true,
            partySize: 1,
            averageLevel: 1,
            dailyBudget: 300,
            shortXp: 0,
            longXp: 0,
            reason: 'Aktuelle Party',
            rows: [{ level: 1, count: 1 }],
            members: [],
          },
          calculation,
          problem,
        },
      };
    },
  };
  ui.initDayCalculator(
    () => {},
    () => {},
  );
  ui.activateDayCalculator({ token: 'owner', campaign: { id: 'campaign-a' } });
  t.after(() => {
    ui.activateDayCalculator(null);
    Object.assign(globalThis, previous);
  });
  const input = (element, value) => {
    element.value = value;
    if (element.oninput) element.oninput();
    else element.dispatchEvent(new dom.window.Event('input'));
  };
  return {
    get,
    calls,
    input,
    ui,
    saved,
    open: async () => {
      await tick();
      get('trigger').onclick();
      await tick();
    },
  };
}
test('unfinished custom rows keep their exact text when another row is added or removed', async (t) => {
  const x = fixture(t);
  await x.open();
  const [level, count] = x.get('rows').querySelectorAll('input');
  x.input(level, '01');
  x.input(count, '');
  x.get('add').onclick();
  assert.deepEqual(
    [...x.get('rows').querySelectorAll('input')].map((e) => e.value),
    ['01', '', '1', '1'],
  );
  x.get('rows').lastElementChild.querySelector('button').onclick();
  assert.deepEqual(
    [...x.get('rows').querySelectorAll('input')].map((e) => e.value),
    ['01', ''],
  );
  await settled();
  assert.equal(x.get('summary').children.length, 0);
  assert.match(x.get('status').textContent, /Zeilen/);
  x.input(x.get('rows').querySelectorAll('input')[1], '2');
  await settled();
  assert.equal(x.calls.at(-1).rows[0].count, 2);
  assert.match(x.get('summary').textContent, /600 XP Tagesbudget/);
});

test('campaign-local planning restores exact inputs, itinerary order, rests and manual XP without accepting new template revisions', async (t) => {
  const x = fixture(t);
  await x.open();
  const [level, count] = x.get('rows').querySelectorAll('input');
  x.input(level, '03');
  x.input(count, '4');
  x.get('mode-progress').onclick();
  x.input(x.get('total-xp'), '1600');
  x.get('separate-reward').checked = true;
  x.input(x.get('separate-reward'), 'on');
  x.input(x.get('reward-xp'), '800');
  window.campaign.encounterPlans = async () => ({
    ok: true,
    value: [
      { id: 'patrol', revision: 1, name: 'Patrouille' },
      { id: 'ambush', revision: 2, name: 'Hinterhalt' },
    ],
  });
  x.get('use-encounters').checked = true;
  x.get('use-encounters').onchange();
  await tick();
  const choices = x.get('plan-matches').querySelectorAll('button');
  choices[0].onclick();
  choices[1].onclick();
  x.input(x.get('plan-selected').querySelector('input'), '3');
  const rest = x.get('plan-selected').lastElementChild.querySelector('select');
  Object.defineProperty(rest, 'value', { configurable: true, writable: true, value: 'short' });
  rest.onchange();
  x.get('plan-selected').lastElementChild.querySelector('button').onclick();
  await settled();
  assert.match(x.get('draft-status').textContent, /gesichert/);
  const raw = [...x.saved.values()][0];
  assert.equal(JSON.parse(raw).itinerary.manual.load, '1600');
  assert.equal(JSON.parse(raw).itinerary.manual.reward, '800');
  // Reactivation changes the runtime token, discards module state and rereads storage.
  x.ui.activateDayCalculator({ token: 'other', campaign: { id: 'campaign-b' } });
  assert.equal(x.get('summary').children.length, 0);
  await x.open();
  assert.match(x.get('source').textContent, /Aktive Party/);
  assert.equal(x.get('use-encounters').checked, false);
  assert.equal(x.get('plan-selected').querySelectorAll('input').length, 0);
  window.campaign.encounterPlans = async () => ({
    ok: true,
    value: [
      { id: 'patrol', revision: 9, name: 'Patrouille neu' },
      { id: 'ambush', revision: 8, name: 'Hinterhalt neu' },
    ],
  });
  x.ui.activateDayCalculator({ token: 'fresh', campaign: { id: 'campaign-a' } });
  await x.open();
  assert.deepEqual(
    [...x.get('rows').querySelectorAll('input')].map((e) => e.value),
    ['03', '4'],
  );
  assert.equal(x.get('mode-progress').getAttribute('aria-pressed'), 'true');
  assert.equal(x.get('use-encounters').checked, true);
  assert.deepEqual(x.calls.at(-1).encounters, [
    { id: 'ambush', revision: 2, count: 1, restBefore: 'short' },
    { id: 'patrol', revision: 1, count: 3 },
  ]);
  assert.match(x.get('plan-matches').textContent, /Patrouille neu/);
  assert.equal(
    [...x.saved.values()][0],
    raw,
    'opening/searching must not overwrite the saved basis',
  );
  x.get('use-encounters').checked = false;
  x.get('use-encounters').onchange();
  assert.equal(x.get('total-xp').value, '1600');
  assert.equal(x.get('reward-xp').value, '800');
  assert.equal(x.get('separate-reward').checked, true);
  x.get('draft-reset').onclick();
  await tick();
  assert.equal(x.saved.size, 0);
  assert.match(x.get('source').textContent, /Aktive Party/);
  assert.equal(x.get('mode-budget').getAttribute('aria-pressed'), 'true');
});

test('new searches revoke old encounter choices immediately while keeping the selected plan', async (t) => {
  const x = fixture(t);
  await x.open();
  window.campaign.encounterPlans = async () => ({
    ok: true,
    value: [{ id: 'patrol', revision: 1, name: 'Patrouille' }],
  });
  x.get('use-encounters').checked = true;
  x.get('use-encounters').onchange();
  await tick();
  const old = x.get('plan-matches').querySelector('button');
  old.onclick();
  x.input(x.get('plan-selected').querySelector('input'), '03');
  let finish;
  window.campaign.encounterPlans = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  x.input(x.get('plan-search'), 'Hinterhalt');
  assert.equal(
    x.get('plan-matches').children.length,
    0,
    'old choices must disappear before the debounce starts',
  );
  old.onclick();
  assert.equal(
    x.get('plan-selected').querySelectorAll('input').length,
    1,
    'a revoked choice cannot append another row',
  );
  await settled();
  assert.equal(x.get('plan-matches').getAttribute('aria-busy'), 'true');
  assert.equal(x.get('plan-selected').querySelector('input').value, '03');
  finish({ ok: true, value: [{ id: 'ambush', revision: 2, name: 'Hinterhalt' }] });
  await tick();
  assert.equal(x.get('plan-matches').getAttribute('aria-busy'), 'false');
  x.get('plan-matches').querySelector('button').onclick();
  await settled();
  assert.deepEqual(x.calls.at(-1).encounters, [
    { id: 'patrol', revision: 1, count: 3 },
    { id: 'ambush', revision: 2, count: 1 },
  ]);
});

test('a failed explicit template refresh revokes old choices, preserves selected revisions and can be retried', async (t) => {
  const x = fixture(t);
  await x.open();
  window.campaign.encounterPlans = async () => ({
    ok: true,
    value: [{ id: 'patrol', revision: 1, name: 'Patrouille' }],
  });
  x.get('use-encounters').checked = true;
  x.get('use-encounters').onchange();
  await tick();
  const old = x.get('plan-matches').querySelector('button');
  old.onclick();
  let finish;
  window.campaign.encounterPlans = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  x.get('plan-reload').onclick();
  assert.equal(x.get('plan-matches').children.length, 0);
  old.onclick();
  assert.equal(x.get('plan-selected').querySelectorAll('input').length, 1);
  finish({ ok: false, error: 'Vorlagenablage offline' });
  await tick();
  assert.match(x.get('plan-search-status').textContent, /offline/);
  assert.equal(x.get('plan-matches').getAttribute('aria-busy'), 'false');
  await settled();
  assert.equal(x.calls.at(-1).encounters[0].revision, 1);
  window.campaign.encounterPlans = async () => ({
    ok: true,
    value: [{ id: 'patrol', revision: 4, name: 'Patrouille neu' }],
  });
  x.get('plan-reload').onclick();
  await tick();
  await settled();
  assert.equal(x.calls.at(-1).encounters[0].revision, 4);
  assert.equal(x.get('plan-matches').getAttribute('aria-busy'), 'false');
  assert.match(x.get('plan-selected').textContent, /Patrouille neu/);
});

test('late search answers cannot reopen obsolete choices after a newer search or campaign switch', async (t) => {
  const x = fixture(t);
  await x.open();
  const pending = [];
  window.campaign.encounterPlans = (token, query) =>
    new Promise((resolve) => pending.push({ token, query, resolve }));
  x.get('use-encounters').checked = true;
  x.get('use-encounters').onchange();
  x.input(x.get('plan-search'), 'neu');
  await settled();
  assert.equal(pending.length, 2);
  pending[0].resolve({ ok: true, value: [{ id: 'old', revision: 1, name: 'Alter Treffer' }] });
  await tick();
  assert.equal(x.get('plan-matches').children.length, 0);
  assert.equal(x.get('plan-matches').getAttribute('aria-busy'), 'true');
  pending[1].resolve({ ok: true, value: [{ id: 'new', revision: 2, name: 'Neuer Treffer' }] });
  await tick();
  const choice = x.get('plan-matches').querySelector('button');
  assert.match(choice.textContent, /Neuer Treffer/);
  x.input(x.get('plan-search'), 'noch später');
  await settled();
  x.ui.activateDayCalculator({ token: 'b', campaign: { id: 'campaign-b' } });
  await x.open();
  pending[2].resolve({ ok: true, value: [{ id: 'late', revision: 3, name: 'Falsche Kampagne' }] });
  await tick();
  choice.onclick();
  assert.equal(x.get('plan-matches').children.length, 0);
  assert.equal(x.get('plan-matches').getAttribute('aria-busy'), 'false');
  assert.equal(x.get('plan-selected').querySelectorAll('input').length, 0);
  assert.equal(x.saved.has('dungeon-editor:day-draft:v1:campaign-b'), false);
});

test('damaged drafts remain untouched and persistence failures never claim a saved plan', async (t) => {
  const x = fixture(t);
  await x.open();
  const key = 'dungeon-editor:day-draft:v1:campaign-a';
  x.saved.set(key, '{broken');
  x.ui.activateDayCalculator({ token: 'fresh', campaign: { id: 'campaign-a' } });
  await x.open();
  assert.match(x.get('draft-status').textContent, /nicht lesbar/);
  x.input(x.get('rows').querySelector('input'), '3');
  assert.equal(x.saved.get(key), '{broken');
  const remove = window.localStorage.removeItem;
  window.localStorage.removeItem = () => {
    throw new Error('Storage unavailable');
  };
  x.get('draft-reset').onclick();
  assert.equal(x.saved.get(key), '{broken');
  assert.match(x.get('draft-status').textContent, /nicht zurückgesetzt/);
  window.localStorage.removeItem = remove;
  x.get('draft-reset').onclick();
  await tick();
  assert.equal(x.saved.has(key), false);
  window.localStorage.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  x.input(x.get('rows').querySelector('input'), '3');
  await settled();
  assert.match(x.get('draft-status').textContent, /nicht gesichert/);
  assert.match(x.get('summary').textContent, /1.200 XP Tagesbudget/);
});

test('an unfinished field survives reactivation without becoming a calculated zero', async (t) => {
  const x = fixture(t);
  await x.open();
  x.input(x.get('rows').querySelector('input'), '3');
  x.input(x.get('rows').querySelectorAll('input')[1], '');
  x.ui.activateDayCalculator({ token: 'fresh', campaign: { id: 'campaign-a' } });
  await x.open();
  assert.equal(x.get('rows').querySelectorAll('input')[1].value, '');
  assert.equal(x.get('summary').children.length, 0);
  assert.match(x.get('status').textContent, /Zeilen/);
});

test('choosing a level reward preserves that manual planning input across reactivation', async (t) => {
  const x = fixture(t),
    read = window.campaign.adventuringDay;
  window.campaign.adventuringDay = async (...args) => {
    const result = await read(...args);
    result.value.advancement = {
      atMaximum: 0,
      reached: [],
      next: [
        {
          level: 4,
          groupXp: 7200,
          shareXp: 1800,
          missingGroupXp: 7200,
          members: [{ name: 'Level 3', count: 4 }],
          stage: null,
        },
      ],
    };
    return result;
  };
  await x.open();
  x.input(x.get('rows').querySelector('input'), '3');
  x.input(x.get('rows').querySelectorAll('input')[1], '4');
  await settled();
  x.get('levels').querySelector('li button').onclick();
  await settled();
  assert.equal(x.get('reward-xp').value, '7200');
  assert.equal(x.get('separate-reward').checked, true);
  assert.match(x.get('draft-status').textContent, /gesichert/);
  x.ui.activateDayCalculator({ token: 'fresh', campaign: { id: 'campaign-a' } });
  await x.open();
  assert.equal(x.get('reward-xp').value, '7200');
  assert.equal(x.get('total-xp').value, '0');
  assert.equal(x.get('mode-progress').getAttribute('aria-pressed'), 'true');
});

test('mixed-level planning stays independent of live Party warnings and survives popup reopening', async (t) => {
  const x = fixture(t);
  await x.open();
  const [level, count] = x.get('rows').querySelectorAll('input');
  x.input(level, '3');
  x.input(count, '2');
  x.get('add').onclick();
  const second = x.get('rows').lastElementChild.querySelectorAll('input');
  x.input(second[0], '4');
  x.input(second[1], '2');
  await settled();
  assert.match(x.get('source').textContent, /Eigene Planung/);
  assert.equal(x.get('status').textContent, '');
  assert.equal(x.get('pacing').hidden, true);
  assert.equal(x.get('current-details').hidden, true);
  assert.match(x.get('summary').textContent, /4 Figuren.*5.800 XP Tagesbudget/);
  assert.match(x.get('summary').textContent, /1.934.*3.867.*5.800/);
  assert.equal(x.get('rows').querySelector('input').closest('label').textContent, 'Level');
  const children = [...x.get('popover').querySelectorAll('*')];
  assert.ok(children.indexOf(x.get('rows')) < children.indexOf(x.get('results')));
  x.get('mode-progress').onclick();
  x.input(x.get('total-xp'), '5800');
  x.get('separate-reward').checked = true;
  x.input(x.get('separate-reward'), 'on');
  x.input(x.get('reward-xp'), '4000');
  await settled();
  assert.match(x.get('summary').textContent, /1 volle Tage.*2 kurze \/ 1 lange/);
  assert.match(x.get('summary').textContent, /1.000 XP je Figur/);
  x.get('close').onclick();
  x.get('trigger').onclick();
  await tick();
  assert.equal(x.get('total-xp').value, '5800');
  assert.deepEqual(
    [...x.get('rows').querySelectorAll('input')].map((e) => e.value),
    ['3', '2', '4', '2'],
  );
  x.get('active').onclick();
  await tick();
  assert.equal(x.get('pacing').hidden, false);
  assert.equal(x.get('current-details').hidden, false);
  assert.match(x.get('status').textContent, /Aktuelle Party/);
});

test('pending calculation retains presentation geometry, and a failed read removes stale answers', async (t) => {
  const x = fixture(t);
  await x.open();
  const prior = x.get('summary').textContent;
  let reply;
  window.campaign.adventuringDay = () =>
    new Promise((resolve) => {
      reply = resolve;
    });
  x.input(x.get('rows').querySelector('input'), '3');
  assert.equal(x.get('popover').getAttribute('aria-busy'), 'true');
  assert.equal(x.get('summary').textContent, prior);
  await settled();
  reply({ ok: false, error: 'Lesen unterbrochen' });
  await tick();
  assert.equal(x.get('popover').getAttribute('aria-busy'), 'false');
  assert.equal(x.get('summary').children.length, 0);
  assert.match(x.get('status').textContent, /Lesen unterbrochen/);
});

test('comparing the active party preserves custom rows even when reactivated in active mode', async (t) => {
  const x = fixture(t);
  await x.open();
  const custom = x.get('custom');
  assert.ok(custom, 'own planning has a direct return action');
  const [level, count] = x.get('rows').querySelectorAll('input');
  x.input(level, '04');
  x.input(count, '5');
  await settled();
  assert.match(x.get('summary').textContent, /5 Figuren.*8.500 XP Tagesbudget/);
  x.get('active').onclick();
  await tick();
  assert.equal(x.calls.at(-1).source, 'active');
  assert.equal(x.get('active').getAttribute('aria-pressed'), 'true');
  x.ui.activateDayCalculator({ token: 'fresh', campaign: { id: 'campaign-a' } });
  await x.open();
  assert.match(x.get('source').textContent, /Aktive Party/);
  custom.onclick();
  await settled();
  assert.deepEqual(
    [...x.get('rows').querySelectorAll('input')].map((e) => e.value),
    ['04', '5'],
  );
  assert.match(x.get('summary').textContent, /8.500 XP Tagesbudget/);
  assert.equal(custom.getAttribute('aria-pressed'), 'true');
  assert.equal(x.get('active').getAttribute('aria-pressed'), 'false');
  // An intentionally unfinished or empty comparison is a draft too.
  x.input(x.get('rows').querySelectorAll('input')[1], '');
  x.get('active').onclick();
  await tick();
  custom.onclick();
  await settled();
  assert.equal(x.get('rows').querySelectorAll('input')[1].value, '');
  assert.equal(x.get('summary').children.length, 0);
  x.get('clear').onclick();
  x.get('active').onclick();
  await tick();
  x.ui.activateDayCalculator({ token: 'fresh2', campaign: { id: 'campaign-a' } });
  await x.open();
  custom.onclick();
  await settled();
  assert.equal(x.get('rows').children.length, 0);
});

test('custom comparison rows remain campaign-local and reset returns to a fresh active-party copy', async (t) => {
  const x = fixture(t);
  await x.open();
  const custom = x.get('custom');
  assert.ok(custom);
  x.input(x.get('rows').querySelector('input'), '4');
  x.input(x.get('rows').querySelectorAll('input')[1], '5');
  x.get('active').onclick();
  await tick();
  x.ui.activateDayCalculator({ token: 'other', campaign: { id: 'campaign-b' } });
  await x.open();
  custom.onclick();
  await settled();
  assert.deepEqual(
    [...x.get('rows').querySelectorAll('input')].map((e) => e.value),
    ['1', '1'],
  );
  x.ui.activateDayCalculator({ token: 'back', campaign: { id: 'campaign-a' } });
  await x.open();
  custom.onclick();
  await settled();
  assert.equal(x.get('rows').querySelector('input').value, '4');
  x.get('draft-reset').onclick();
  await tick();
  custom.onclick();
  await settled();
  assert.deepEqual(
    [...x.get('rows').querySelectorAll('input')].map((e) => e.value),
    ['1', '1'],
  );
});

// The primary answer precedes reference tables while all figures remain available.
test('progress answer comes before rest thresholds and scrolling number fields preserves typed values', async (t) => {
  const x = fixture(t);
  await x.open();
  x.get('mode-progress').onclick();
  x.input(x.get('total-xp'), '300');
  await settled();
  const summary = x.get('summary'),
    progress = x.get('progress-summary');
  assert.match(progress.textContent, /1 volle Tage/);
  const elements = [...summary.querySelectorAll('*')];
  assert.ok(elements.indexOf(progress) < elements.indexOf(summary.querySelector('table')));
  const field = x.get('total-xp');
  let blurred = 0;
  Object.defineProperty(document, 'activeElement', { configurable: true, value: field });
  field.blur = () => {
    blurred++;
  };
  const wheel = new window.Event('wheel', { bubbles: true, cancelable: true });
  field.dispatchEvent(wheel);
  assert.equal(blurred, 1);
  assert.equal(field.value, '300');
  assert.equal(wheel.defaultPrevented, false, 'native scrolling remains available');
});

test('an immediate party refresh consumes queued editing work instead of reading the same basis twice', async (t) => {
  const x = fixture(t);
  await x.open();
  x.input(x.get('rows').querySelector('input'), '4');
  const before = x.calls.length;
  x.get('active').onclick();
  await tick();
  assert.equal(x.calls.length, before + 1, 'explicit refresh reads immediately');
  await settled();
  assert.equal(
    x.calls.length,
    before + 1,
    'the superseded editing timer must not launch another read',
  );
  assert.equal(x.calls.at(-1).source, 'active');
  x.get('custom').onclick();
  await settled();
  assert.equal(
    x.get('rows').querySelector('input').value,
    '4',
    'the custom draft survives the active-party comparison',
  );
});

test('reopening consumes a queued recalculation without retrying a failed fresh read in the background', async (t) => {
  const x = fixture(t);
  await x.open();
  x.input(x.get('rows').querySelector('input'), '3');
  x.get('close').onclick();
  let reads = 0;
  window.campaign.adventuringDay = async () => {
    reads++;
    return { ok: false, error: 'Gezielter Lesefehler' };
  };
  x.get('trigger').onclick();
  await tick();
  assert.equal(reads, 1);
  await settled();
  assert.equal(reads, 1, 'an explicit failed refresh must stay failed until a new user action');
  assert.match(x.get('status').textContent, /Gezielter Lesefehler/);
  assert.equal(x.get('rows').querySelector('input').value, '3');
});
