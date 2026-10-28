import { parseHTML } from './dom.mjs';
import { readWorkspaceMarkup } from '../../tools/desktop-markup.mjs';

/** Full production composition and markup; only browser platform services and
 * preload capabilities are supplied by the test. No private state is rebuilt. */
export function mountAtlasWorkbench(t, Workbench, capabilities = {}, overrides = {}) {
  const names = [
    'document',
    'Event',
    'CustomEvent',
    'window',
    'HTMLElement',
    'MutationObserver',
    'ResizeObserver',
    'localStorage',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'Option',
  ];
  const saved = new Map(names.map((name) => [name, global[name]]));
  const { document, window } = parseHTML(readWorkspaceMarkup());
  Object.assign(global, {
    document,
    window,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    HTMLElement: window.HTMLElement,
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    localStorage: { getItem: () => null, setItem() {} },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    Option: function (text, value) {
      const option = document.createElement('option');
      option.textContent = text;
      option.value = value;
      return option;
    },
  });
  const matches = window.HTMLElement.prototype.matches;
  window.HTMLElement.prototype.matches = function (selector) {
    return selector === ':popover-open' ? false : matches.call(this, selector);
  };
  window.HTMLElement.prototype.scrollTo = function () {};
  window.HTMLElement.prototype.close = function () {
    this.open = false;
  };
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return this._value ?? this.querySelector('option')?.value ?? '';
    },
    set(value) {
      this._value = value;
    },
  });
  window.HTMLSelectElement.prototype.add = function (option) {
    this.append(option);
  };
  window.HTMLCanvasElement.prototype.getContext = () => null;
  Object.defineProperty(window.HTMLCanvasElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 1024,
  });
  Object.defineProperty(window.HTMLCanvasElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 768,
  });
  // World normally mounts this legacy surface before Atlas construction.
  const worldMap = document.createElement('svg');
  worldMap.id = 'world-map';
  const worldRecovery = document.createElement('div');
  worldRecovery.id = 'world-write-recovery';
  document.body.append(worldMap, worldRecovery);
  window.campaign = { cancelAtlasRegion() {}, ...capabilities };
  const statuses = [];
  const atlas = new Workbench({
    world: {},
    flush: async () => true,
    selectRoom: async () => {},
    roomDraft: () => null,
    updated: async () => {},
    status: (...args) => statuses.push(args),
    ...overrides,
  });
  t.after(() => {
    atlas.hide();
    for (const [name, value] of saved)
      value === undefined ? delete global[name] : (global[name] = value);
  });
  return { atlas, document, window, statuses };
}
