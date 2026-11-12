import { describe, expect, it } from "vitest";
import {
  directionContent,
  directionPoints,
  directionProbes,
} from "../../../scripts/atlas-p0-collection.mjs";
import { R4_REQUIREMENTS } from "../../../scripts/atlas-p0-evaluate.mjs";
import { referenceC1Stroke } from "../../../scripts/atlas-p0-brush-reference.mjs";

describe("fixed R4 native programs and author observation bridge", () => {
  it("keeps real short endpoints outside the original brush at every selected scale", () => {
    for (const spec of R4_REQUIREMENTS.scenarios.filter(
      (entry) => entry.gesture === "swipe",
    )) {
      const points = directionPoints(spec);
      const radius = spec.diameter / (2 * spec.scale);
      expect(
        Math.hypot(
          points.at(-1)![0] - points[0][0],
          points.at(-1)![1] - points[0][1],
        ),
      ).toBeGreaterThan(radius);
      expect(
        points
          .flat()
          .every(
            (axis) => Number.isFinite(axis) && Math.abs(axis) <= 100_000_000,
          ),
      ).toBe(true);
      const level = Math.max(
        0,
        Math.min(21, Math.floor(Math.log2(radius / 40))),
      );
      expect(level).toBe(spec.level);
    }
  });

  it("keeps the full continuous curve and fixed bounded cubic stencils", () => {
    const spec = R4_REQUIREMENTS.scenarios.find(
      (entry) => entry.gesture === "curve",
    )!;
    const points = directionPoints(spec);
    expect(points.length * R4_REQUIREMENTS.intervalMs).toBeGreaterThanOrEqual(
      10_000,
    );
    expect(Math.max(...points.map((point) => point[1]))).toBeGreaterThan(0);
    expect(Math.min(...points.map((point) => point[1]))).toBeLessThan(0);
    const manifest = directionProbes(points, spec.level);
    expect(manifest.probes.length).toBeLessThanOrEqual(256);
    expect(
      new Set(manifest.regions.flatMap((region) => region.indices)).size,
    ).toBe(manifest.probes.length);
    expect(manifest.centerline[0]).toEqual(points[0]);
    expect(manifest.centerline.at(-1)).toEqual(points.at(-1));
    const exterior =
      manifest.probes[
        manifest.regions.find((region) => region.id === "shortcut-exterior")!
          .indices[0]
      ];
    const input = {
      brush: {
        level: spec.level,
        radius: spec.diameter / (2 * spec.scale),
        amount: 1,
      },
      start: { point: points[0], at: 0, input: 1 },
      windows: points.slice(1).map((point, index) => ({
        at: (index + 1) * 24,
        points: [{ point, at: (index + 1) * 24, input: index + 2 }],
        end: index === points.length - 2,
      })),
    };
    expect(referenceC1Stroke(input, [exterior]).floor[0]).toBe(0);
    const chord = {
      ...input,
      windows: [
        {
          at: 24,
          points: [{ point: points.at(-1)!, at: 24, input: 2 }],
          end: true,
        },
      ],
    };
    expect(referenceC1Stroke(chord, [exterior]).floor[0]).toBeGreaterThan(0);
    for (const point of manifest.centerline) {
      const step = 5 * 2 ** spec.level;
      for (
        let y = Math.floor(point[1] / step) - 1;
        y <= Math.floor(point[1] / step) + 2;
        y++
      )
        for (
          let x = Math.floor(point[0] / step) - 1;
          x <= Math.floor(point[0] / step) + 2;
          x++
        )
          expect(manifest.probes).toContainEqual([x * step, y * step]);
    }
  });

  it("uses actual materialized and undo values without substituting account or reference values", () => {
    const own = { sessionId: "session", gestureId: 3 };
    const input = {
      brush: { level: 0, radius: 20, amount: 1 },
      start: { point: [0, 0], at: 0, input: 3 },
      windows: [],
    };
    const edit = {
      after: {
        sessionId: "session",
        events: [
          { kind: "brush-accepted", ...own, admissionId: 1 },
          {
            kind: "brush-content",
            ...own,
            phase: "admission",
            before: [null, 4],
            authors: [null, 4],
            minimum: [10, 10],
            timeAccount: [8, 8],
          },
          {
            kind: "brush-content",
            ...own,
            phase: "admission",
            before: [2, 4],
            authors: [3, 5],
            minimum: [10, 10],
            timeAccount: [8, 8],
          },
          { kind: "brush-content", ...own, phase: "complete", authors: [3, 5] },
          {
            kind: "brush-content",
            ...own,
            gestureId: 999,
            phase: "complete",
            authors: [99, 99],
          },
        ],
      },
      time: { gestureId: 3, inputManifest: input },
    };
    const manifest = {
      probes: [
        [0, 0],
        [5, 0],
      ],
      centerline: [[0, 0]],
      regions: [{ id: "path", indices: [0, 1] }],
    };
    const { content, admissions } = directionContent(
      edit,
      manifest,
      { authors: [null, null] },
      { authors: [99, 99] },
      { authors: [2, 4] },
    );
    expect(content.before).toEqual([2, 4]);
    expect(content.after).toEqual([3, 5]);
    expect(content.undone).toEqual([2, 4]);
    expect(content.checkpoints).toHaveLength(2);
    expect(admissions).toHaveLength(1);
    expect(content.input).toBe(input);
  });
});
