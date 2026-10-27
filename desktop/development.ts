import { BrowserWindow } from 'electron';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const prefix = 'SALTMARCHER_DEV ';
const styles = new Set(['app.css', 'player.css', 'preset-settings.css']);

/** Compiled out of the product build. Only the launcher's inherited stdin is a command source. */
export function connectDevelopment(window: BrowserWindow, root: string) {
  const token = process.env.SALTMARCHER_DEV_TOKEN;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const send = (message: object) => process.stdout.write(prefix + JSON.stringify(message) + '\n');
  const close = () => {
    if (!window.isDestroyed()) window.close();
  };
  let buffer = '';
  let operations = Promise.resolve();
  async function handle(message: { id: number; action: string; files?: string[] }) {
    try {
      if (message.action === 'close') {
        close();
        send({ id: message.id, ok: true });
      } else if (message.action === 'styles') {
        const files = message.files;
        if (!Array.isArray(files) || !files.length || files.some((file) => !styles.has(file)))
          throw Error('Unknown development stylesheet');
        const sheets = await Promise.all(
          files.map(async (name) => ({
            name,
            text: await readFile(path.join(root, name), 'utf8'),
          })),
        );
        for (const target of BrowserWindow.getAllWindows()) {
          const url = target.webContents.getURL();
          if (
            url !== 'campaign://app/index.html' &&
            url !== 'campaign://player/player-display.html'
          )
            continue;
          // Replace the existing sheet in its original cascade position. Appending
          // overrides would leave deleted declarations active and could lose focus.
          await target.webContents.executeJavaScript(`(() => {
            const updates = ${JSON.stringify(sheets)};
            for (const update of updates) {
              const link = [...document.querySelectorAll('link[rel="stylesheet"]')].find(node => new URL(node.href).pathname === '/' + update.name);
              if (!link?.sheet) continue;
              const parsed = new CSSStyleSheet(); parsed.replaceSync(update.text);
              const rules = [...parsed.cssRules].map(rule => rule.cssText);
              while (link.sheet.cssRules.length) link.sheet.deleteRule(0);
              for (const rule of rules) link.sheet.insertRule(rule, link.sheet.cssRules.length);
            }
          })()`);
        }
        send({ id: message.id, ok: true });
      } else throw Error('Unknown development action');
    } catch (error) {
      send({
        id: message.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk;
    if (buffer.length > 65536) {
      buffer = '';
      return;
    }
    let end: number;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      try {
        const message = JSON.parse(line);
        if (
          message.kind !== 'saltmarcher-dev' ||
          message.token !== token ||
          !Number.isSafeInteger(message.id)
        )
          continue;
        operations = operations.then(() => handle(message));
      } catch {
        /* Unrelated terminal input is not a development command. */
      }
    }
  });
  process.stdin.on('end', close);
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
  send({ event: 'ready', pid: process.pid });
  return {
    closed(databaseClosed: boolean) {
      send({ event: 'closed', databaseClosed });
    },
  };
}
