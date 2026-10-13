import test from 'node:test';
import assert from 'node:assert/strict';
import {preparationControls} from '../../src/app/preparation-controls';

const controls = (overrides: Partial<Parameters<typeof preparationControls>[0]> = {}) => preparationControls({
  dirty: false,
  blocked: false,
  sceneCount: 0,
  trashedNote: false,
  relationTargetCount: 0,
  ...overrides,
});

test('empty preparation does not offer actions without a target', () => {
  assert.deepEqual(controls(), { save: false, clearTimeline: false, addRelation: false });
});

test('open preparation input offers an explicit save unless writing is blocked', () => {
  assert.equal(controls({dirty: true}).save, true);
  assert.equal(controls({dirty: true, blocked: true}).save, false);
});

test('timeline and relationship actions require content they can affect', () => {
  assert.equal(controls({sceneCount: 1}).clearTimeline, true);
  assert.equal(controls({relationTargetCount: 1}).addRelation, true);
  assert.equal(controls({relationTargetCount: 1, trashedNote: true}).addRelation, false);
});
