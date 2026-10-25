import { visualPlayerFrame } from '../src/app/player-frame';
import type { BrowserWindow, Rectangle } from 'electron';
import type { PlayerFrame, PlayerSettings } from '../src/app/player-contracts';
export interface PlayerDisplayState {
  owner: { id: string; token: string };
  settings: PlayerSettings;
  frame: PlayerFrame;
}
interface Options {
  current: () => PlayerDisplayState | null | Promise<PlayerDisplayState | null>;
  create: () => BrowserWindow;
  origin: string;
  layout: (settings: PlayerSettings) => { bounds: Rectangle; fullscreen: boolean };
  closed: (token: string) => void | Promise<void>;
  stopping: () => boolean;
  error: (error: unknown) => void;
}
interface Entry {
  window: BrowserWindow;
  owner: PlayerDisplayState['owner'];
  ready: boolean;
  shown: boolean;
  retired: boolean;
  fingerprint: string;
  layout: string;
}
const blank: PlayerFrame = { mode: 'blank', title: '' };
/** Own each native instance independently of pending loads and late close events. */
export class PlayerDisplay {
  private active: Entry | null = null;
  private instances = new Set<Entry>();
  private generation = 0;
  private stopped = false;
  private refresh = 0;
  constructor(private options: Options) {}
  get window() {
    return this.active && !this.active.window.isDestroyed() ? this.active.window : null;
  }
  private sameOwner(state: PlayerDisplayState, entry: Entry) {
    return state.owner.id === entry.owner.id && state.owner.token === entry.owner.token;
  }
  private emit(entry: Entry, frame: PlayerFrame) {
    if (entry.window.isDestroyed()) return;
    frame = visualPlayerFrame(frame);
    const fingerprint = JSON.stringify(frame);
    if (fingerprint === entry.fingerprint) return;
    try {
      entry.window.webContents.send('player:frame-update', {
        generation: ++this.generation,
        frame,
      });
      entry.fingerprint = fingerprint;
    } catch (error) {
      this.options.error(error);
    }
  }
  private retire(entry: Entry) {
    entry.retired = true;
    if (this.active === entry) this.active = null;
    this.emit(entry, blank);
    if (entry.window.isDestroyed()) return;
    try {
      entry.window.hide();
    } catch (error) {
      this.options.error(error);
    }
    try {
      entry.window.close();
    } catch (error) {
      this.options.error(error);
    }
  }
  private open(state: PlayerDisplayState) {
    const window = this.options.create(),
      entry: Entry = {
        window,
        owner: { ...state.owner },
        ready: false,
        shown: false,
        retired: false,
        fingerprint: '',
        layout: '',
      };
    this.active = entry;
    this.instances.add(entry);
    window.on('closed', async () => {
      this.instances.delete(entry);
      if (entry.retired || this.active !== entry) return;
      this.active = null;
      const refresh = ++this.refresh;
      if (this.stopped || this.options.stopping()) return;
      try {
        const current = await this.options.current();
        if (
          !this.stopped &&
          !this.options.stopping() &&
          refresh === this.refresh &&
          !this.active &&
          current &&
          this.sameOwner(current, entry)
        )
          await this.options.closed(entry.owner.token);
      } catch (error) {
        this.options.error(error);
      }
    });
    // Do not retain settings or the global window reference across the asynchronous load.
    void window
      .loadURL(this.options.origin)
      .then(() => {
        if (this.stopped || entry.retired || this.active !== entry || window.isDestroyed()) return;
        entry.ready = true;
        void this.sync();
      })
      .catch((error) => {
        if (this.stopped || entry.retired || this.active !== entry) return;
        this.retire(entry);
        this.options.error(error);
      });
  }
  async sync() {
    if (this.stopped) return;
    const refresh = ++this.refresh;
    try {
      const state = await this.options.current();
      if (this.stopped || refresh !== this.refresh) return;
      if (
        this.active &&
        (!state || !state.settings.windowOpen || !this.sameOwner(state, this.active))
      )
        this.retire(this.active);
      if (!state?.settings.windowOpen) return;
      if (!this.active) this.open(state);
      const entry = this.active!;
      if (!entry.ready || entry.window.isDestroyed()) return;
      const layout = this.options.layout(state.settings),
        fingerprint = JSON.stringify(layout);
      if (fingerprint !== entry.layout) {
        entry.window.setFullScreen(false);
        entry.window.setBounds(layout.bounds);
        entry.window.setFullScreen(layout.fullscreen);
        entry.layout = fingerprint;
      }
      this.emit(entry, state.frame);
      if (!entry.shown) {
        entry.window.showInactive();
        entry.shown = true;
      }
    } catch (error) {
      if (this.stopped || refresh !== this.refresh) return;
      if (this.active) this.retire(this.active);
      this.options.error(error);
    }
  }
  async frame() {
    const entry = this.active,
      generation = ++this.generation;
    try {
      const state = await this.options.current();
      return {
        generation,
        frame:
          !this.stopped &&
          this.active === entry &&
          this.active &&
          !this.active.window.isDestroyed() &&
          state &&
          state.settings.windowOpen &&
          this.sameOwner(state, this.active)
            ? visualPlayerFrame(state.frame)
            : blank,
      };
    } catch (error) {
      this.options.error(error);
      return { generation, frame: blank };
    }
  }
  shutdown() {
    this.stopped = true;
    this.refresh++;
    for (const entry of this.instances) this.retire(entry);
  }
}
