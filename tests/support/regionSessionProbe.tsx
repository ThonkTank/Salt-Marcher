import { createRoot } from "react-dom/client";
import { AtlasClient } from "../../src/atlas/client";
import { PresentationLoader } from "../../src/atlas/presentationLoader";
import { useRegions } from "../../src/atlas/useRegions";
import type { Status } from "../../src/atlas/model";

/** Controlled catalog sizes exercise the real hook's session-scoped hysteresis. */
export function regionSessionProbe() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host),
    loader = new PresentationLoader();
  const catalog = {
    categories: [
      { id: "p", name: "P", visible: true, fixedRank: null, markers: false },
    ],
    ranks: [
      { id: "small", name: "Small", categoryId: "p" },
      { id: "large", name: "Large", categoryId: "p" },
    ],
  };
  const summaries = [
    { id: "a", rankId: "small", name: "A", area: 100, anchor: [0, 0] },
    { id: "b", rankId: "large", name: "B", area: 10000, anchor: [0, 0] },
  ];
  let rankIds: string[] = [];
  const client = new AtlasClient(async (_cmd, args) => {
    const request = args as {
      version: Status;
      bounds: unknown;
      rankIds: string[];
    };
    if (request.bounds !== null) rankIds = request.rankIds;
    return {
      status: request.version,
      catalog,
      summaries,
      regions: [],
      relations: [],
    };
  });
  let regions: ReturnType<typeof useRegions>;
  function Probe({ version, scale }: { version: Status; scale: number }) {
    regions = useRegions(
      loader,
      client,
      version,
      [-20, -20, 20, 20],
      { x: 0, y: 0, scale },
      { visible: true, active: false },
      () => {},
      () => {},
    );
    return null;
  }
  return {
    render: (sessionId: string, scale: number) =>
      root.render(
        <Probe
          version={{
            sessionId,
            revision: 1,
            path: null,
            dirty: false,
            canUndo: false,
            canRedo: false,
            changes: null,
          }}
          scale={scale}
        />,
      ),
    snapshot: () => ({ fresh: regions.fresh, rankIds }),
    close: () => {
      root.unmount();
      loader.dispose();
      host.remove();
    },
  };
}
