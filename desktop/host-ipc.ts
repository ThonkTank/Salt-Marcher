import type { IpcMain, IpcMainInvokeEvent, WebContents } from 'electron';
import type { Result } from '../src/app/shared/contracts';
import { StoreOutcomeUnknownError } from './store-client';

type Authority = {
  contents: () => WebContents;
  origin: string;
  stopping: () => boolean;
  erasing: () => boolean;
  syncPlayer: () => Promise<void>;
};
export type HostHandle = <T>(name: string, operation: (...args: any[]) => T | Promise<T>) => void;
const stopped = 'SaltMarcher wird für das Update oder Schließen angehalten.';
/** Shared transport checks only. Argument validation and domain authority remain
 * in each named capability and its canonical store operation. */
export class HostIpc {
  private readonly operations = new Set<Promise<unknown>>();
  constructor(
    private readonly ipc: Pick<IpcMain, 'handle' | 'removeHandler'>,
    private readonly authority: Authority,
  ) {}
  trusted(event: Pick<IpcMainInvokeEvent, 'sender' | 'senderFrame'>) {
    const contents = this.authority.contents();
    return (
      event.sender === contents &&
      event.senderFrame === contents.mainFrame &&
      event.senderFrame?.url === this.authority.origin
    );
  }
  get activeCount() {
    return this.operations.size;
  }
  async drain() {
    await Promise.allSettled([...this.operations]);
  }
  scope() {
    const names = new Set<string>();
    let disposed = false;
    const handle: HostHandle = (name, operation) => {
      if (disposed) throw Error('IPC scope already disposed');
      this.ipc.handle(name, async (event, ...args): Promise<Result<unknown>> => {
        if (disposed || !this.trusted(event)) return { ok: false, error: 'Zugriff verweigert.' };
        if (this.authority.stopping() && !name.startsWith('update:'))
          return { ok: false, error: stopped };
        const task = Promise.resolve().then(async () => {
          if (this.authority.erasing())
            throw Error('Kampagnenlöschung läuft. Danach erneut versuchen.');
          const value = await operation(...args);
          if (
            name.includes(':execute') ||
            [
              'atlas:travel-commit',
              'atlas:commit',
              'atlas:room-commit',
              'atlas:drawing-commit',
              'campaign:activate',
              'campaign:activate-shell',
              'campaign:catalog-shell',
              'campaign:catalog',
              'campaign:catalog-workspace',
              'campaign:transfer-accept',
              'player:window',
              'player:art',
            ].includes(name)
          )
            await this.authority.syncPlayer();
          return value;
        });
        if (!name.startsWith('update:')) this.operations.add(task);
        try {
          return { ok: true, value: await task };
        } catch (error) {
          return {
            ok: false,
            error: error instanceof Error ? error.message : 'Vorgang fehlgeschlagen.',
            ...(error instanceof StoreOutcomeUnknownError
              ? { errorKind: 'store-outcome-unknown' as const }
              : {}),
          };
        } finally {
          this.operations.delete(task);
        }
      });
      names.add(name);
    };
    return {
      handle,
      dispose: () => {
        disposed = true;
        for (const name of names) this.ipc.removeHandler(name);
        names.clear();
      },
    };
  }
}
