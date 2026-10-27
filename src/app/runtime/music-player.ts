import type { MusicView } from './music-contracts';
export interface PlayerHooks {
  ended: (playbackId: string) => void;
  failed: (assetId: string, playbackId: string, message: string) => void;
  timing: (seconds: number, duration: number) => void;
}
interface AmbienceLayer {
  audio: HTMLAudioElement;
  fade: number | null;
  failed: boolean;
  ready: boolean;
  target: number;
  seconds: number;
  removing: boolean;
  generation: number;
}
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export class LocalAudioPlayer {
  private slots: HTMLAudioElement[] = [];
  private active = 0;
  private playbackId: string | null = null;
  private status = 'stopped';
  private fade: number | null = null;
  private volume = 0.7;
  private mediaGeneration = 0;
  private playGeneration = 0;
  private playPending = false;
  private layers = new Map<string, AmbienceLayer>();
  private readonly root: HTMLElement;
  constructor(
    private hooks: PlayerHooks,
    mount: HTMLElement,
  ) {
    const document = mount.ownerDocument;
    const root = document.createElement('div');
    this.root = root;
    root.dataset.musicAudioRuntime = '';
    root.id = 'music-audio-runtime';
    root.hidden = true;
    for (let i = 0; i < 2; i++) {
      const a = this.root.ownerDocument.createElement('audio');
      a.preload = 'metadata';
      a.dataset.musicSlot = String(i);
      a.ontimeupdate = () => {
        if (this.playbackId && this.slots[this.active] === a)
          this.hooks.timing(a.currentTime, Number.isFinite(a.duration) ? a.duration : 0);
      };
      root.append(a);
      this.slots.push(a);
    }
    mount.append(root);
  }
  dispose() {
    this.reset();
    for (const audio of this.slots) {
      audio.onended = audio.onerror = audio.ontimeupdate = null;
    }
    this.root.remove();
  }
  position() {
    const a = this.slots[this.active]!;
    return this.playbackId && a.readyState >= 1
      ? { playbackId: this.playbackId, seconds: Number.isFinite(a.currentTime) ? a.currentTime : 0 }
      : null;
  }
  seek(seconds: number) {
    const a = this.slots[this.active]!;
    if (Number.isFinite(a.duration)) a.currentTime = Math.max(0, Math.min(a.duration, seconds));
  }
  private cancelSongWork() {
    this.playGeneration++;
    this.playPending = false;
    if (this.fade !== null) cancelAnimationFrame(this.fade);
    this.fade = null;
  }
  private pauseSongs() {
    for (const a of this.slots) a.pause();
  }
  reset() {
    this.mediaGeneration++;
    this.cancelSongWork();
    for (const a of this.slots) {
      a.pause();
      a.removeAttribute('src');
      a.load();
    }
    for (const [id, layer] of this.layers) this.removeLayer(id, layer);
    this.playbackId = null;
    this.status = 'stopped';
    this.hooks.timing(0, 0);
  }
  private ownsSong(a: HTMLAudioElement, id: string, media: number) {
    return (
      this.mediaGeneration === media && this.playbackId === id && this.slots[this.active] === a
    );
  }
  private failSong(
    a: HTMLAudioElement,
    assetId: string,
    id: string,
    media: number,
    message: string,
  ) {
    if (!this.ownsSong(a, id, media) || this.status !== 'playing') return;
    // No silent fallback to the old crossfade slot while the domain handles the error.
    this.status = 'paused';
    this.cancelSongWork();
    this.pauseSongs();
    this.hooks.failed(assetId, id, message);
  }
  private playSong(
    a: HTMLAudioElement,
    assetId: string,
    id: string,
    media: number,
    transition?: { old: HTMLAudioElement; seconds: number; oldGain: number },
  ) {
    if (this.playPending) return;
    const request = ++this.playGeneration;
    this.playPending = true;
    const current = () =>
      this.ownsSong(a, id, media) && request === this.playGeneration && this.status === 'playing';
    void a
      .play()
      .then(() => {
        if (!current()) {
          // A reused slot may already belong to a newer request; never pause its new owner.
          if (this.slots[this.active] !== a || this.status !== 'playing') a.pause();
          return;
        }
        this.playPending = false;
        if (!transition) {
          a.volume = clamp(this.volume);
          return;
        }
        const start = performance.now(),
          duration = transition.seconds * 1000;
        const tick = (now: number) => {
          if (!current()) return;
          const t = duration ? Math.min(1, (now - start) / duration) : 1;
          a.volume = clamp(this.volume * t);
          transition.old.volume = clamp(this.volume * transition.oldGain * (1 - t));
          if (t < 1) this.fade = requestAnimationFrame(tick);
          else {
            transition.old.pause();
            this.fade = null;
          }
        };
        if (!duration) tick(start);
        else this.fade = requestAnimationFrame(tick);
      })
      .catch((error) => {
        if (!current()) return;
        this.playPending = false;
        if (error.name !== 'AbortError')
          this.failSong(a, assetId, id, media, 'Wiedergabe konnte nicht starten: ' + error.message);
      });
  }
  apply(view: MusicView) {
    const s = view.state,
      current = s.current;
    this.status = s.status;
    if (this.volume !== s.volume)
      for (const a of this.slots)
        a.volume = this.volume > 0 ? clamp((a.volume * s.volume) / this.volume) : 0;
    this.volume = s.volume;
    if (!current) {
      this.mediaGeneration++;
      this.cancelSongWork();
      this.pauseSongs();
      this.playbackId = null;
      this.hooks.timing(0, 0);
    } else if (this.playbackId !== current.playbackId) {
      const old = this.slots[this.active]!,
        a = this.slots[1 - this.active]!;
      this.active = 1 - this.active;
      this.playbackId = current.playbackId;
      this.cancelSongWork();
      const media = ++this.mediaGeneration,
        id = current.playbackId;
      a.pause();
      a.src = 'campaign://app/audio/' + encodeURIComponent(current.assetId);
      a.volume = 0;
      a.onended = () => {
        if (this.ownsSong(a, id, media) && this.status === 'playing') this.hooks.ended(id);
      };
      a.onerror = () =>
        this.failSong(
          a,
          current.assetId,
          id,
          media,
          'Audiodatei fehlt oder konnte nicht decodiert werden.',
        );
      a.onloadedmetadata = () => {
        if (!this.ownsSong(a, id, media)) return;
        if (current.positionSeconds > 0 && Number.isFinite(a.duration))
          a.currentTime = Math.min(current.positionSeconds, Math.max(0, a.duration - 0.01));
        this.hooks.timing(a.currentTime, Number.isFinite(a.duration) ? a.duration : 0);
      };
      a.load();
      if (s.status === 'playing')
        this.playSong(a, current.assetId, id, media, {
          old,
          seconds: s.fadeSeconds,
          oldGain: s.volume > 0 ? Math.min(1, old.volume / s.volume) : 0,
        });
      else {
        old.pause();
        a.volume = s.volume;
      }
    } else {
      const a = this.slots[this.active]!;
      if (s.status === 'playing') {
        if (this.fade === null && !this.playPending) a.volume = s.volume;
        if (a.paused && !a.ended)
          this.playSong(a, current.assetId, current.playbackId, this.mediaGeneration);
      } else {
        this.cancelSongWork();
        this.pauseSongs();
        a.volume = s.volume;
        if (s.status === 'stopped' && a.readyState) a.currentTime = 0;
      }
    }
    const desired = new Map(view.layers.map((l) => [l.assetId, l]));
    if (s.manualHold === 'stop') {
      for (const [id, layer] of this.layers) this.removeLayer(id, layer);
      return;
    }
    for (const id of this.layers.keys())
      if (!desired.has(id)) this.fadeLayer(id, 0, s.fadeSeconds, true);
    for (const [id, target] of desired) {
      let layer = this.layers.get(id);
      if (!layer) {
        const a = this.root.ownerDocument.createElement('audio');
        a.dataset.ambienceId = id;
        a.loop = true;
        a.preload = 'metadata';
        a.src = 'campaign://app/audio/' + encodeURIComponent(id);
        a.volume = 0;
        this.root.append(a);
        layer = {
          audio: a,
          fade: null,
          failed: false,
          ready: false,
          target: target.gain,
          seconds: s.fadeSeconds,
          removing: false,
          generation: 0,
        };
        this.layers.set(id, layer);
        const reference = layer;
        const failed = (message: string) => {
          if (this.layers.get(id) !== reference || reference.failed) return;
          reference.failed = true;
          reference.generation++;
          if (reference.fade !== null) cancelAnimationFrame(reference.fade);
          reference.fade = null;
          a.pause();
          this.hooks.failed(id, 'ambience-' + id, message);
        };
        a.onerror = () => failed('Umgebungsdatei fehlt oder konnte nicht decodiert werden.');
        void a
          .play()
          .then(() => {
            if (this.layers.get(id) !== reference || reference.failed) {
              a.pause();
              return;
            }
            reference.ready = true;
            this.fadeLayer(id, reference.target, reference.seconds, false);
          })
          .catch((error) => {
            if (error.name !== 'AbortError') failed(error.message);
          });
      } else if (!layer.failed) this.fadeLayer(id, target.gain, s.fadeSeconds, false);
    }
  }
  private removeLayer(id: string, layer: AmbienceLayer) {
    layer.generation++;
    if (layer.fade !== null) cancelAnimationFrame(layer.fade);
    layer.fade = null;
    layer.audio.pause();
    layer.audio.removeAttribute('src');
    layer.audio.load();
    layer.audio.remove();
    if (this.layers.get(id) === layer) this.layers.delete(id);
  }
  private fadeLayer(id: string, to: number, seconds: number, remove: boolean) {
    const layer = this.layers.get(id);
    if (!layer) return;
    // A failed layer stays silent while selected, but must release its media when removed.
    if (layer.failed) {
      if (remove) this.removeLayer(id, layer);
      return;
    }
    if (!layer.ready) {
      layer.target = to;
      layer.seconds = seconds;
      layer.removing = remove;
      if (remove) this.removeLayer(id, layer);
      return;
    }
    // Repeated projections do not restart the same fade or schedule idle frames.
    if (
      layer.target === to &&
      layer.seconds === seconds &&
      layer.removing === remove &&
      (layer.fade !== null || layer.audio.volume === to)
    )
      return;
    if (layer.fade !== null) cancelAnimationFrame(layer.fade);
    layer.target = to;
    layer.seconds = seconds;
    layer.removing = remove;
    const generation = ++layer.generation,
      from = layer.audio.volume,
      start = performance.now(),
      duration = seconds * 1000;
    const tick = (now: number) => {
      if (this.layers.get(id) !== layer || layer.generation !== generation) return;
      const t = duration ? Math.min(1, (now - start) / duration) : 1;
      layer.audio.volume = clamp(from + (to - from) * t);
      if (t < 1) layer.fade = requestAnimationFrame(tick);
      else {
        layer.fade = null;
        if (remove) this.removeLayer(id, layer);
      }
    };
    if (!duration) tick(start);
    else layer.fade = requestAnimationFrame(tick);
  }
}
