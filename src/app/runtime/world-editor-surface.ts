import type { Result } from '../shared/contracts';
import { EditorSession } from '../shared/editor-session';
import { createEditorSurface } from '../shared/editor-surface';
import { liveHexSurface,type LiveAtlasSurface } from './live-hex-surface';
import type { WorldAck,WorldCommand } from './world-contracts';
export interface WorldEditorHost {
  roots: readonly HTMLElement[];
  api: Window['campaign'];
  syncScene: (token: string, sceneId: string) => void;
  status: (text: string, error?: boolean) => void;
  before: () => Promise<boolean>;
  after: () => Promise<void>;
  enter: () => Promise<void>;
  camp: (sceneId: string, kind: 'wait' | 'rest') => Promise<void>;
  write: (command: WorldCommand) => Promise<Result<WorldAck>>;
  settle: (command: WorldCommand) => void;
  changed: (event: 'atlas-draft' | 'atlas-runtime') => void;
  atlasSurface?: () => LiveAtlasSurface | null;
}
/** Immutable native and DOM ports. Mutable editor data belongs to the five owners. */
export class WorldEditorSurface {
  readonly editorSession = new EditorSession();
  readonly surface: ReturnType<typeof createEditorSurface>;
  readonly document: Document;
  readonly api: Window['campaign'];
  private readonly roots = new Set<HTMLElement>();
  readonly cleanups: (() => void)[] = [];
  constructor(readonly host: WorldEditorHost) {
    this.surface = createEditorSurface(host.roots);
    for (const root of host.roots) this.roots.add(root);
    this.document = this.surface.document;
    this.api = host.api;
  }
  el = <T extends HTMLElement>(id: string): T => this.surface.get<T>(id);
  register = (root: HTMLElement) => {
    this.roots.add(root);
    this.surface.register(root);
  };
  query = <T extends HTMLElement>(selector: string): T | null => {
    for (const root of this.roots) {
      const found = root.matches(selector) ? root : root.querySelector<T>(selector);
      if (found) return found as T;
    }
    return null;
  };
  dialogOpen = () => !!this.query('dialog[open]');
  liveSurface = () =>
    liveHexSurface({
      document: this.document,
      get: this.el,
      query: this.query,
      atlas: () => this.host.atlasSurface?.() ?? null,
    });
  listen = (
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
  ) => {
    target.addEventListener(type, listener, options);
    this.cleanups.push(() => target.removeEventListener(type, listener, options));
  };
  syncScene = (token: string, sceneId: string) => this.host.syncScene(token, sceneId);
  write = (command: WorldCommand) => this.host.write(command);
  settle = (command: WorldCommand) => this.host.settle(command);
  changed = (event: 'atlas-draft' | 'atlas-runtime') => this.host.changed(event);
  value = (id: string) => this.el<HTMLInputElement>(id).value;
  unwrap = <T>(r: Result<T>): T => {
    if (!r.ok) throw new Error(r.error);
    return r.value;
  };
  svg = (tag: string) => this.document.createElementNS('http://www.w3.org/2000/svg', tag);
  tell = (text: string, error?: boolean) => this.host.status(text, error);
  before = () => this.host.before();
  after = () => this.host.after();
  enter = () => this.host.enter();
  camp = (sceneId: string, kind: 'wait' | 'rest') => this.host.camp(sceneId, kind);
  option = (s: HTMLSelectElement, id: string, name: string) => {
    const o = this.document.createElement('option');
    o.value = id;
    o.textContent = name;
    s.append(o);
  };
  button = (label: string, action: () => Promise<unknown> | void) => {
    const b = this.document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.onclick = () => this.run(action);
    return b;
  };
  run = (fn: () => Promise<unknown> | void) => {
    void Promise.resolve()
      .then(fn)
      .catch((error) => this.tell(error.message, true));
  };
  number = (id: string) => {
    const v = Number(this.value(id));
    if (!Number.isFinite(v)) throw new Error('Zahl prüfen: ' + id);
    return v;
  };
}
