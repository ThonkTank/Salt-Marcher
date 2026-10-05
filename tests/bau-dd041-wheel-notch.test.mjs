import assert from "node:assert/strict";
import test from "node:test";
import { measuredCtrlWheelNotchFactor } from
  "../src/features/bau/dd041-wheel-notch.ts";

const measuredEvent = (deltaY) => ({
  ctrlKey: true, metaKey: false, shiftKey: false,
  deltaX: 0, deltaY, deltaMode: 0,
});

test("DD-041.04 one measured Ctrl+wheel detent matches native 100/125% steps", () => {
  const up = measuredCtrlWheelNotchFactor(measuredEvent(-100));
  const down = measuredCtrlWheelNotchFactor(measuredEvent(100));
  assert.equal(up, 1.25);
  assert.equal(down, 0.8);
  assert.equal(64 * up, 80);
  assert.equal(80 * down, 64);
  assert.equal(up * down, 1);
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
  ]) assert.equal(measuredCtrlWheelNotchFactor(event), null);
});
