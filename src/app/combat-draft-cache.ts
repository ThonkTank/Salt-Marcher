import { EditorSession } from './editor-session';
import type { Result } from './contracts';
import type { CombatWorkingDraft, CombatDraftKind } from './combat-draft-contracts';
const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
export const combatDraftKey = (cam: string, id: string, kind: CombatDraftKind, target: string) =>
  JSON.stringify([cam, id, kind, target]);
/** Two combat editors share persistence ordering, not a second editor engine. */
export class CombatDraftCache {
  values = new Map<string, CombatWorkingDraft>();
  readFailures = new Set<string>();
  private saved = new Map<string, string | null>();
  private dirty = new Set<string>();
  private tasks = new Map<string, Promise<boolean>>();
  private sent = new Map<string, CombatWorkingDraft>();
  readonly editorSession = new EditorSession();
  constructor(private report: (cam: string, message: string) => void) {}
  async load(token: string, cam: string, id: string, kind: CombatDraftKind, target: string) {
    const key = combatDraftKey(cam, id, kind, target);
    if (this.saved.has(key)) return this.values.get(key) ?? null;
    const epoch = this.editorSession.generation;
    try {
      const d = unwrap(await window.campaign.combatDraft(token, id, kind, target));
      if (epoch !== this.editorSession.generation) return d;
      if (this.saved.has(key)) return this.values.get(key) ?? null;
      this.saved.set(key, d?.writeId ?? null);
      if (d && !this.values.has(key)) this.values.set(key, d);
      this.readFailures.delete(key);
      return this.values.get(key) ?? null;
    } catch (error) {
      if (epoch === this.editorSession.generation) this.readFailures.add(key);
      throw error;
    }
  }
  put(token: string, cam: string, d: CombatWorkingDraft): Promise<boolean> {
    const key = combatDraftKey(cam, d.combatId, d.kind, d.targetId);
    this.values.set(key, d);
    this.dirty.add(key);
    const existing = this.tasks.get(key);
    if (existing) return existing;
    const task = this.editorSession.start(async () => {
      // Retain at most the in-flight value and the latest edit for this target.
      while (this.dirty.has(key)) {
        const current = this.values.get(key)!;
        if (!this.saved.has(key)) {
          this.report(
            cam,
            'Ursprünglicher Entwurf wurde noch nicht gelesen. Rohwerte bleiben erhalten.',
          );
          return false;
        }
        this.sent.set(key, current);
        try {
          unwrap(await window.campaign.keepCombatDraft(token, current, this.saved.get(key)!));
        } catch (error) {
          try {
            const actual = unwrap(
              await window.campaign.combatDraft(
                token,
                current.combatId,
                current.kind,
                current.targetId,
              ),
            );
            if (!actual || JSON.stringify(actual) !== JSON.stringify(current)) throw error;
          } catch {
            this.report(
              cam,
              'Entwurfssicherung fehlgeschlagen. Eingaben bleiben offen: ' +
                (error as Error).message,
            );
            return false;
          }
        }
        this.saved.set(key, current.writeId);
        if (this.values.get(key) === current) this.dirty.delete(key);
        if (this.sent.get(key) === current) this.sent.delete(key);
      }
      return true;
    });
    this.tasks.set(key, task);
    void task.then((okay) => {
      if (okay && this.tasks.get(key) === task) this.tasks.delete(key);
    });
    return task;
  }
  async flush(cam: string): Promise<boolean> {
    const owned = (key: string) => JSON.parse(key)[0] === cam;
    while (true) {
      const pending = [...this.tasks].filter(([key]) => owned(key));
      if (!pending.length) break;
      if ((await Promise.all(pending.map(([, p]) => p))).some((okay) => !okay)) return false;
    }
    return ![...this.dirty].some(owned);
  }
  consumed(cam: string, d: CombatWorkingDraft) {
    const key = combatDraftKey(cam, d.combatId, d.kind, d.targetId);
    if (this.values.get(key)?.writeId === d.writeId) {
      this.values.delete(key);
      this.dirty.delete(key);
      this.saved.set(key, null);
    }
  }
  async discard(token: string, cam: string, id: string, kind: CombatDraftKind, target: string) {
    const key = combatDraftKey(cam, id, kind, target);
    await this.tasks.get(key);
    const actual = unwrap(await window.campaign.combatDraft(token, id, kind, target)),
      shown = this.values.get(key);
    if (actual && actual.writeId !== shown?.writeId && actual.writeId !== this.saved.get(key))
      throw new Error('Ein neuerer Entwurf liegt vor. Zuerst ansehen.');
    if (actual)
      unwrap(await window.campaign.discardCombatDraft(token, id, kind, target, actual.writeId));
    this.values.delete(key);
    this.saved.delete(key);
    this.dirty.delete(key);
    this.tasks.delete(key);
    this.sent.delete(key);
    this.readFailures.delete(key);
  }
  release(cam: string) {
    this.editorSession.generation++;
    for (const key of this.saved.keys()) {
      if (JSON.parse(key)[0] === cam && !this.dirty.has(key) && !this.tasks.has(key)) {
        this.values.delete(key);
        this.saved.delete(key);
        this.readFailures.delete(key);
        this.sent.delete(key);
      }
    }
  }
  async retry(token: string, cam: string): Promise<boolean> {
    for (const key of [...this.dirty]) {
      if (JSON.parse(key)[0] !== cam) continue;
      await this.tasks.get(key);
      const d = this.values.get(key);
      if (!d) continue;
      try {
        const actual = unwrap(
            await window.campaign.combatDraft(token, d.combatId, d.kind, d.targetId),
          ),
          sent = this.sent.get(key);
        if (
          actual?.writeId !== this.saved.get(key) &&
          !(actual === null && this.saved.get(key) === null)
        ) {
          if (!sent || JSON.stringify(actual) !== JSON.stringify(sent))
            throw new Error('Ein neuerer Entwurf liegt vor. Rohwerte bleiben offen.');
          this.saved.set(key, actual!.writeId);
        }
        this.tasks.delete(key);
        if (!(await this.put(token, cam, d))) return false;
      } catch (error) {
        this.report(cam, (error as Error).message);
        return false;
      }
    }
    return this.flush(cam);
  }
}
