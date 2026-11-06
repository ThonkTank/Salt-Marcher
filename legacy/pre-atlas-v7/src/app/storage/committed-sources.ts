import Database from 'better-sqlite3';

/** Revisions for published, file-backed read sources, not in-transaction caches. */
export class CommittedSources {
  private readers = new Map<object, { db: any; version: number; revision: number }>();
  private revision = 0;

  version(writer: any): number {
    let reader = this.readers.get(writer);
    if (!reader) {
      if (!writer.open || writer.memory)
        throw new Error('Bestätigter Quellenstand benötigt eine offene Dateidatenbank.');
      // data_version only observes OTHER connections. Keep this read-only connection
      // alive: reopening it resets the counter. No read transaction or snapshot is held.
      const db = new Database(writer.name, { readonly: true, fileMustExist: true });
      try {
        reader = {
          db,
          version: db.pragma('data_version', { simple: true }) as number,
          revision: ++this.revision,
        };
      } catch (error) {
        db.close();
        throw error;
      }
      this.readers.set(writer, reader);
    }
    const version = reader.db.pragma('data_version', { simple: true }) as number;
    if (version !== reader.version) {
      reader.version = version;
      reader.revision = ++this.revision;
    }
    return reader.revision;
  }

  forget(writer: object) {
    const reader = this.readers.get(writer);
    if (reader) {
      reader.db.close();
      this.readers.delete(writer);
    }
  }
  close() {
    for (const writer of this.readers.keys()) this.forget(writer);
  }
}
