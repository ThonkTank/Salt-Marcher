package src.features.dungeon.runtime;

import java.util.Map;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;

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
            DungeonEditorTopologyElementRef topologyRef
    ) {
        return DungeonEditorRuntimePointerTargetCompatibility.legacyTopologyKind(
                DungeonEditorTopologyHitRefs.topologyKind(topologyRef));
    }
}
