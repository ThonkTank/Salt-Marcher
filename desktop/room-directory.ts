import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import type { RoomDirectoryQuery, RoomDirectoryPage } from '../src/app/contracts';
/** One replaceable read job, including waiting for the predecessor's actual exit. */
export class RoomDirectoryService {
  private job: { worker: Worker; reject: (e: Error) => void } | null = null;
  private exit: Promise<unknown> = Promise.resolve();
  private generation = 0;
  private closed = false;
  constructor(private readonly workerFile = join(__dirname, 'room-directory-worker.cjs')) {}
  cancel() {
    this.generation++;
    const job = this.job;
    this.job = null;
    if (job) {
      job.reject(new Error('Raumsuche abgebrochen.'));
      void job.worker.terminate();
    }
  }
  async cancelAndWait() {
    this.cancel();
    await this.exit;
  }
  async close() {
    this.closed = true;
    await this.cancelAndWait();
  }
  async read(
    source: { filename: string; campaignId: string; token: string; fence: string },
    query: RoomDirectoryQuery,
  ): Promise<RoomDirectoryPage> {
    this.cancel();
    const generation = this.generation;
    await this.exit;
    if (this.closed || generation !== this.generation) throw new Error('Raumsuche abgebrochen.');
    const worker = new Worker(this.workerFile, { workerData: { ...source, query } });
    this.exit = new Promise((resolve) => worker.once('exit', resolve));
    const result = await new Promise<{
      items: RoomDirectoryPage['items'];
      total: number;
      unreadable: number;
      more: boolean;
    }>((resolve, reject) => {
      this.job = { worker, reject };
      let done = false;
      const finish = (error?: Error, value?: any) => {
        if (done) return;
        done = true;
        if (this.job?.worker === worker) this.job = null;
        error ? reject(error) : resolve(value);
      };
      worker.once('message', (v) => finish(undefined, v));
      worker.once('error', (e) => finish(new Error('Raumsuche fehlgeschlagen: ' + e.message)));
      worker.once('exit', () => finish(new Error('Raumsuche ohne Ergebnis beendet.')));
    });
    if (this.closed || generation !== this.generation) throw new Error('Raumsuche abgebrochen.');
    const last = result.items.at(-1);
    return {
      campaignId: source.campaignId,
      token: source.token,
      items: result.items,
      total: result.total,
      unreadable: result.unreadable,
      next:
        result.more && last
          ? {
              token: source.token,
              fence: source.fence,
              text: query.text,
              scopeId: query.scopeId,
              floorId: query.floorId,
              after: { number: last.number, id: last.id },
            }
          : null,
    };
  }
}
