import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { readChronicle } from './chronicle';
import type {
  ChronicleCategory,
  ChronicleCursor,
  ChroniclePage,
  ChronicleAfter,
} from '../runtime/chronicle-contracts';
// One read-only SQLite transaction fixes both historical facts and their display context.
export class ChronicleReadSession {
  readonly id = randomUUID();
  private db: any;
  private filter: string | null = null;
  constructor(
    filename: string,
    readonly campaignId: string,
  ) {
    this.db = new Database(filename, { readonly: true, fileMustExist: true });
    try {
      this.db.exec('BEGIN');
      if (!this.db.prepare('SELECT id FROM campaign WHERE id=?').get(campaignId))
        throw new Error('Kampagne fehlt.');
    } catch (e) {
      this.close();
      throw e;
    }
  }
  read(
    category: ChronicleCategory | 'all',
    search: string,
    cursor: ChronicleCursor | null,
    limit = 100,
  ): ChroniclePage {
    if (!this.db) throw new Error('Chronik-Lesestand geschlossen. Aktualisieren.');
    const key = JSON.stringify([category, search]);
    if (this.filter !== null && this.filter !== key)
      throw new Error('Chronikfilter geändert. Aktualisieren.');
    let before: ChronicleAfter | null = null;
    if (cursor) {
      if (cursor.snapshotId !== this.id)
        throw new Error('Chronikseite gehört nicht zum Lesestand. Aktualisieren.');
      if (cursor.after !== null) {
        if (
          !cursor.after ||
          typeof cursor.after.recordedAt !== 'string' ||
          cursor.after.recordedAt.length > 1000 ||
          typeof cursor.after.id !== 'string' ||
          cursor.after.id.length > 2000 ||
          !Number.isSafeInteger(cursor.after.sourceOrder) ||
          cursor.after.sourceOrder < 0
        )
          throw new Error('Chronikcursor ungültig. Aktualisieren.');
        before = cursor.after;
      }
    }
    const view = readChronicle(this.db, this.campaignId, category, search, { limit, before });
    this.filter = key;
    const last = view.entries.at(-1);
    return {
      ...view,
      snapshotId: this.id,
      next:
        view.truncated && last
          ? {
              snapshotId: this.id,
              after: {
                recordedAt: last.recordedAt,
                sourceOrder: last.sourceOrder ?? 0,
                id: last.id,
              },
            }
          : null,
    };
  }
  close() {
    if (this.db) {
      try {
        if (this.db.inTransaction) this.db.exec('ROLLBACK');
      } finally {
        this.db.close();
        this.db = null;
      }
    }
  }
}
