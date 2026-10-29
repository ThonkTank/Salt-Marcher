import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { copyFile, cp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { runNativeProbe } from './native-session.mjs';
import { openNativeCampaign, revealWorkspaceNavigation } from './native-navigation.mjs';
import { readE2E02 } from './live-e2e02-fixture.mjs';
import { digest } from './atlas-e2e01-fixture.mjs';

/** Each controlled fault starts from its own byte-identical, immutable seed copy. */
export async function runE2E02Countercases({
  output,
  fixture,
  seedDatabaseHash,
  source,
  softwareGpu,
}) {
  const root = process.cwd(),
    passed = [];
  for (const kind of ['publish-failure', 'reply-loss']) {
    const childOutput = path.join(output, kind);
    await runNativeProbe(
      {
        output: childOutput,
        name: 'e2e02-' + kind,
        captureFrameTimeoutMs: 15000,
        closeCaptureTimeoutMs: 20000,
      },
      async (native) => {
        assert.equal(native.source, source);
        const file = path.join(native.profile, 'workbench.sqlite');
        await copyFile(path.join(output, 'seed.sqlite'), file);
        await cp(
          path.join(output, 'seed-player-images'),
          path.join(native.profile, 'player-images'),
          { recursive: true },
        );
        assert.equal(digest(await readFile(file)), seedDatabaseHash);
        const initial = readE2E02(file, fixture.a);
        let faultSql;
        if (kind === 'publish-failure') {
          // This is an actual SQLite write failure after live_scene was inserted
          // in the same transaction. No app data is written by the test process.
          faultSql =
            "CREATE TRIGGER e2e02_reject_clock BEFORE INSERT ON scene_clock BEGIN SELECT RAISE(ABORT,'E2E02 controlled clock write failure'); END";
          const Database = createRequire(import.meta.url)('better-sqlite3'),
            db = new Database(file);
          try {
            db.exec(faultSql);
          } finally {
            db.close();
          }
        }
        const injectedDatabaseHash = digest(await readFile(file));
        let page = await native.launch(
          1,
          softwareGpu
            ? {
                args: [
                  path.join(root, '.build/desktop/main.cjs'),
                  '--ozone-platform=x11',
                  '--use-gl=angle',
                  '--use-angle=swiftshader',
                  '--enable-unsafe-swiftshader',
                  '--disable-renderer-backgrounding',
                  '--disable-backgrounding-occluded-windows',
                  '--disable-background-timer-throttling',
                  '--data-dir',
                  native.profile,
                ],
              }
            : {},
        );
        page.setDefaultTimeout(15000);
        await native.app.evaluate(({ BrowserWindow, ipcMain }, fault) => {
          const window = BrowserWindow.getAllWindows().find((w) =>
            w.webContents.getURL().endsWith('/index.html'),
          );
          window.unmaximize();
          window.setContentSize(1400, 1000);
          const write = ipcMain._invokeHandlers.get('campaign:execute-live'),
            status = ipcMain._invokeHandlers.get('campaign:live-status');
          if (!write || !status) throw Error('Missing live write/status handlers');
          globalThis.e2e02Fault = {
            command: null,
            response: null,
            statusCommands: [],
            deliveries: 0,
          };
          ipcMain.removeHandler('campaign:execute-live');
          ipcMain.handle('campaign:execute-live', async (event, command) => {
            if (command.action.kind !== 'initialize') return write(event, command);
            globalThis.e2e02Fault.command = structuredClone(command);
            globalThis.e2e02Fault.event = event;
            globalThis.e2e02Fault.deliveries++;
            const result = await write(event, command);
            globalThis.e2e02Fault.response = result;
            if (fault === 'reply-loss' && globalThis.e2e02Fault.deliveries === 1) {
              if (!result.ok) throw Error('Cannot lose a response for an uncommitted command');
              throw Error('E2E02 controlled response loss after Initialize commit');
            }
            return result;
          });
          ipcMain.removeHandler('campaign:live-status');
          ipcMain.handle('campaign:live-status', async (event, command, token) => {
            globalThis.e2e02Fault.statusCommands.push(structuredClone(command));
            const result = await status(event, command, token);
            globalThis.e2e02Fault.statusResponse = result;
            return result;
          });
        }, kind);
        await openNativeCampaign(page, fixture.a);
        await revealWorkspaceNavigation(page);
        await page.locator('#live-tab').click();
        assert.deepEqual(readE2E02(file, fixture.a), initial);
        native.mark(
          kind === 'publish-failure'
            ? 'real transactional clock write rejection'
            : 'actual committed Initialize response lost',
        );
        await page.locator('#live-continue').click();
        await page.locator('#live-reconcile').waitFor({ state: 'visible' });
        assert.match(
          await page.locator('body').innerText(),
          kind === 'publish-failure'
            ? /E2E02 controlled clock write failure/
            : /E2E02 controlled response loss after Initialize commit/,
        );
        await native.capture(page, 'unconfirmed');
        let committed = readE2E02(file, fixture.a),
          replay;
        if (kind === 'publish-failure') {
          assert.deepEqual(
            committed,
            initial,
            'Clock write error published partial Scene/Clock/Party/Receipt data',
          );
        } else {
          assert.equal(committed.live_scene.length, 1);
          assert.equal(committed.live_state.length, 1);
          assert.equal(committed.live_receipt.length, initial.live_receipt.length + 1);
          replay = await native.app.evaluate(async ({ ipcMain }) => {
            const state = globalThis.e2e02Fault,
              prior = structuredClone(state.response),
              response = await ipcMain._invokeHandlers.get('campaign:execute-live')(
                state.event,
                state.command,
              );
            return { commandId: state.command.commandId, prior, response };
          });
          assert.deepEqual(replay.response, replay.prior);
          assert.deepEqual(
            readE2E02(file, fixture.a),
            committed,
            'Original Initialize CommandId replay duplicated a canonical effect',
          );
        }
        await page.locator('#live-reconcile').click();
        await page.locator('#live-reconcile').waitFor({ state: 'hidden' });
        assert.deepEqual(
          readE2E02(file, fixture.a),
          committed,
          'Read-only reconciliation mutated canonical facts',
        );
        const trace = await native.app.evaluate(() => {
          const { event, ...serializable } = globalThis.e2e02Fault;
          return serializable;
        });
        assert.equal(trace.deliveries, kind === 'publish-failure' ? 1 : 2);
        if (kind === 'publish-failure') {
          assert.equal(trace.response.ok, false);
          assert.match(trace.response.error, /E2E02 controlled clock write failure/);
        }
        assert.equal(trace.statusCommands.length, 1);
        assert.deepEqual(
          trace.statusCommands[0],
          trace.command,
          'Reconciliation must retain the original command and identity',
        );
        assert.equal(trace.statusResponse.ok, true);
        assert.equal(
          trace.statusResponse.value.outcome,
          kind === 'publish-failure' ? 'not-applied' : 'applied',
        );
        if (kind === 'reply-loss') {
          const receipt = committed.live_receipt.find(
            (r) => r.command_id === trace.command.commandId,
          );
          assert.deepEqual(JSON.parse(receipt.payload), trace.statusResponse.value.receipt);
          assert.deepEqual(trace.statusResponse.value.receipt, replay.prior.value);
        }
        await native.capture(page, 'resolved');
        await native.close();
        return {
          source,
          fixture,
          seedDatabaseHash,
          injectedDatabaseHash,
          faultSql,
          fault: kind,
          before: initial,
          after: committed,
          trace,
          replay,
          complete: false,
          faultAssertions: 'passed',
          humanAcceptance: false,
          installedPackageAcceptance: false,
        };
      },
    );
    passed.push({
      id: kind === 'publish-failure' ? 'E02-12-publish-failure' : 'E02-13-reply-loss-retry',
      status: 'passed',
      build: source,
      fixtureHash: seedDatabaseHash,
      fixtureRecipeHash: fixture.recipeHash,
      storage: true,
      visible: true,
      evidence: [kind + '/result.json', kind + '/unconfirmed.png', kind + '/resolved.png'],
    });
  }
  return passed;
}
