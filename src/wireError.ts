import type { ErrorCategory } from "./atlas/generated/ErrorCategory";
export type { ErrorCategory } from "./atlas/generated/ErrorCategory";
import type { IssueCode } from "./atlas/generated/IssueCode";
export type { IssueCode } from "./atlas/generated/IssueCode";
import type { IssueGeometry } from "./atlas/generated/IssueGeometry";
export type { IssueGeometry } from "./atlas/generated/IssueGeometry";
import type { DomainIssue } from "./atlas/generated/DomainIssue";
export type { DomainIssue } from "./atlas/generated/DomainIssue";
const codes = {
  parcelGeometry: true,
  parcelContainment: true,
  collision: true,
  gridAlignment: true,
  occupiedParcel: true,
  boundSection: true,
  limit: true,
  invalidInput: true,
} satisfies Record<IssueCode, true>;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const point = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every(
    (n: unknown) =>
      typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 5_000_000,
  );
function polygon(points: [number, number][]): boolean {
  // Match the exterior polygon limit; crossing/degenerate rings are never overlays.
  if (points.length < 3 || points.length > 2048) return false;
  const cross = (a: number[], b: number[], c: number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const on = (a: number[], b: number[], p: number[]) =>
    Math.abs(cross(a, b, p)) < 1e-7 &&
    p[0] >= Math.min(a[0], b[0]) - 1e-7 &&
    p[0] <= Math.max(a[0], b[0]) + 1e-7 &&
    p[1] >= Math.min(a[1], b[1]) - 1e-7 &&
    p[1] <= Math.max(a[1], b[1]) + 1e-7;
  let area = 0;
  const origin = points[0];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-7) return false;
    area +=
      (a[0] - origin[0]) * (b[1] - origin[1]) -
      (a[1] - origin[1]) * (b[0] - origin[0]);
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue;
      const c = points[j],
        d = points[(j + 1) % points.length];
      if (
        (cross(a, b, c) * cross(a, b, d) < 0 &&
          cross(c, d, a) * cross(c, d, b) < 0) ||
        on(a, b, c) ||
        on(a, b, d) ||
        on(c, d, a) ||
        on(c, d, b)
      )
        return false;
    }
  }
  return Math.abs(area) > 1e-7;
}
function validGeometry(value: unknown): value is IssueGeometry {
  if (!record(value)) return false;
  if (value.kind === "bounds") {
    const b = value.bounds;
    return (
      Array.isArray(b) &&
      b.length === 4 &&
      point(b.slice(0, 2)) &&
      point(b.slice(2)) &&
      b[0] <= b[2] &&
      b[1] <= b[3]
    );
  }
  if (value.kind === "point") return point(value.point);
  if (value.kind !== "path" && value.kind !== "polygon") return false;
  const points = value.points;
  return (
    Array.isArray(points) &&
    points.length >= 2 &&
    points.length <= 32_768 &&
    points.every(point) &&
    (value.kind === "path" || polygon(points))
  );
}
export function isDomainIssue(value: unknown): value is DomainIssue {
  return (
    record(value) &&
    typeof value.code === "string" &&
    Object.hasOwn(codes, value.code) &&
    typeof value.message === "string" &&
    Array.isArray(value.objectIds) &&
    value.objectIds.every(
      (id: unknown) =>
        typeof id === "string" && id.length > 0 && id.length <= 120,
    ) &&
    (value.geometry === undefined || validGeometry(value.geometry))
  );
}
export class WireError extends Error {
  constructor(
    public readonly category: ErrorCategory,
    message: string,
    public readonly issue?: DomainIssue,
  ) {
    super(message);
    this.name = "WireError";
  }
}
export function normalizeWireError(error: unknown): Error {
  if (error instanceof WireError) return error;
  let value = error;
  if (error instanceof Error || typeof error === "string") {
    try {
      value = JSON.parse(error instanceof Error ? error.message : error);
    } catch {
      return error instanceof Error ? error : new Error(error);
    }
  }
  if (
    record(value) &&
    (value.category === "invalidInput" ||
      value.category === "staleVersion" ||
      value.category === "storage") &&
    typeof value.message === "string"
  )
    return new WireError(
      value.category,
      value.message,
      value.category === "invalidInput" && isDomainIssue(value.issue)
        ? value.issue
        : undefined,
    );
  return new Error(String(error));
}
