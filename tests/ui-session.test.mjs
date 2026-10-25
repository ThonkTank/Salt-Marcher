import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const runner = resolve('tools/ui-session.py');
const live = (pid) => {
  try {
    return (
      readFileSync('/proc/' + pid + '/stat', 'utf8')
        .split(') ')[1]
        .split(' ')[0] !== 'Z'
    );
  } catch {
    return false;
  }
};
test('UI session preserves child status and isolates inherited ownership', () => {
  const result = spawnSync(
    'python3',
    [
      runner,
      'python3',
      '-c',
      "import os,sys; assert int(os.environ['CODEX_OWNED_UI_SESSION'])==os.getsid(0)==os.getpgrp(); sys.exit(7)",
    ],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 7, result.stderr);
});
for (const detached of [false, true])
  test(
    'UI cleanup removes a TERM-resistant ' +
      (detached ? 'detached session' : 'descendant') +
      ' and preserves an unrelated process',
    () => {
      const root = mkdtempSync(join(tmpdir(), 'ui-session-')),
        pidfile = join(root, 'pid'),
        foreign = spawn('sleep', ['30'], {
          env: { ...process.env, CODEX_OWNED_UI_SESSION: 'unrelated-session' },
        });
      try {
        const script = `import subprocess,sys; p=subprocess.Popen([sys.executable,'-c','import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); print(\"ready\",flush=True); time.sleep(30)'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,start_new_session=${detached ? 'True' : 'False'}); p.stdout.readline(); open(sys.argv[1],'w').write(str(p.pid))`;
        const result = spawnSync('python3', [runner, 'python3', '-c', script, pidfile], {
          encoding: 'utf8',
          timeout: 10000,
        });
        assert.equal(result.status, 0, result.stderr);
        assert.equal(live(Number(readFileSync(pidfile, 'utf8'))), false);
        assert.equal(live(foreign.pid), true);
      } finally {
        try {
          const pid = Number(readFileSync(pidfile, 'utf8'));
          if (live(pid)) process.kill(pid, 'SIGKILL');
        } catch {}
        foreign.kill();
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

test('interrupting the UI owner cleans a resistant detached session without signaling a foreign session', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ui-session-interrupted-')),
    pidfile = join(root, 'pid'),
    foreign = spawn('sleep', ['30'], {
      env: { ...process.env, CODEX_OWNED_UI_SESSION: 'foreign-session' },
    });
  const script =
    "import subprocess,sys,time; p=subprocess.Popen([sys.executable,'-c','import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); print(\"ready\",flush=True); time.sleep(30)'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,start_new_session=True); p.stdout.readline(); open(sys.argv[1],'w').write(str(p.pid)); time.sleep(30)";
  const helper = spawn('python3', [runner, 'python3', '-c', script, pidfile], { stdio: 'ignore' });
  let timer;
  try {
    for (let i = 0; i < 200 && !existsSync(pidfile); i++)
      await new Promise((r) => setTimeout(r, 20));
    assert(existsSync(pidfile));
    const exited = new Promise((resolve) =>
      helper.once('exit', (code, signal) => resolve({ code, signal })),
    );
    helper.kill('SIGTERM');
    const result = await Promise.race([
      exited,
      new Promise(
        (_, reject) => (timer = setTimeout(() => reject(Error('UI cleanup timed out')), 10000)),
      ),
    ]);
    assert.deepEqual(result, { code: 130, signal: null });
    assert.equal(live(Number(readFileSync(pidfile, 'utf8'))), false);
    assert.equal(live(foreign.pid), true);
  } finally {
    clearTimeout(timer);
    if (live(helper.pid)) helper.kill('SIGKILL');
    try {
      const pid = Number(readFileSync(pidfile, 'utf8'));
      if (live(pid)) process.kill(pid, 'SIGKILL');
    } catch {}
    foreign.kill();
    rmSync(root, { recursive: true, force: true });
  }
});
