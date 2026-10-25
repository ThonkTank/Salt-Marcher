import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { preflightRfbInput, RFB_KEYS } from '../../tools/wonderdraft/rfb-preflight.mjs';
const exec = promisify(execFile),
  cli = path.resolve('tools/wonderdraft/rfb.mjs');
function fixture() {
  const run = fs.mkdtempSync(path.join(os.tmpdir(), 'rfb-preflight-'));
  fs.mkdirSync(path.join(run, 'screens'));
  const session = {
    state: 'running',
    role: 'actual_original_runtime',
    run,
    width: 64,
    height: 48,
    id: 'synthetic-transport-unit-test',
    processes: [],
    inputKind: 'synthetic_test',
    executableSha256: 'test-only',
  };
  return { run, session, remove: () => fs.rmSync(run, { recursive: true, force: true }) };
}
test('preflight parses complete valid request and preserves gesture limits', () => {
  const f = fixture();
  try {
    const p = preflightRfbInput(
      {
        move: '0,0',
        click: '63,47',
        drag: '1,2:62,46',
        wheel: '5,6:-20',
        button: 'middle',
        hold: 'Control+Space',
        'drag-key': 'Escape',
        'click-ms': '2000',
        'settle-ms': '5000',
        shot: '001-core',
      },
      f.session,
    );
    assert.deepEqual(p.drag, [
      [1, 2],
      [62, 46],
    ]);
    assert.deepEqual(p.wheel, { point: [5, 6], ticks: -20 });
    assert.deepEqual(p.heldCodes, [RFB_KEYS.Control, RFB_KEYS.Space]);
    assert.equal(p.buttonMask, 2);
    assert.equal(p.clickMs, 2000);
    assert.equal(p.settleMs, 5000);
    const keys = preflightRfbInput({ key: 'Control+F12', text: 'AΩ🙂' }, f.session);
    assert.deepEqual(keys.keyCodes, [RFB_KEYS.Control, RFB_KEYS.F12]);
    assert.deepEqual(keys.textCodes, [65, 0x010003a9, 0x0101f642]);
  } finally {
    f.remove();
  }
});
test('invalid later arguments and occupied evidence fail before any TCP connection', async () => {
  const f = fixture();
  let connections = 0;
  const server = net.createServer((socket) => {
    connections++;
    socket.destroy();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const sessionPath = path.join(f.run, 'session.json');
  fs.writeFileSync(sessionPath, JSON.stringify({ ...f.session, port: server.address().port }));
  fs.writeFileSync(path.join(f.run, 'screens', 'occupied.png'), 'preserve-png');
  fs.writeFileSync(path.join(f.run, 'screens', 'orphan.json'), 'preserve-metadata');
  const cases = [
    ['--shot', '../escape'],
    ['--shot', ''],
    ['--shot', 'occupied'],
    ['--shot', 'orphan'],
    ['--move', '64,0'],
    ['--drag', '1,2:3,4:5,6'],
    ['--drag', '1,2:3,'],
    ['--wheel', '1,2:21'],
    ['--wheel', '1,2:'],
    ['--wheel', '1,2:1:2'],
    ['--key', 'Control+Missing'],
    ['--text', 'x'.repeat(1001)],
    ['--hold', 'Control+Control'],
    ['--drag-key', 'Escape'],
    ['--click-ms', '99'],
    ['--settle-ms', '5001'],
  ];
  try {
    for (const args of cases) {
      // A valid early click must not execute before rejecting a later argument.
      await assert.rejects(
        exec(process.execPath, [cli, '--session', sessionPath, '--click', '1,2', ...args], {
          timeout: 10000,
        }),
      );
      assert.equal(connections, 0, args[0] + ' ' + args[1].slice(0, 40));
    }
    assert.equal(
      fs.readFileSync(path.join(f.run, 'screens', 'occupied.png'), 'utf8'),
      'preserve-png',
    );
    assert.equal(
      fs.readFileSync(path.join(f.run, 'screens', 'orphan.json'), 'utf8'),
      'preserve-metadata',
    );
    assert.equal(fs.existsSync(path.join(f.run, 'input.jsonl')), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    f.remove();
  }
});
test('valid CLI still transmits inputs and records its test framebuffer', async () => {
  const f = fixture(),
    messages = [],
    sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    let data = Buffer.alloc(0),
      stage = 0;
    socket.write('RFB 003.008\n');
    socket.on('data', (bytes) => {
      data = Buffer.concat([data, bytes]);
      while (data.length) {
        if (stage === 0) {
          if (data.length < 12) return;
          data = data.subarray(12);
          socket.write(Buffer.from([1, 1]));
          stage++;
        } else if (stage === 1) {
          data = data.subarray(1);
          socket.write(Buffer.alloc(4));
          stage++;
        } else if (stage === 2) {
          data = data.subarray(1);
          const init = Buffer.alloc(24);
          init.writeUInt16BE(64);
          init.writeUInt16BE(48, 2);
          socket.write(init);
          stage++;
        } else {
          const type = data[0],
            size =
              type === 0
                ? 20
                : type === 2
                  ? data.length < 4
                    ? 4
                    : 4 + 4 * data.readUInt16BE(2)
                  : type === 3
                    ? 10
                    : type === 4
                      ? 8
                      : type === 5
                        ? 6
                        : 0;
          if (!size) {
            socket.destroy();
            return;
          }
          if (data.length < size) return;
          const message = Buffer.from(data.subarray(0, size));
          data = data.subarray(size);
          messages.push(message);
          if (type === 3) {
            const header = Buffer.alloc(16);
            header.writeUInt16BE(1, 2);
            header.writeUInt16BE(64, 8);
            header.writeUInt16BE(48, 10);
            socket.write(Buffer.concat([header, Buffer.alloc(64 * 48 * 4, 127)]));
          }
        }
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const sessionPath = path.join(f.run, 'session.json');
  fs.writeFileSync(sessionPath, JSON.stringify({ ...f.session, port: server.address().port }));
  try {
    await exec(
      process.execPath,
      [
        cli,
        '--session',
        sessionPath,
        '--move',
        '1,2',
        '--click',
        '3,4',
        '--key',
        'Control+s',
        '--text',
        'AΩ🙂',
        '--shot',
        'valid',
        '--settle-ms',
        '100',
      ],
      { timeout: 10000 },
    );
    const pointers = messages.filter((b) => b[0] === 5);
    assert.deepEqual(
      pointers.map((b) => [b[1], b.readUInt16BE(2), b.readUInt16BE(4)]),
      [
        [0, 1, 2],
        [0, 3, 4],
        [1, 3, 4],
        [0, 3, 4],
      ],
    );
    const keys = messages.filter((b) => b[0] === 4).map((b) => [b[1], b.readUInt32BE(4)]);
    assert.deepEqual(keys, [
      [1, RFB_KEYS.Control],
      [1, 115],
      [0, 115],
      [0, RFB_KEYS.Control],
      [1, 65],
      [0, 65],
      [1, 0x010003a9],
      [0, 0x010003a9],
      [1, 0x0101f642],
      [0, 0x0101f642],
    ]);
    const metadata = JSON.parse(fs.readFileSync(path.join(f.run, 'screens', 'valid.json')));
    assert.equal(metadata.sessionId, f.session.id);
    assert.equal(metadata.width, 64);
    assert.equal(metadata.height, 48);
    assert.equal(
      metadata.screenshotSha256,
      createHash('sha256')
        .update(fs.readFileSync(path.join(f.run, 'screens', 'valid.png')))
        .digest('hex'),
    );
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(f.run, 'input.jsonl'))).screenshotSha256,
      metadata.screenshotSha256,
    );
    messages.length = 0;
    const strokeFile = path.join(f.run, 'stroke.json');
    fs.writeFileSync(
      strokeFile,
      JSON.stringify([
        { x: 2, y: 3, t: 0 },
        { x: 20, y: 30, t: 200 },
        { x: 2, y: 3, t: 400 },
      ]),
    );
    await exec(
      process.execPath,
      [
        cli,
        '--session',
        sessionPath,
        '--stroke-file',
        strokeFile,
        '--shot',
        'stroke',
        '--settle-ms',
        '100',
      ],
      { timeout: 10000 },
    );
    assert.deepEqual(
      messages.filter((b) => b[0] === 5).map((b) => [b[1], b.readUInt16BE(2), b.readUInt16BE(4)]),
      [
        [0, 2, 3],
        [1, 2, 3],
        [1, 20, 30],
        [1, 2, 3],
        [0, 2, 3],
      ],
    );
    const stroke = JSON.parse(fs.readFileSync(path.join(f.run, 'screens', 'stroke.json')))
      .actions[0];
    assert.equal(stroke.requestedMs, 400);
    assert(stroke.actualMs >= 380 && stroke.actualMs < 1000);
    assert.equal(stroke.points.length, 3);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
    f.remove();
  }
});

test('timed original strokes validate every point and duration before transport', () => {
  const f = fixture();
  try {
    const file = path.join(f.run, 'stroke.json'),
      points = [
        { x: 1, y: 2, t: 0 },
        { x: 20, y: 10, t: 500 },
        { x: 40, y: 20, t: 1000 },
      ];
    fs.writeFileSync(file, JSON.stringify(points));
    assert.deepEqual(preflightRfbInput({ 'stroke-file': file }, f.session).stroke, points);
    assert.throws(
      () => preflightRfbInput({ 'stroke-file': file, click: '1,2' }, f.session),
      /separate/,
    );
    for (const bad of [
      [
        { x: 1, y: 2, t: 10 },
        { x: 20, y: 2, t: 500 },
      ],
      [
        { x: 1, y: 2, t: 0 },
        { x: 64, y: 2, t: 500 },
      ],
      [
        { x: 1, y: 2, t: 0 },
        { x: 20, y: 2, t: 60001 },
      ],
      [
        { x: 1, y: 2, t: 0 },
        { x: 20, y: 2, t: 500 },
        { x: 20, y: 2, t: 400 },
      ],
    ]) {
      fs.writeFileSync(file, JSON.stringify(bad));
      assert.throws(() => preflightRfbInput({ 'stroke-file': file }, f.session));
    }
  } finally {
    f.remove();
  }
});
