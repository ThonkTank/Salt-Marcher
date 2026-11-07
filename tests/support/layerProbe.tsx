import { createRoot } from "react-dom/client";
import { AtlasClient } from "../../src/atlas/client";
import { PresentationLoader } from "../../src/atlas/presentationLoader";
import { useRegions } from "../../src/atlas/useRegions";
import { useRivers } from "../../src/atlas/useRivers";
import {
  EditorWorkflowController,
  type WorkflowPorts,
} from "../../src/atlas/editorWorkflowController";
import { decideLod } from "../../src/atlas/lod";
import type { Status } from "../../src/atlas/model";

export function layerProbe(status: Status) {
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element),
    loader = new PresentationLoader();
  const requests: Array<{ cmd: string; args: Record<string, unknown> }> = [];
  const client = new AtlasClient((cmd, args) => {
    requests.push({ cmd, args });
    return window.atlasCore(cmd as never, args as never);
  });
  const controller = new EditorWorkflowController({} as WorkflowPorts);
  let regions: ReturnType<typeof useRegions>,
    rivers: ReturnType<typeof useRivers>;
  function Probe({
    visible,
    active,
    version,
    scale,
  }: {
    visible: boolean;
    active: boolean;
    version: Status;
    scale: number;
  }) {
    regions = useRegions(
      loader,
      client,
      version,
      [-200, -200, 300, 300],
      { x: 0, y: 0, scale },
      { visible, active },
      () => {},
      () => {},
    );
    rivers = useRivers(
      loader,
      client,
      version,
      [-200, -200, 300, 300],
      { x: 0, y: 0, scale },
      decideLod(scale),
      { visible, active: false },
      true,
      controller,
    );
    return null;
  }
  let marked: {
    regions: ReturnType<typeof useRegions>;
    rivers: ReturnType<typeof useRivers>;
  };
  return {
    mark: () => {
      marked = { regions, rivers };
    },
    references: () => ({
      ranks: marked.regions.ranks === regions.ranks,
      summaries: marked.regions.summaries === regions.summaries,
      displayed: marked.regions.regions === regions.regions,
      markers: marked.regions.markerRanks === regions.markerRanks,
      relations: marked.regions.relations === regions.relations,
      views: marked.rivers.views === rivers.views,
      handles: marked.rivers.handles === rivers.handles,
      innerViews: rivers.input.views === rivers.views,
    }),
    requests,
    render: (visible: boolean, active = false, version = status, scale = 6.4) =>
      root.render(
        <Probe
          visible={visible}
          active={active}
          version={version}
          scale={scale}
        />,
      ),
    snapshot: () => ({ regions, rivers }),
    close: () => {
      root.unmount();
      loader.dispose();
      element.remove();
    },
  };
}
