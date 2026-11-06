import { describe, expect, it } from "vitest";
import { isDomainIssue, normalizeWireError, WireError } from "./wireError";

const issue = {
  code: "collision" as const,
  objectIds: ["house-1", "parcel-2"],
  message: "Neuer sichtbarer Text",
  geometry: {
    kind: "bounds" as const,
    bounds: [0, 0, 20, 20] as [number, number, number, number],
  },
};
describe("shared Atlas wire errors", () => {
  it("preserves the same issue across raw, string and Error transports", () => {
    const payload = { category: "invalidInput", message: issue.message, issue };
    for (const value of [
      payload,
      JSON.stringify(payload),
      new Error(JSON.stringify(payload)),
    ]) {
      const error = normalizeWireError(value) as WireError;
      expect(error).toBeInstanceOf(WireError);
      expect(error.name).toBe("WireError");
      expect(error.issue).toEqual(issue);
      expect(error.category).toBe("invalidInput");
      expect(normalizeWireError(error)).toBe(error);
    }
  });
  it("keeps legacy categories without issues and ordinary errors", () => {
    for (const category of ["invalidInput", "storage", "staleVersion"]) {
      const error = normalizeWireError({
        category,
        message: "legacy",
      }) as WireError;
      expect(error.category).toBe(category);
      expect(error.issue).toBeUndefined();
    }
    const error = new Error("transport failed");
    expect(normalizeWireError(error)).toBe(error);
    for (const category of ["storage", "staleVersion"]) {
      expect(
        (
          normalizeWireError({
            category,
            message: "failure",
            issue,
          }) as WireError
        ).issue,
      ).toBeUndefined();
    }
  });
  it("validates all four geometry variants", () => {
    for (const geometry of [
      issue.geometry,
      { kind: "point", point: [5_000_000, -5_000_000] },
      {
        kind: "path",
        points: [
          [0, 0],
          [20, 20],
        ],
      },
      {
        kind: "polygon",
        points: [
          [0, 0],
          [20, 0],
          [20, 20],
          [0, 20],
        ],
      },
    ])
      expect(isDomainIssue({ ...issue, geometry })).toBe(true);
    expect(
      isDomainIssue({
        code: "invalidInput",
        objectIds: [],
        message: "no identity known",
      }),
    ).toBe(true);
  });
  it("rejects unbounded, malformed and non-drawable diagnostics", () => {
    for (const geometry of [
      { kind: "point", point: [NaN, 0] },
      { kind: "point", point: [Infinity, 0] },
      { kind: "point", point: [100_000_001, 0] },
      { kind: "bounds", bounds: [10, 0, 0, 10] },
      { kind: "path", points: [[0, 0]] },
      { kind: "path", points: Array.from({ length: 32_769 }, () => [0, 0]) },
      {
        kind: "polygon",
        points: [
          [0, 0],
          [20, 20],
          [0, 20],
          [20, 0],
        ],
      },
      {
        kind: "polygon",
        points: [
          [0, 0],
          [1, 1],
          [2, 2],
        ],
      },
      { kind: "polygon", points: Array.from({ length: 2049 }, () => [0, 0]) },
      { kind: "unknown", point: [0, 0] },
    ]) {
      const invalid = { ...issue, geometry };
      expect(isDomainIssue(invalid)).toBe(false);
      const error = normalizeWireError({
        category: "invalidInput",
        message: "kept",
        issue: invalid,
      }) as WireError;
      expect(error.message).toBe("kept");
      expect(error.issue).toBeUndefined();
    }
    for (const invalid of [
      { ...issue, code: "translated text" },
      { ...issue, objectIds: [""] },
      { ...issue, objectIds: [1] },
      { ...issue, message: 4 },
    ])
      expect(isDomainIssue(invalid)).toBe(false);
  });
});
