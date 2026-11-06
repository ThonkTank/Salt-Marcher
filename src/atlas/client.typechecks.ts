import type { AtlasClient } from "./client";
import type {
  Area,
  Connection,
  Intent,
  MapObject,
  Road,
  Status,
} from "./model";
import type { Intent as WireIntent } from "./generated/Intent";
import type { SceneObject as WireSceneObject } from "./generated/SceneObject";
// Compile-only negative checks: these calls are never executed.
export function commandTypeChecks(client: AtlasClient) {
  // @ts-expect-error unknown command
  void client.request("bogus", {});
  // @ts-expect-error missing required bounds
  void client.request("scene", { context: { kind: "exterior" } });
  void client.request("history", {
    version: { sessionId: "x", revision: 0 },
    // @ts-expect-error wrong history argument
    redo: "yes",
  });
  // @ts-expect-error scene is not a status
  const status: Promise<Status> = client.request("scene", {
    context: { kind: "exterior" },
    bounds: [0, 0, 1, 1],
  });
  void status;
}

// Keep every generated intent variant while enforcing authoring constraints.
type SameVariants<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;
const allIntentVariants: SameVariants<Intent["type"], WireIntent["type"]> =
  true;
void allIntentVariants;
const allObjectVariants: SameVariants<
  MapObject["kind"],
  WireSceneObject["kind"]
> = true;
void allObjectVariants;
export function inputBoundaryChecks(
  client: AtlasClient,
  road: Road,
  area: Area,
) {
  const version = { sessionId: "x", revision: 0 };
  void client.request("commit", {
    version,
    // @ts-expect-error persisted road identity/topology must not enter create inputs
    intent: { type: "createRoad", road, population: null },
  });
  void client.request("preview", {
    version,
    // @ts-expect-error persisted area identity/order must not enter author inputs
    intent: { type: "createArea", area },
  });
  // @ts-expect-error empty commands do not accept arbitrary fields
  void client.request("status", { extra: true });
  // @ts-expect-error native file picking is not the adapter's path-based open
  void client.request("open", { path: "test.saltatlas" });
  // @ts-expect-error full detail is a test adapter command, not a product read
  void client.read("detail", {
    buildingId: "h",
    floor: 0,
    bounds: [0, 0, 1, 1],
  });
  const nullableRawStairEndpoint: Extract<
    Connection,
    { type: "stairs" }
  >["toRoom"] = null;
  return nullableRawStairEndpoint;
}
