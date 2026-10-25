import type { EditorSession } from '../shared/editor-session';
import type { WorkspaceGeometry } from '../shared/contracts';
import { formatInstant, type LiveScene } from './live-contracts';
import { calendarDate } from './world-model';
import type { TimePreview } from './time-plan-contracts';
import type { FantasyCalendar } from './world-contracts';

type Host = {
  get: <T extends HTMLElement>(id: string) => T;
  api: Pick<Window['campaign'], 'previewTime'>;
  session: EditorSession;
  context: () => { workspace: WorkspaceGeometry; scene: LiveScene } | null;
  blocked: () => boolean;
  accepted: (from: string) => void;
};

/** Owns only literal time input and cancellable previews. The Live writer still
 * owns flush, booking, receipts and recovery. */
export class LiveTimeControls {
  preview: TimePreview | null = null;
  private calendar: FantasyCalendar | null = null;
  private request = 0;
  private owner: string | null = null;
  private readonly drafts = new Map<string, { amount: string; unit: string; reason: string }>();
  constructor(private readonly host: Host) {}
  private value(id: string) {
    return this.host.get<HTMLInputElement>(id).value;
  }
  format(ms: string) {
    return formatInstant(ms, this.calendar?.daySeconds ?? 86400);
  }
  reset() {
    this.preview = null;
    this.calendar = null;
    this.request++;
    this.drafts.clear();
    this.owner = null;
  }
  contextChanged() {
    const context = this.host.context();
    const owner = context ? context.workspace.token + '/' + context.scene.id : null;
    if (owner === this.owner) return;
    if (this.owner)
      this.drafts.set(this.owner, {
        amount: this.value('time-amount'),
        unit: this.value('time-unit'),
        reason: this.value('time-reason'),
      });
    const draft = owner ? this.drafts.get(owner) : null;
    this.host.get<HTMLInputElement>('time-amount').value = draft?.amount ?? '10';
    this.host.get<HTMLSelectElement>('time-unit').value = draft?.unit ?? 'minutes';
    this.host.get<HTMLInputElement>('time-reason').value = draft?.reason ?? '';
    this.owner = owner;
  }
  render = () => {
    const context = this.host.context(),
      request = ++this.request;
    this.preview = null;
    this.host.get<HTMLButtonElement>('time-advance').disabled = true;
    if (!context) return;
    const { workspace, scene } = context;
    const amount = this.value('time-amount'),
      unit = this.value('time-unit');
    const units: Record<string, 'second' | 'minute' | 'hour' | 'day'> = {
      seconds: 'second',
      minutes: 'minute',
      hours: 'hour',
      days: 'day',
    };
    const lease = this.host.session.read();
    const current = () =>
      lease.current() &&
      request === this.request &&
      this.host.context()?.workspace.token === workspace.token &&
      this.host.context()?.scene.id === scene.id;
    this.host.get('time-preview').textContent = 'Kalenderzeit wird berechnet…';
    void this.host.api
      .previewTime(workspace.token, {
        sceneId: scene.id,
        kind: 'duration',
        amount,
        unit: units[unit]!,
        reason: this.value('time-reason'),
      })
      .then((result) => {
        if (!current() || amount !== this.value('time-amount') || unit !== this.value('time-unit'))
          return;
        if (!result.ok) throw new Error(result.error);
        this.preview = result.value;
        this.calendar = result.value.calendar;
        this.host.get('time-preview').textContent =
          'Danach: ' + calendarDate(result.value.calendar, result.value.to);
        this.host.get('live-clock').textContent =
          'Seit Kampagnenbeginn: ' +
          formatInstant(result.value.from, result.value.calendar.daySeconds);
        this.host.get<HTMLButtonElement>('time-advance').disabled = this.host.blocked();
        this.host.accepted(result.value.from);
      })
      .catch((error) => {
        if (current()) this.host.get('time-preview').textContent = error.message;
      })
      .finally(() => lease.finish());
  };
}
