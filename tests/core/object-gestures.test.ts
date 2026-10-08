import { test } from "node:test";
import assert from "node:assert/strict";
import {
  objectWheelDirection, rotateObjectRadians, scaleObjectStep, cycledObjectId,
} from "../../src/features/objekte/object-gestures";

const degrees = (radians: number) => Math.round(radians * 180 / Math.PI);

test("Object Tool wheel and right press use the native directions and angular wrap", () => {
  assert.equal(objectWheelDirection(-120), 1);
  assert.equal(objectWheelDirection(120), -1);
  assert.equal(objectWheelDirection(0, -120), 1);
  assert.equal(objectWheelDirection(0), 0);
  assert.equal(degrees(rotateObjectRadians(0, 15)), 15);
  assert.equal(degrees(rotateObjectRadians(0, -15)), -15);
  assert.equal(degrees(rotateObjectRadians(0, 5)), 5);
  assert.equal(degrees(rotateObjectRadians(0, 90)), 90);
  assert.equal(degrees(rotateObjectRadians(0, -90)), -90);
  assert.equal(degrees(rotateObjectRadians(175 * Math.PI / 180, 15)), -170);
  assert.equal(degrees(rotateObjectRadians(90 * Math.PI / 180, 90)), -180);
});

test("Alt wheel requests additive scale and Shift wheel cycles current tiles", () => {
  assert.equal(scaleObjectStep(1, 1), 1.1);
  assert.equal(scaleObjectStep(1, -1), 0.9);
  assert.equal(scaleObjectStep(1.1, 1), 1.2);
  assert.equal(scaleObjectStep(0.1, -1), 0.1);
  assert.equal(scaleObjectStep(4, 1), 4);
  const visible = ["atlas-01", "atlas-02", "atlas-03"];
  assert.equal(cycledObjectId(visible, "atlas-02", -1), "atlas-01");
  assert.equal(cycledObjectId(visible, "atlas-02", 1), "atlas-03");
  assert.equal(cycledObjectId(visible, "atlas-01", -1), "atlas-03");
  assert.equal(cycledObjectId(visible, "atlas-03", 1), "atlas-01");
  assert.equal(cycledObjectId(visible, "", 1), undefined);
  assert.equal(cycledObjectId([], "atlas-01", 1), undefined);
});
