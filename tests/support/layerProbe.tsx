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
  }: {
    visible: boolean;
    active: boolean;
    version: Status;
  }) {
    regions = useRegions(
      loader,
      client,
      version,
      [-200, -200, 300, 300],
      { x: 0, y: 0, scale: 6.4 },
      { visible, active },
      () => {},
      () => {},
    );
    rivers = useRivers(
      loader,
      client,
      version,
      [-200, -200, 300, 300],
      { x: 0, y: 0, scale: 6.4 },
      decideLod(6.4),
      { visible, active: false },
      true,
      controller,
    );
    return null;
  }
  return {
    requests,
    render: (visible: boolean, active = false, version = status) =>
      root.render(
        <Probe visible={visible} active={active} version={version} />,
      ),
    snapshot: () => ({ regions, rivers }),
    close: () => {
      root.unmount();
      loader.dispose();
      element.remove();
    },
  };
}
