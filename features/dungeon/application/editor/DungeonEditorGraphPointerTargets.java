package features.dungeon.application.editor;

import java.util.Map;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.DungeonTopologyElementRef;

final class DungeonEditorGraphPointerTargets {
    private DungeonEditorGraphPointerTargets() {
    }

    static void addTargets(
            Map<String, DungeonEditorRuntimePointerTarget> targets,
            DungeonEditorMapSnapshot map
    ) {
        for (DungeonEditorMapSnapshot.Area area : map.areas()) {
            if (!area.cells().isEmpty()) {
                targets.put(DungeonEditorGraphHitRefs.graphNode(area.id(), area.clusterId()).value(),
                        DungeonEditorRuntimePointerTarget.graphNode(
                                area.id(),
                                area.clusterId(),
                                topologyKind(area.topologyRef()),
                                DungeonEditorTopologyHitRefs.topologyId(area.topologyRef())));
            }
        }
    }

    private static DungeonEditorRuntimePointerTarget.TopologyKind topologyKind(
            DungeonTopologyElementRef topologyRef
    ) {
        return DungeonEditorRuntimePointerTarget.TopologyKind.fromPublished(
                topologyRef == null ? null : topologyRef.kind());
    }
}
