package src.features.dungeon.runtime;

import java.util.Map;
import src.domain.dungeon.published.DungeonEditorMapHitRef;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;

final class DungeonEditorGraphPointerTargets {
    private DungeonEditorGraphPointerTargets() {
    }

    static void addTargets(
            Map<String, DungeonEditorRuntimePointerTarget> targets,
            DungeonEditorMapSnapshot map
    ) {
        for (DungeonEditorMapSnapshot.Area area : map.areas()) {
            if (!area.cells().isEmpty()) {
                targets.put(DungeonEditorMapHitRef.graphNode(area.id(), area.clusterId()).value(),
                        DungeonEditorRuntimePointerTargetFactory.graphNode(area.id(), area.clusterId(), "ROOM",
                                area.id()));
            }
        }
    }
}
