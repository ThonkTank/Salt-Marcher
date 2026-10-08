// Read the real isolated framebuffer and send bounded original UI input.
// Not an original application model or a substitute for visual observation.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  session: { type: 'string' }, shot: { type: 'string' },
  click: { type: 'string' }, move: { type: 'string' }, key: { type: 'string' },
  text: { type: 'string' }, drag: { type: 'string' }, wheel: { type: 'string' },
  button: { type: 'string', default: 'left' },
  hold: { type: 'string' }, 'drag-key': { type: 'string' },
  'settle-ms': { type: 'string' },
} });
const settleMs = values['settle-ms'] === undefined ? undefined : Number(values['settle-ms']);
if (settleMs !== undefined && (!Number.isInteger(settleMs) || settleMs < 100 || settleMs > 5000))
  throw new Error('Settle time must be 100..5000 milliseconds');
const heldNames = values.hold?.split('+') || [];
if (heldNames.some(k => !['Control', 'Shift', 'Alt', 'Space'].includes(k)) || new Set(heldNames).size !== heldNames.length)
  throw new Error('Held pointer keys: Control, Shift, Alt, Space; no duplicates');
if (values.hold && (!(values.click || values.drag || values.wheel) || values.key || values.text))
  throw new Error('Hold requires pointer input and cannot combine with key/text');
if (values['drag-key'] && (!values.drag || values['drag-key'] !== 'Escape'))
  throw new Error('Drag interruption supports Escape during a drag only');
const buttonMask = { left: 1, middle: 2, right: 4 }[values.button];
if (!buttonMask) throw new Error('Mouse button must be left, middle or right');
if (values.button !== 'left' && !values.click && !values.drag) throw new Error('Mouse button requires click or drag');
const sessionPath = values.session;
const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
if (session.state !== 'running' || session.role !== 'actual_original_runtime') throw new Error('Not a live original session');
for (const p of session.processes) {
  const ticks = fs.readFileSync(`/proc/${p.pid}/stat`, 'utf8').split(') ')[1].split(' ')[19];
  if (ticks !== p.startTicks || fs.realpathSync(`/proc/${p.pid}/exe`) !== fs.realpathSync(p.executable))
    throw new Error('Original process identity changed');
}
const socket = net.createConnection({ host: '127.0.0.1', port: session.port });
socket.setTimeout(7000, () => socket.destroy(new Error('Original RFB timeout')));
let buffer = Buffer.alloc(0), pending, failure;
socket.on('data', data => { buffer = Buffer.concat([buffer, data]); pending?.(); });
socket.on('error', error => { failure = error; pending?.(); });
socket.on('close', () => { failure ||= new Error('RFB connection closed'); pending?.(); });
async function take(size) {
  while (buffer.length < size) {
    if (failure) throw failure;
    await new Promise(resolve => { pending = resolve; }); pending = undefined;
  }
  const result = buffer.subarray(0, size); buffer = buffer.subarray(size); return result;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const actions = [];
let heldCodes = [];
const point = value => {
  const p = value.split(',').map(Number);
  if (p.length !== 2 || !p.every(Number.isInteger) || p[0] < 0 || p[1] < 0 || p[0] >= session.width || p[1] >= session.height)
    throw new Error('Coordinates outside original frame');
  return p;
};
function pointer([x, y], buttons = 0) {
  const b = Buffer.alloc(6); b[0] = 5; b[1] = buttons; b.writeUInt16BE(x, 2); b.writeUInt16BE(y, 4); socket.write(b);
}
function key(symbol, down) {
  const b = Buffer.alloc(8); b[0] = 4; b[1] = down ? 1 : 0; b.writeUInt32BE(symbol, 4); socket.write(b);
}
const keys = { Escape: 0xff1b, Enter: 0xff0d, Tab: 0xff09, Backspace: 0xff08, Delete: 0xffff,
  Control: 0xffe3, Shift: 0xffe1, Alt: 0xffe9, Space: 0x20, Left: 0xff51, Up: 0xff52, Right: 0xff53, Down: 0xff54 };
try {
  socket.write(await take(12));
  const count = (await take(1))[0];
  if (!(await take(count)).includes(1)) throw new Error('Expected isolated no-auth RFB');
  socket.write(Buffer.from([1]));
  if ((await take(4)).readUInt32BE() !== 0) throw new Error('RFB authentication failed');
  socket.write(Buffer.from([1]));
  const init = await take(24), width = init.readUInt16BE(), height = init.readUInt16BE(2);
  await take(init.readUInt32BE(20));
  if (width !== session.width || height !== session.height) throw new Error('Original frame dimensions changed');
  const format = Buffer.alloc(20); format[4] = 32; format[5] = 24; format[7] = 1;
  for (const offset of [8, 10, 12]) format.writeUInt16BE(255, offset);
  format[14] = 16; format[15] = 8; socket.write(format);
  socket.write(Buffer.from([2, 0, 0, 1, 0, 0, 0, 0])); // raw rectangles only
  if (heldNames.length) {
    heldCodes = heldNames.map(k => keys[k]);
    for (const k of heldCodes) key(k, true);
    actions.push({ holdBegin: values.hold }); await pause(80);
  }
  if (values.move) { pointer(point(values.move)); actions.push({ move: values.move }); }
  if (values.click) {
    const p = point(values.click); pointer(p); await pause(100); pointer(p, buttonMask); await pause(100); pointer(p);
    actions.push({ click: values.click, button: values.button });
  }
  if (values.drag) {
    const [a, b] = values.drag.split(':').map(point); if (!a || !b) throw new Error('drag start:end required');
    pointer(a); await pause(100); pointer(a, buttonMask);
    for (let i = 1; i <= 16; i++) {
      pointer([Math.round(a[0] + (b[0] - a[0]) * i / 16), Math.round(a[1] + (b[1] - a[1]) * i / 16)], buttonMask); await pause(60);
      if (i === 8 && values['drag-key']) {
        key(keys.Escape, true); await pause(80); key(keys.Escape, false);
      }
    }
    pointer(b); actions.push({ drag: values.drag, button: values.button,
      ...(values['drag-key'] ? { duringDrag: { key: 'Escape', afterStep: 8, totalSteps: 16 } } : {}) });
  }
  if (values.wheel) {
    const [position, ticks] = values.wheel.split(':'); const p = point(position), n = Number(ticks);
    if (!Number.isInteger(n) || Math.abs(n) > 20) throw new Error('Wheel range -20..20');
    for (let i = 0; i < Math.abs(n); i++) { pointer(p, n > 0 ? 8 : 16); pointer(p); await pause(100); }
    actions.push({ wheel: values.wheel });
  }
  if (heldCodes.length) {
    for (const k of heldCodes.toReversed()) key(k, false);
    heldCodes = []; actions.push({ holdEnd: values.hold }); await pause(80);
  }
  if (values.key) {
    const codes = values.key.split('+').map(k => keys[k] ?? (k.length === 1 ? k.codePointAt(0) : undefined));
    if (codes.some(k => k === undefined)) throw new Error('Unknown key');
    for (const k of codes) key(k, true); await pause(80); for (const k of codes.toReversed()) key(k, false);
    actions.push({ key: values.key });
  }
  if (values.text) {
    if (values.text.length > 1000) throw new Error('Input text too long');
    for (const c of values.text) { const u = c.codePointAt(0); const k = u < 256 ? u : 0x01000000 + u; key(k, true); key(k, false); await pause(12); }
    actions.push({ text: values.text });
  }
  const captureSettleMs = settleMs ?? (actions.length ? 650 : 100);
  await pause(captureSettleMs);
  const record = { sessionId: session.id, role: session.role, executableSha256: session.executableSha256,
    capturedAt: new Date().toISOString(), inputKind: session.inputKind, actions, captureSettleMs };
  if (values.shot) {
    if (!/^[A-Za-z0-9_-]+$/.test(values.shot)) throw new Error('Safe screenshot id required');
    const target = path.join(session.run, 'screens', values.shot + '.png');
    if (fs.existsSync(target)) throw new Error('Screenshot id already used');
    const request = Buffer.alloc(10); request[0] = 3; request.writeUInt16BE(width, 6); request.writeUInt16BE(height, 8); socket.write(request);
    const png = new PNG({ width, height });
    let painted = 0;
    while (painted < width * height) {
      const type = (await take(1))[0];
      if (type === 2) continue;
      if (type === 3) { const h = await take(7); await take(h.readUInt32BE(3)); continue; }
      if (type !== 0) throw new Error('Unexpected RFB message');
      const h = await take(3), rectangles = h.readUInt16BE(1);
      for (let i = 0; i < rectangles; i++) {
        const r = await take(12), x = r.readUInt16BE(), y = r.readUInt16BE(2), w = r.readUInt16BE(4), h = r.readUInt16BE(6);
        if (r.readInt32BE(8) !== 0 || x + w > width || y + h > height) throw new Error('Unsupported original rectangle');
        const data = await take(w * h * 4);
        for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
          const source = (row * w + col) * 4, dest = ((y + row) * width + x + col) * 4;
          png.data[dest] = data[source + 2]; png.data[dest + 1] = data[source + 1]; png.data[dest + 2] = data[source]; png.data[dest + 3] = 255;
        }
        painted += w * h;
      }
    }
    const bytes = PNG.sync.write(png); fs.writeFileSync(target, bytes);
    Object.assign(record, { screenshot: target, screenshotSha256: createHash('sha256').update(bytes).digest('hex'), width, height });
    fs.writeFileSync(target.replace(/\.png$/, '.json'), JSON.stringify(record, null, 2) + '\n');
    console.log(target);
  }
  fs.appendFileSync(path.join(session.run, 'input.jsonl'), JSON.stringify(record) + '\n');
} finally {
  if (heldCodes.length && !socket.destroyed) {
    for (const k of heldCodes.toReversed()) key(k, false);
    await pause(80);
  }
  socket.destroy();
}
