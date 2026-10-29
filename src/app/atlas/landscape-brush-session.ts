import type { ScreenPoint } from './atlas-screen-triangle';
import type { LandscapeHost } from './landscape-workbench-types';
import { TerrainDraftStroke, TerrainStrokeDiscardedError } from './terrain-stroke-queue';
import { terrainTraceMeasure } from './terrain-timing';
import { TerrainLiveStroke } from './terrain-live-stroke';
import { type HeightStroke } from './terrain-brush-contracts';
import type { LandscapeToolSettings } from './landscape-tool-settings';
import { pendingAtlasWrite } from './campaign-atlas-author';
import type { MaskSample } from './land-mask-contracts';
import type { Point } from '../shared/contracts';
import { type LandscapeRecord } from './landscape-contracts';
/** A received event is authoritative over speculative RAF holding. Rewrite
 * that suffix onto the actual timed segment, clipping predictions after it.
 * Retaining those observations and appending the event advances draft versions
 * without adding time or changing the piecewise linear path. */
export function receiveTimedBrushInput(
  samples: MaskSample[],
  lastInput: number,
  point: Point,
  elapsedMs: number,
) {
  const start = samples[lastInput]!,
    end = Math.min(300000, Math.max(start.t, elapsedMs));
  for (let i = lastInput + 1; i < samples.length; i++) {
    const t = Math.min(samples[i]!.t, end),
      f = end === start.t ? 1 : (t - start.t) / (end - start.t);
    samples[i] = { x: start.x + (point.x - start.x) * f, y: start.y + (point.y - start.y) * f, t };
  }
  samples.push({ ...point, t: end });
  return samples.length - 1;
}
interface LandscapeBrushSessionHost {
  readonly effects: Pick<
    LandscapeHost,
    | 'data'
    | 'error'
    | 'previewHeight'
    | 'completeHeightPreview'
    | 'redraw'
    | 'terrainGesture'
    | 'writeTerrain'
    | 'localTerrain'
  >;
  readonly pointer: number | null;
  endInput(): void;
  readonly disable: (disabled: boolean) => void;
  readonly say: (message: string) => void;
  readonly lastPoint: Point;
  readonly points: readonly Point[];
  clearDraft(): void;
  readonly colorRecord: () => LandscapeRecord;
  readonly saving: boolean;
  setSaving(saving: boolean): void;
  readonly token: string;
  clearHeightPreview(): void;
}
/** Owns live brush sampling, frame scheduling and stroke completion. */
export class LandscapeBrushSession {
  constructor(private host: LandscapeBrushSessionHost) {}
  maskStroke: HeightStroke | import('./landscape-action-contracts').LakeStroke | null = null;
  colorDraft: ReturnType<LandscapeToolSettings['color']> | null = null;
  maskStart = 0;
  private lastHeightInput = 0;
  private lastScreenInput = 0;
  maskGeneration = 0;
  liveFrame: number | undefined;
  liveWriteRequested = false;
  maskTimer: ReturnType<typeof setTimeout> | undefined;
  live: TerrainLiveStroke | TerrainDraftStroke | null = null;
  liveColorCount = 0;
  liveId = '';
  get livePainting() {
    return this.live !== null;
  }
  startLive() {
    this.lastHeightInput = 0;
    this.lastScreenInput = 0;
    const data = this.host.effects.data();
    if (!data?.region) throw Error('Kartenausschnitt fehlt. Erneut laden.');
    this.host.effects.terrainGesture(true);
    this.liveId =
      this.maskStroke && 'waterLevelM' in this.maskStroke
        ? this.maskStroke.id
        : crypto.randomUUID();
    this.liveColorCount = 0;
    this.liveFailureMessage = undefined;
    const local = this.host.effects.localTerrain?.(),
      id = this.liveId;
    this.live =
      !local && this.maskStroke && ('waterLevelM' in this.maskStroke || this.maskStroke.screenInput)
        ? new TerrainDraftStroke(async (a) => {
            await this.host.effects.writeTerrain(a, {
              id,
              commandId: id,
              expectedRevision: data.revision,
              sourceFence: data.region!.fence,
            });
          })
        : local
          ? new TerrainDraftStroke((a) => local.enqueue(a, id))
          : new TerrainLiveStroke(
              { id: this.liveId, expectedRevision: data.revision, sourceFence: data.region.fence },
              (a, c) => this.host.effects.writeTerrain(a, c),
              (error) => {
                this.liveFailureMessage = error instanceof Error ? error.message : String(error);
                this.host.endInput();
                clearTimeout(this.maskTimer);
                void this.finishLive(true);
                this.host.effects.error(error);
              },
              () => this.scheduleLive(),
            );
    this.host.disable(true);
    this.host.say('Pinsel arbeitet direkt. Rückgängig nimmt den ganzen Zug zurück.');
    // Sample the first real elapsed frame, just like subsequent stationary
    // samples. A near-zero pointerdown dose can commit without changing a pixel.
    // Releasing before that frame still flushes the actual elapsed input below.
    if (local && !this.maskStroke) this.sampleLive();
    this.scheduleLive();
  }
  receiveHeightInput(point: Point, timeStamp: number, screen?: ScreenPoint) {
    if (this.maskStroke?.screenInput) {
      if (!screen) throw Error('Bildschirmereignis des Pinselzugs fehlt.');
      const events = this.maskStroke.screenInput.events,
        legacy = events.map((p) => ({ x: p.u, y: p.v, t: p.t }));
      this.lastScreenInput = receiveTimedBrushInput(
        legacy,
        this.lastScreenInput,
        { x: screen.u, y: screen.v },
        timeStamp - this.maskStart,
      );
      this.maskStroke.screenInput.events = legacy.map((p) => ({ u: p.x, v: p.y, t: p.t }));
    }
    if (this.maskStroke)
      this.lastHeightInput = receiveTimedBrushInput(
        this.maskStroke.samples,
        this.lastHeightInput,
        point,
        timeStamp - this.maskStart,
      );
  }
  sampleHeight() {
    if (this.maskStroke && this.host.pointer !== null && this.maskStroke.samples.length < 20000) {
      const last = this.maskStroke.samples.at(-1)!;
      const t = Math.min(300000, Math.max(last.t, performance.now() - this.maskStart));
      this.maskStroke.samples.push({ ...this.host.lastPoint, t });
      const events = this.maskStroke.screenInput?.events;
      if (events) events.push({ ...events.at(-1)!, t });
    }
  }
  sampleLive(write = true) {
    try {
      this.sampleHeight();
      if (this.maskStroke) this.host.effects.previewHeight?.(this.maskStroke);
      if (!this.live || !write) return;
      if (this.maskStroke)
        this.live.update(
          'waterLevelM' in this.maskStroke
            ? { kind: 'landscape-lake-stroke', stroke: this.maskStroke }
            : { kind: 'landscape-height-stroke', stroke: this.maskStroke },
        );
      else if (this.host.points.length !== this.liveColorCount) {
        const record = terrainTraceMeasure('draft.colorRecord', () => this.host.colorRecord());
        record.id = this.liveId;
        this.liveColorCount = this.host.points.length;
        this.host.effects.localTerrain?.()?.previewColor(record);
        this.live.update({ kind: 'landscape-color-stroke', record });
      }
    } catch (error) {
      // Stop the current input owner before surfacing a synchronous preview
      // failure. Existing writes retain their original outcome/recovery owner.
      this.liveFailureMessage = error instanceof Error ? error.message : String(error);
      void this.finishLive(true).catch((e) => this.host.effects.error(e));
      this.host.effects.error(error);
    }
  }
  liveFailureMessage: string | undefined;
  tickLive() {
    this.liveFrame = undefined;
    const write = this.liveWriteRequested;
    this.liveWriteRequested = false;
    this.sampleLive(write);
    // Stationary height feedback continues while storage is occupied. Input
    // and returning write capacity join this frame instead of drawing twice.
    if (this.maskStroke) this.scheduleLive(false);
  }
  scheduleLive(write = true) {
    if (!this.live || this.host.pointer === null) return;
    this.liveWriteRequested ||= write;
    if (this.liveFrame !== undefined) return;
    this.liveFrame = requestAnimationFrame(() => this.tickLive());
  }
  endLiveInput() {
    if (this.liveFrame !== undefined) cancelAnimationFrame(this.liveFrame);
    this.liveFrame = undefined;
    this.liveWriteRequested = false;
    if (this.maskStroke && this.host.pointer !== null) {
      const t = Math.min(
        300000,
        Math.max(this.maskStroke.samples.at(-1)!.t, performance.now() - this.maskStart),
      );
      this.maskStroke.samples.push({ ...this.host.lastPoint, t });
      const events = this.maskStroke.screenInput?.events;
      if (events) events.push({ ...events.at(-1)!, t });
    }
    this.host.endInput();
    clearTimeout(this.maskTimer);
  }
  async finishLive(stop = false) {
    const live = this.live;
    if (!live || this.host.saving) return;
    this.endLiveInput();
    if (!stop) this.sampleLive();
    if (this.live !== live || this.host.saving) return;
    if (!stop && this.maskStroke && this.host.effects.completeHeightPreview) {
      this.host.setSaving(true);
      try {
        await this.host.effects.completeHeightPreview(this.maskStroke);
      } catch (error) {
        stop = true;
        this.liveFailureMessage = error instanceof Error ? error.message : String(error);
        this.host.effects.error(error);
      } finally {
        this.host.setSaving(false);
      }
      if (this.live !== live) return;
    }
    if (live instanceof TerrainDraftStroke) {
      // Close author input synchronously. The queue owns the immutable
      // snapshot; an immediately following gesture owns fresh local state.
      if (stop) this.host.effects.localTerrain?.()?.cancel();
      const token = this.host.token;
      const completion = stop ? live.stop() : live.finish();
      this.live = null;
      this.clearMask();
      this.host.clearDraft();
      this.host.disable(false);
      this.host.say(stop ? 'Pinsel gestoppt.' : 'Wird gespeichert…');
      void Promise.resolve(this.host.effects.terrainGesture(false)).catch((e) =>
        this.host.effects.error(e),
      );
      try {
        await completion;
        if (this.host.token === token && !this.live) this.host.say('Gespeichert');
      } catch (error) {
        if (this.host.token !== token) return;
        if (error instanceof TerrainStrokeDiscardedError) {
          this.host.disable(false);
          this.host.say('Gehaltene Pinselzüge verworfen.');
          return;
        }
        this.liveFailureMessage = error instanceof Error ? error.message : String(error);
        this.host.disable(true);
        this.host.say('Speicherstatus wird geprüft…');
      }
      this.host.effects.redraw();
      return;
    }
    this.host.setSaving(true);
    let failed = stop;
    try {
      if (stop) await live.stop();
      else await live.finish();
    } catch {
      failed = true; /* The writer already surfaced the error and owns unknown-outcome recovery. */
    } finally {
      if (this.live === live) {
        try {
          await this.host.effects.terrainGesture(false);
        } catch (error) {
          failed = true;
          this.liveFailureMessage = error instanceof Error ? error.message : String(error);
          this.host.effects.error(error);
        } finally {
          this.live = null;
          this.host.setSaving(false);
        }
        this.clearMask();
        this.host.clearDraft();
        const pending = !!pendingAtlasWrite(this.host.token);
        this.host.disable(pending);
        const saved = pending
          ? 'Speicherstand des Pinselzugs noch ungeklärt.'
          : live.hasCommittedChanges
            ? 'Gespeicherte Änderungen bleiben; Rückgängig nimmt den Zug zurück.'
            : 'Keine Änderung dieses Pinselzugs gespeichert.';
        this.host.say(
          failed
            ? (this.liveFailureMessage ? this.liveFailureMessage + ' ' : '') +
                'Pinsel gestoppt. ' +
                saved
            : 'Gespeichert',
        );
        this.host.effects.redraw();
      }
    }
  }
  clearMask() {
    clearTimeout(this.maskTimer);
    this.maskGeneration++;
    this.maskStroke = null;
    this.lastHeightInput = 0;
    this.lastScreenInput = 0;
    this.colorDraft = null;
    this.host.clearHeightPreview();
  }
}
