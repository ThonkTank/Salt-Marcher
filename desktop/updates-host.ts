import { app, BrowserWindow, dialog } from 'electron';
import type { HostIpc } from './host-ipc';
import { openUpdateRuntime } from './update-runtime';
import { UpdateService } from './update-service';
export function registerUpdatesHost(host: {
  ipc: HostIpc;
  win: BrowserWindow;
  service: UpdateService;
  runtime: Awaited<ReturnType<typeof openUpdateRuntime>>;
  stopping: () => boolean;
  storeClosed: () => boolean;
  resume: () => void;
  allowClose: () => void;
  finishClose: (request: string) => Promise<void>;
}) {
  const { win } = host;
  const scope = host.ipc.scope(),
    handle = scope.handle;
  const { service: updates, runtime: updateRuntime } = host;
  handle('update:status', () => updates.status());
  handle('update:automatic', (enabled: boolean) => updates.automatic(enabled));
  handle('update:check', () => updates.check());
  handle('update:download', () => updates.download());
  handle('update:cancel', () => updates.cancel());
  handle('update:runtime-ready', async () => {
    await updateRuntime!.ready();
    if (updateRuntime!.transaction) win.show();
  });
  handle('update:install', async () => {
    if (host.stopping()) throw new Error('Die Anwendung wird bereits geschlossen.');
    const request = await updateRuntime!.prepare(updates.installation());
    updates.installing();
    try {
      await host.finishClose(request);
    } catch (e) {
      updates.installationFailed(e);
      if (host.storeClosed()) {
        dialog.showErrorBox('Update konnte nicht gestartet werden', String(e));
        await updateRuntime!.close();
        host.allowClose();
        app.quit();
      } else host.resume();
      throw e;
    }
  });
  const updateTimer = setTimeout(() => {
    if (!host.stopping()) void updates.autoCheck();
  }, 15000);
  updateTimer.unref();
  return {
    close() {
      scope.dispose();
      clearTimeout(updateTimer);
    },
  };
}
