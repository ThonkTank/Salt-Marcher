import type { AtlasClient } from "./client";
import type { Version, WorldPoint } from "./model";
import { sameVersion } from "./documentVersion";
import { scheduledRead } from "./readScheduler";

/** One in-flight read, one latest point. Pointer events never build a read queue. */
export class SurfacePointReader {
  private wanted: { version: Version; point: WorldPoint; key: string } | null =
    null;
  private active = false;
  private value: { key: string; height: number } | null = null;
  private listeners = new Set<() => void>();
  constructor(private client: AtlasClient) {}
  subscribe = (f: () => void) => {
    this.listeners.add(f);
    return () => {
      this.listeners.delete(f);
    };
  };
  getSnapshot = () => this.value;
  update(
    version: Version | null | undefined,
    point: WorldPoint | null | undefined,
  ) {
    const key =
      version && point
        ? JSON.stringify([version.sessionId, version.revision, point])
        : "";
    if (key === (this.wanted?.key ?? "")) return;
    this.wanted = version && point ? { version, point, key } : null;
    this.value = null;
    this.listeners.forEach((f) => f());
    void this.read();
  }
  private async read() {
    if (this.active || !this.wanted) return;
    const request = this.wanted;
    this.active = true;
    try {
      const result = await scheduledRead(
        this.client,
        "surfacePoints",
        { version: request.version, points: [request.point] },
        () => this.wanted === request,
      );
      if (
        this.wanted === request &&
        result &&
        sameVersion(result.status, request.version)
      ) {
        this.value = { key: request.key, height: result.heights[0] };
        this.listeners.forEach((f) => f());
      }
    } catch {
      /* A concurrent write makes the version obsolete; the next update retries. */
    } finally {
      this.active = false;
      if (this.wanted && this.wanted !== request) void this.read();
    }
  }
}
