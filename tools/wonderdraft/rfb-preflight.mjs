import fs from 'node:fs';
import path from 'node:path';

export const RFB_KEYS = { Escape: 0xff1b, Enter: 0xff0d, Tab: 0xff09, Backspace: 0xff08, Delete: 0xffff,
  Control: 0xffe3, Shift: 0xffe1, Alt: 0xffe9, Space: 0x20, Left: 0xff51, Up: 0xff52, Right: 0xff53, Down: 0xff54 };
for (let n = 1; n <= 12; n++) RFB_KEYS[`F${n}`] = 0xffbd + n;

/** Read-only validation of the complete request, before opening the transport. */
export function preflightRfbInput(values, session) {
  if (session.state !== 'running' || session.role !== 'actual_original_runtime') throw new Error('Not a live original session');
  if (!path.isAbsolute(session.run) || ![session.width, session.height].every(n => Number.isInteger(n) && n > 0 && n <= 65535))
    throw new Error('Invalid original frame/run');
  const point = value => {
    const parts = value.split(',');
    const p = parts.map(Number);
    if (parts.length !== 2 || parts.some(s => !s.trim()) || !p.every(Number.isInteger) ||
      p[0] < 0 || p[1] < 0 || p[0] >= session.width || p[1] >= session.height)
      throw new Error('Coordinates outside original frame');
    return p;
  };
  const clickMs = values['click-ms'] === undefined ? 100 : Number(values['click-ms']);
  if (!Number.isInteger(clickMs) || clickMs < 100 || clickMs > 2000 || (values['click-ms'] !== undefined && !values.click))
    throw new Error('Click duration requires click input and must be 100..2000 milliseconds');
  const settleMs = values['settle-ms'] === undefined ? undefined : Number(values['settle-ms']);
  if (settleMs !== undefined && (!Number.isInteger(settleMs) || settleMs < 100 || settleMs > 5000))
    throw new Error('Settle time must be 100..5000 milliseconds');
  const heldNames = values.hold?.split('+') || [];
  if (heldNames.some(k => !['Control', 'Shift', 'Alt', 'Space'].includes(k)) || new Set(heldNames).size !== heldNames.length)
    throw new Error('Held pointer keys: Control, Shift, Alt, Space; no duplicates');
  if (values.hold && (!(values.click || values.drag || values.wheel) || values.key !== undefined || values.text !== undefined))
    throw new Error('Hold requires pointer input and cannot combine with key/text');
  if (values['drag-key'] !== undefined && (!values.drag || values['drag-key'] !== 'Escape'))
    throw new Error('Drag interruption supports Escape during a drag only');
  const button = values.button ?? 'left', buttonMask = { left: 1, middle: 2, right: 4 }[button];
  if (!buttonMask) throw new Error('Mouse button must be left, middle or right');
  if (button !== 'left' && !values.click && !values.drag) throw new Error('Mouse button requires click or drag');
  const move = values.move === undefined ? undefined : point(values.move);
  const click = values.click === undefined ? undefined : point(values.click);
  let drag;
  if (values.drag !== undefined) {
    const parts = values.drag.split(':');
    if (parts.length !== 2) throw new Error('drag start:end required');
    drag = parts.map(point);
  }
  let stroke;
  if (values['stroke-file'] !== undefined) {
    if (['click', 'drag', 'move', 'wheel', 'key', 'text', 'hold', 'drag-key'].some(k => values[k] !== undefined))
      throw new Error('Timed stroke must be a separate input request');
    const file = values['stroke-file'];
    if (!path.isAbsolute(file) || fs.statSync(file).size > 100000) throw new Error('Bounded absolute stroke file required');
    const points = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(points) || points.length < 2 || points.length > 1000) throw new Error('Stroke needs 2–1000 timed points');
    let prior = -1;
    stroke = points.map(p => {
      if (!p || ![p.x, p.y, p.t].every(Number.isFinite) || !Number.isInteger(p.t) || p.t < prior || p.t < 0 || p.t > 60000)
        throw new Error('Stroke time invalid');
      prior = p.t;
      const [x, y] = point(p.x + ',' + p.y);
      return { x, y, t: p.t };
    });
    if (stroke[0].t !== 0 || stroke.at(-1).t < 1) throw new Error('Stroke starts at zero and needs duration');
  }
  let wheel;
  if (values.wheel !== undefined) {
    const parts = values.wheel.split(':');
    if (parts.length !== 2 || !parts[1].trim()) throw new Error('Wheel position:ticks required');
    const p = point(parts[0]), n = Number(parts[1]);
    if (!Number.isInteger(n) || Math.abs(n) > 20) throw new Error('Wheel range -20..20');
    wheel = { point: p, ticks: n };
  }
  const keyCodes = values.key === undefined ? undefined : values.key.split('+').map(k => RFB_KEYS[k] ?? (k.length === 1 ? k.codePointAt(0) : undefined));
  if (keyCodes?.some(k => k === undefined)) throw new Error('Unknown key');
  if (values.text !== undefined && values.text.length > 1000) throw new Error('Input text too long');
  const textCodes = values.text === undefined ? undefined : [...values.text].map(c => {
    const u = c.codePointAt(0); return u < 256 ? u : 0x01000000 + u;
  });
  let shotTarget, metadataTarget;
  if (values.shot !== undefined) {
    if (!/^[A-Za-z0-9_-]+$/.test(values.shot)) throw new Error('Safe screenshot id required');
    shotTarget = path.join(session.run, 'screens', values.shot + '.png');
    metadataTarget = path.join(session.run, 'screens', values.shot + '.json');
    if (fs.existsSync(shotTarget) || fs.existsSync(metadataTarget)) throw new Error('Screenshot id already used');
    const directory = path.dirname(shotTarget);
    if (!fs.statSync(directory).isDirectory()) throw new Error('Screenshot directory required');
    fs.accessSync(directory, fs.constants.W_OK);
  }
  return { clickMs, settleMs, heldNames, heldCodes: heldNames.map(k => RFB_KEYS[k]), buttonMask,
    move, click, drag, stroke, wheel, keyCodes, textCodes, shotTarget, metadataTarget };
}
