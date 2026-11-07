import { readWorkspaceMarkup } from '../../tools/desktop-markup.mjs';
import { createRequire } from 'node:module';
import { buildSync } from './build.mjs';
import { parseHTML } from './dom.mjs';
import { freshFixtureModule } from './fixture-lifecycle.mjs';
const bundle = `.build/session-owners-${process.pid}.cjs`;
buildSync({
  stdin: {
    contents:
      "export {createLiveSessionReaders} from './src/app/runtime/live-session-readers'; export {createLiveSessionResumeUI} from './src/app/runtime/live-session-resume-ui'; export {createLiveSessionCloseUI} from './src/app/runtime/live-session-close-ui';",
    resolveDir: process.cwd(),
    sourcefile: 'session-owners.ts',
  },
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url);
const tick = () => new Promise((r) => setImmediate(r));
export async function settle() {
  for (let i = 0; i < 10; i++) await tick();
}
export const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
export const ok = (value) => ({ ok: true, value: structuredClone(value) });
export function fixture(t) {
  const { window, document } = parseHTML(readWorkspaceMarkup()),
    prior = Object.fromEntries(
      ['window', 'document', 'setTimeout', 'clearTimeout', 'Event', 'Option'].map((k) => [
        k,
        globalThis[k],
      ]),
    );
  Object.assign(globalThis, {
    window,
    document,
    setTimeout: () => 0,
    clearTimeout: () => {},
    Event: window.Event,
  });
  // These controls are mounted by owners outside the three factories under test.
  const messages = [],
    planControl = document.createElement('select');
  planControl.id = 'live-session-plan';
  document.getElementById('live').append(planControl);
  for (const s of document.querySelectorAll('select'))
    Object.defineProperty(s, 'value', { value: '', writable: true });
  globalThis.Option = function (text = '', value = '') {
    const o = document.createElement('option');
    o.textContent = text;
    o.value = value;
    return o;
  };
  const w = { token: 'token', campaign: { id: 'campaign' } },
    scene = {
      id: 'scene',
      revision: 1,
      title: 'Vorhut',
      notes: '',
      readAloud: 'Bisheriger Text',
      locationId: null,
      membershipRevision: 1,
      clock: { epochId: 'epoch', instantMs: '0', revision: 0 },
      members: [],
      adoption: null,
    },
    v = {
      scene,
      scenes: [{ ...scene, primary: true, members: 0 }],
      roster: [],
      focusId: 'scene',
      focusRevision: 1,
    },
    plans = Array.from({ length: 30 }, (_, i) => ({
      id: 'plan-' + i,
      name: 'Plan ' + i,
      revision: 1,
      scenes: [{ id: 'visit-' + i, title: 'Besuch ' + i }],
    })),
    calls = [],
    packet = {
      planId: 'plan-0',
      planRevision: 1,
      basis: 'basis-1',
      visits: [
        {
          id: 'visit-0',
          title: 'Besuch 0',
          blocks: [{ kind: 'read-aloud', heading: 'Eröffnung', text: '  Vorgelesen\r\n- Mantel' }],
        },
      ],
    };
  const packetVisits = document.createElement('div');
  packetVisits.id = 'session-packet-visits';
  document.getElementById('live').append(packetVisits);
  const state = {
    context: w,
    data: v,
    sources: { plans, notes: [] },
    scene: structuredClone(scene),
    sessionChronicle: { entries: [] },
  };
  const callbacks = {
    start: async () => {
      calls.push('start');
      return true;
    },
    flush: async () => true,
    packet: async () => {
      calls.push('packet');
    },
    visit: async () => true,
  };
  window.campaign = {};
  const host = {
    get context() {
      return state.context;
    },
    get data() {
      return state.data;
    },
    get sources() {
      return state.sources;
    },
    get sessionChronicle() {
      return state.sessionChronicle;
    },
    sessionChronicleError: '',
    liveSourcesProblem: '',
    get readAloudText() {
      return state.scene.readAloud;
    },
    useKnowledgeReadAloud(text) {
      state.scene.readAloud = text;
    },
    document,
    window,
    get: (id) => document.getElementById(id),
    value: (id) => document.getElementById(id)?.value ?? '',
    unwrap(result) {
      if (!result.ok) throw new Error(result.error);
      return result.value;
    },
    tell: (text, error) => messages.push({ text, error }),
    dialogHost: document.getElementById('live'),
    groupPeople: () => '',
    flushLive: (...args) => callbacks.flush(...args),
    startLiveSession: (...args) => callbacks.start(...args),
    openLivePacket: (...args) => callbacks.packet(...args),
    openMomentVisit: (...args) => callbacks.visit(...args),
    openPartyRest: async () => {},
    openLive: async () => true,
    partyAward: () => {},
    openExistingCombat: async () => {},
    changeFocus: async () => true,
    openLocationNotebook: async () => {},
    formatSceneInstant: (ms) => ms,
  };
  const { createLiveSessionReaders, createLiveSessionResumeUI, createLiveSessionCloseUI } =
    freshFixtureModule(require, '../../' + bundle);
  const readers = createLiveSessionReaders(host);
  Object.assign(host, readers);
  const close = createLiveSessionCloseUI(host);
  host.openHandoffVisit = close.openHandoffVisit;
  const resume = createLiveSessionResumeUI(host);
  resume.init();
  close.initHandoffVisitDialog();
  const dialog = document.getElementById('live-session-resume-dialog');
  dialog.open = true;
  dialog.close = () => {
    dialog.open = false;
  };
  dialog.showModal = () => {
    dialog.open = true;
  };
  const ui = { ...readers, ...resume };
  const setOwner = (context, data, sources) => {
    Object.assign(state, {
      context,
      data,
      sources,
      scene: structuredClone(data.scene),
      sessionChronicle: { entries: [] },
    });
  };
  const setHistory = (entries) => {
    state.sessionChronicle = { entries };
  };
  const handoffDialog = document.getElementById('handoff-visit-dialog');
  handoffDialog.close = () => {
    handoffDialog.open = false;
  };
  handoffDialog.showModal = () => {
    handoffDialog.open = true;
  };
  const handoffPlan = document.getElementById('handoff-visit-plan');
  let chosenPlan = null;
  Object.defineProperty(handoffPlan, 'value', {
    get() {
      return chosenPlan ?? '';
    },
    set(v) {
      chosenPlan = [...this.options].some((o) => o.value === v) ? v : null;
    },
  });
  Object.defineProperty(handoffPlan, 'selectedIndex', {
    get() {
      return chosenPlan === null ? -1 : [...this.options].findIndex((o) => o.value === chosenPlan);
    },
  });
  handoffPlan.add = (o) => handoffPlan.append(o);
  Object.assign(window.campaign, {
    progress: async () => ok({ characters: [] }),
    scenePreparation: async () => ok({ nextVisit: null }),
    sceneWorld: async () => ok({ notices: [], date: 'Tag 1', scene: { locationId: null } }),
    agenda: async () => ok({ items: [], scene: { instantMs: '0' } }),
    narrativeJournal: async () => ok({ entries: [], counts: { open: 0 } }),
    sessionProgress: async (_, id) => {
      calls.push(id);
      return ok({
        planId: id,
        planRevision: 1,
        visits: [{ id: 'visit-' + id.split('-')[1], title: 'Besuch', focused: null }],
      });
    },
    sessionPacket: async () => ok(packet),
  });
  const row = {
      sceneId: 'scene',
      sceneTitle: 'Vorhut',
      nextVisit: { planId: 'plan-0', planRevision: 1, visitId: 'visit-0', title: 'Besuch 0' },
      packet: packet.visits[0],
      packetBasis: 'basis-1',
      warnings: [],
      fallback: true,
      planName: 'Plan 0',
    },
    audit = { masks: [], treasures: { count: 0, units: 0 }, xpBooked: true, events: 0 };
  const render = () =>
    ui.renderSessionResume(audit, {
      visits: [row],
      worlds: [],
      narratives: { entries: [], counts: { open: 0 } },
      problems: [],
      readiness: [],
      readinessAvailable: true,
      narrativesAvailable: true,
    });
  const start = () => document.querySelector('.session-resume-start');
  t.after(() => Object.assign(globalThis, prior));
  return {
    window,
    document,
    dialog,
    ui,
    state,
    callbacks,
    setOwner,
    setHistory,
    w,
    v,
    plans,
    calls,
    row,
    packet,
    render,
    start,
    messages,
  };
}
