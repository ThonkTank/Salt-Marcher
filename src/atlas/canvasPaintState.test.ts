import { expect, it } from "vitest";
import {
  CanvasPaintTracker,
  canvasPainted,
  type CanvasPaintState,
} from "./canvasPaintState";

it("acknowledges both draws, rejects superseded callbacks, and identifies camera and presentation changes", () => {
  let state: CanvasPaintState | null = null;
  const tracker = new CanvasPaintTracker((s) => {
    state = s;
  });
  const version = { sessionId: "one", revision: 2 },
    presentation = {},
    camera = {};
  tracker.context(version, presentation, camera, true, false);
  const oldBase = tracker.request("base");
  const overlay = tracker.request("overlay");
  expect(canvasPainted(state)).toBe(false);
  const base = tracker.request("base");
  oldBase();
  overlay();
  expect(canvasPainted(state)).toBe(false);
  base();
  expect(canvasPainted(state)).toBe(true);
  expect(state).toMatchObject({
    version,
    presentationGeneration: 1,
    cameraGeneration: 1,
  });
  tracker.context(version, presentation, {}, false, true);
  expect(canvasPainted(state)).toBe(false);
  expect(state).toMatchObject({
    presentationGeneration: 1,
    cameraGeneration: 2,
    writesPending: true,
  });
  tracker.context({ sessionId: "two", revision: 0 }, {}, camera, true, false);
  expect(state).toMatchObject({
    version: { sessionId: "two", revision: 0 },
    presentationGeneration: 2,
    cameraGeneration: 3,
  });
  expect(canvasPainted(state)).toBe(false);
  const late = tracker.request("base");
  tracker.clear();
  late();
  expect(state).toBeNull();
});
