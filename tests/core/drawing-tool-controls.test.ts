import test from 'node:test';
import assert from 'node:assert/strict';
import {drawingToolControls} from '../../src/app/drawing-tool-controls';

test('selection mode hides drawing-only controls and actions', () => {
  assert.deepEqual(drawingToolControls('select', false, false, 0), {
    active: false,
    brush: false,
    append: false,
    roomName: false,
    options: false,
    object: false,
    light: false,
    text: false,
    actionEnabled: false,
    instruction: 'Raum oder Element auswählen; Raumecken lassen sich direkt ziehen.',
  });
});

test('a first room asks for a name while an appended room shape does not', () => {
  const first = drawingToolControls('room-rectangle', false, true, 2);
  assert.equal(first.append, false);
  assert.equal(first.roomName, true);
  assert.equal(first.actionEnabled, true);
  const appended = drawingToolControls('room-rectangle', true, true, 2);
  assert.equal(appended.append, true);
  assert.equal(appended.roomName, false);
});

test('element tools expose only their relevant settings', () => {
  const object = drawingToolControls('object', true, false, 0);
  assert.equal(object.options, true);
  assert.equal(object.object, true);
  assert.equal(object.light, false);
  assert.equal(object.text, false);
  assert.equal(object.actionEnabled, false);
  assert.equal(drawingToolControls('light', true, false, 1).light, true);
  assert.equal(drawingToolControls('text', true, false, 1).text, true);
  assert.equal(drawingToolControls('room-cave', true, false, 1).brush, true);
});
