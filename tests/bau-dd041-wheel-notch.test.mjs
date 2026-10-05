import assert from "node:assert/strict";
import test from "node:test";
import { measuredCtrlWheelNotchFactor } from
  "../src/features/bau/dd041-wheel-notch.ts";

const measuredEvent = (deltaY) => ({
  ctrlKey: true, metaKey: false, shiftKey: false,
  deltaX: 0, deltaY, deltaMode: 0,
});

test("DD-041.04 measured Ctrl+wheel ladder matches native 50–200%", () => {
  const scales = [32, 48, 64, 80, 96, 128];
  for (let i = 0; i < scales.length - 1; i++) {
    const up = measuredCtrlWheelNotchFactor(measuredEvent(-100), scales[i]);
    const down = measuredCtrlWheelNotchFactor(measuredEvent(100), scales[i + 1]);
    assert.equal(scales[i] * up, scales[i + 1]);
    assert.equal(scales[i + 1] * down, scales[i]);
  }
});

test("DD-041.04 leaves unmeasured wheel forms to the existing navigation path", () => {
  for (const event of [
    measuredEvent(0),
    measuredEvent(-8),
    { ...measuredEvent(-100), ctrlKey: false },
    { ...measuredEvent(-100), metaKey: true },
    { ...measuredEvent(-100), shiftKey: true },
    { ...measuredEvent(-100), deltaX: 2 },
    { ...measuredEvent(-100), deltaMode: 1 },
  ]) assert.equal(measuredCtrlWheelNotchFactor(event, 64), null);
  assert.equal(measuredCtrlWheelNotchFactor(measuredEvent(-100), 65), null);
  assert.equal(measuredCtrlWheelNotchFactor(measuredEvent(100), 32), null);
  assert.equal(measuredCtrlWheelNotchFactor(measuredEvent(-100), 128), null);
});
