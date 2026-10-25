import { EditorSession } from './editor-session';
import type { ChaseView } from './chase-contracts';
import type { ChaseWorkingDraft } from './chase-draft-contracts';
const key = (cam: string, id: string) => JSON.stringify([cam, id]);
export class ChaseDraftCache {
  readonly editorSession = new EditorSession();
  private values = new Map<string, ChaseWorkingDraft>();
  private saved = new Map<string, string | null>();
  private dirty = new Set<string>();
  private tasks = new Map<string, Promise<boolean>>();
  private errors = new Map<string, string>();
  private sent = new Map<string, ChaseWorkingDraft>();
  constructor(private changed: () => void) {}
  accept(cam: string, v: ChaseView) {
    if (!v.chase) return null;
    const k = key(cam, v.chase.id);
    if (!this.dirty.has(k)) {
      this.saved.set(k, v.draft?.writeId ?? null);
      if (v.draft) this.values.set(k, structuredClone(v.draft));
      else this.values.delete(k);
      this.errors.delete(k);
    }
    return this.values.get(k) ?? null;
  }
  current(cam: string, id: string) {
    return this.values.get(key(cam, id));
  }
  status(cam: string, id: string) {
    const k = key(cam, id);
    return {
      error: this.errors.get(k),
      dirty: this.dirty.has(k),
      saved: this.saved.has(k) && this.values.has(k),
    };
  }
  put(token: string, cam: string, d: ChaseWorkingDraft) {
    const k = key(cam, d.chaseId);
    this.values.set(k, d);
    this.dirty.add(k);
    this.changed();
    const existing = this.tasks.get(k);
    if (existing) return existing;
    const task = this.editorSession.start(async () => {
      while (this.dirty.has(k)) {
        const current = this.values.get(k)!;
        this.sent.set(k, current);
        try {
          if (!this.saved.has(k)) throw new Error('Ursprünglichen Entwurf zuerst laden.');
          const r = await window.campaign.keepChaseDraft(token, current, this.saved.get(k)!);
          if (!r.ok) throw new Error(r.error);
        } catch (error) {
          try {
            const r = await window.campaign.chase(token, current.sceneId, current.chaseId);
            if (!r.ok || JSON.stringify(r.value.draft) !== JSON.stringify(current)) throw error;
          } catch {
            this.errors.set(k, 'Entwurf nicht gesichert: ' + (error as Error).message);
            this.changed();
            return false;
          }
        }
        this.saved.set(k, current.writeId);
        this.errors.delete(k);
        if (this.values.get(k) === current) this.dirty.delete(k);
        this.sent.delete(k);
        this.changed();
      }
      return true;
    });
    this.tasks.set(k, task);
    void task.then((ok) => {
      if (ok && this.tasks.get(k) === task) this.tasks.delete(k);
      this.changed();
    });
    return task;
  }
  async flush(cam: string) {
    const owned = (k: string) => JSON.parse(k)[0] === cam;
    while (true) {
      const tasks = [...this.tasks].filter(([k]) => owned(k));
      if (!tasks.length) break;
      if ((await Promise.all(tasks.map(([, p]) => p))).some((ok) => !ok)) return false;
    }
    return ![...this.dirty].some(owned);
  }
  async retry(token: string, cam: string) {
    for (const k of [...this.dirty]) {
      if (JSON.parse(k)[0] !== cam) continue;
      await this.tasks.get(k);
      const d = this.values.get(k)!;
      try {
        const r = await window.campaign.chase(token, d.sceneId, d.chaseId);
        if (!r.ok) throw new Error(r.error);
        const actual = r.value.draft ?? null,
          sent = this.sent.get(k);
        if ((actual?.writeId ?? null) !== this.saved.get(k)) {
          if (!sent || JSON.stringify(actual) !== JSON.stringify(sent))
            throw new Error('Ein anderer Entwurf liegt vor. Eigene Rohwerte bleiben offen.');
          this.saved.set(k, actual!.writeId);
        }
        const c = r.value.chase;
        if (
          !c ||
          c.id !== d.chaseId ||
          c.sceneId !== d.sceneId ||
          c.status !== 'running' ||
          c.revision < d.revision
        )
          throw new Error('Verfolgungsziel ist nicht mehr bearbeitbar. Rohwerte bleiben offen.');
        const candidate =
          c.revision === d.revision
            ? d
            : {
                ...structuredClone(d),
                writeId: crypto.randomUUID(),
                revision: c.revision,
                rows: d.rows.filter((row) =>
                  c.participants.some((p) => p.id === row.participantId),
                ),
              };
        this.tasks.delete(k);
        this.errors.delete(k);
        if (!(await this.put(token, cam, candidate))) return false;
      } catch (e) {
        this.errors.set(k, (e as Error).message);
        this.changed();
        return false;
      }
    }
    return this.flush(cam);
  }
  release(cam: string) {
    for (const k of this.saved.keys())
      if (JSON.parse(k)[0] === cam && !this.dirty.has(k) && !this.tasks.has(k)) {
        this.values.delete(k);
        this.saved.delete(k);
        this.errors.delete(k);
        this.sent.delete(k);
      }
  }
}
