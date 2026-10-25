import type { Edit, WorkingRoomDraft } from '../src/app/shared/contracts';
import type { HostIpc } from './host-ipc';
import { StoreClient } from './store-client';
export function registerWorkspaceHost(host: {
  ipc: HostIpc;
  store: StoreClient;
  backupError: () => string | null;
}) {
  const { store } = host;
  const scope = host.ipc.scope(),
    handle = scope.handle;

  handle('campaign:installation-settings', async () => await store.campaignInstallationSettings());
  handle(
    'campaign:workspace-geometry',
    async (token: string) => await store.workspaceGeometry(token),
  );
  handle('campaign:select', async (token: string, id: string) => await store.select(token, id));
  handle('campaign:add-room', async (token: string) => await store.addRoom(token));
  handle('campaign:edit', async (edit: Edit) => await store.edit(edit));
  handle(
    'campaign:reconcile',
    async (edit: Edit, token?: string) => await store.reconcile(edit, token),
  );
  handle(
    'campaign:room-draft',
    async (token: string, roomId: string) => await store.roomDraft(token, roomId),
  );
  handle(
    'campaign:keep-room-draft',
    async (token: string, roomId: string, draft: WorkingRoomDraft | null) =>
      await store.keepRoomDraft(token, roomId, draft),
  );
  handle(
    'campaign:history',
    async (token: string, direction: 'undo' | 'redo') => await store.history(token, direction),
  );
  handle('campaign:backup-status', () => host.backupError());
  handle(
    'campaign:tutorial',
    async (state?: 'shown' | 'finished' | 'skipped') => await store.tutorial(state),
  );
  return { close: scope.dispose };
}
