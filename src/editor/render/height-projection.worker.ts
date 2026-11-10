import {
  projectHeightPixels,
  type HeightProjectionInput,
  type HeightProjectionRequest,
  type HeightProjectionResponse,
} from "./height-projection";
import type { HeightTile } from "../model/types";

interface Run {
  id: number;
  sessionId: string;
  cancelled: boolean;
  computing: boolean;
  expectedSources: number;
  overviewOffset: number;
  input: HeightProjectionInput & { sources: HeightTile[] };
}
let current: Run | null = null;

function respond(
  run: Pick<Run, "id" | "sessionId">,
  kind: "ready" | "cancelled",
) {
  self.postMessage({
    kind,
    id: run.id,
    sessionId: run.sessionId,
  } satisfies HeightProjectionResponse);
}

self.onmessage = async (event: MessageEvent<HeightProjectionRequest>) => {
  const request = event.data;
  if (request.kind === "begin") {
    if (current) {
      self.postMessage({
        kind: "failed",
        id: request.id,
        sessionId: request.sessionId,
        error: "Höhenprojektion hat bereits einen aktiven Auftrag.",
      } satisfies HeightProjectionResponse);
      return;
    }
    if (
      !Number.isInteger(request.size) ||
      request.size < 1 ||
      request.size > 128 ||
      !Number.isInteger(request.sourceCount) ||
      request.sourceCount < 0 ||
      request.sourceCount > 4096
    ) {
      self.postMessage({
        kind: "failed",
        id: request.id,
        sessionId: request.sessionId,
        error: "Ungültiger lokaler Höhenprojektionsauftrag.",
      } satisfies HeightProjectionResponse);
      return;
    }
    current = {
      id: request.id,
      sessionId: request.sessionId,
      cancelled: false,
      computing: false,
      expectedSources: request.sourceCount,
      overviewOffset: 0,
      input: {
        sources: [],
        bounds: request.bounds,
        size: request.size,
        overview: request.hasOverview
          ? new Float64Array(request.size * request.size)
          : undefined,
      },
    };
    respond(current, "ready");
    return;
  }
  const run = current;
  if (!run || request.id !== run.id || request.sessionId !== run.sessionId)
    return;
  if (request.kind === "cancel") {
    run.cancelled = true;
    if (!run.computing) {
      // All buffered input is released before acknowledging cancellation.
      current = null;
      respond(run, "cancelled");
    }
    return;
  }
  try {
    if (run.computing)
      throw new Error("Höhenprojektion nimmt keine weiteren Eingaben an.");
    if (request.kind === "source") {
      if (
        run.input.sources.length >= run.expectedSources ||
        request.source.values.length !== 4096
      )
        throw new Error("Ungültige Höhenquelle im Projektionsauftrag.");
      run.input.sources.push(request.source);
      respond(run, "ready");
      return;
    }
    if (request.kind === "overview") {
      if (
        !run.input.overview ||
        request.offset !== run.overviewOffset ||
        request.values.length < 1 ||
        request.values.length > 4096 ||
        request.offset + request.values.length > run.input.overview.length
      )
        throw new Error("Unvollständige Höhenübersicht im Projektionsauftrag.");
      run.input.overview.set(request.values, request.offset);
      run.overviewOffset += request.values.length;
      respond(run, "ready");
      return;
    }
    if (
      run.input.sources.length !== run.expectedSources ||
      (run.input.overview && run.overviewOffset !== run.input.overview.length)
    )
      throw new Error(
        "Höhenprojektion hat ihre Quellen noch nicht vollständig erhalten.",
      );
    run.computing = true;
    const result = await projectHeightPixels(run.input, {
      cancelled: () => run.cancelled,
      now: () => performance.now(),
      yield: () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
    });
    // No new job can enter before this actual completion acknowledgement.
    current = null;
    if (result && !run.cancelled)
      self.postMessage(
        {
          kind: "finished",
          id: run.id,
          sessionId: run.sessionId,
          ...result,
        } satisfies HeightProjectionResponse,
        { transfer: [result.pixels.buffer, result.land.buffer] },
      );
    else respond(run, "cancelled");
  } catch (error) {
    current = null;
    self.postMessage({
      kind: "failed",
      id: run.id,
      sessionId: run.sessionId,
      error: error instanceof Error ? error.message : String(error),
    } satisfies HeightProjectionResponse);
  }
};
