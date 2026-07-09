package src.features.dungeon.runtime;

import src.domain.dungeon.published.DungeonEditorMapHitRef;
import src.domain.dungeon.published.DungeonTopologyElementRef;

public final class DungeonEditorLabelHitRefs {
    private DungeonEditorLabelHitRefs() {
    }

    public static DungeonEditorMapHitRef label(
            long ownerId,
            long clusterId,
            DungeonTopologyElementRef topologyRef,
            String labelKind
    ) {
        return label(
                ownerId,
                clusterId,
                DungeonEditorTopologyHitRefs.topologyKind(topologyRef),
                DungeonEditorTopologyHitRefs.topologyId(topologyRef),
                labelKind);
    }

    public static DungeonEditorMapHitRef label(
            long ownerId,
            long clusterId,
            String topologyKind,
            long topologyId,
            String labelKind
    ) {
        return new DungeonEditorMapHitRef("label:"
                + Math.max(0L, ownerId)
                + ":" + Math.max(0L, clusterId)
                + ":" + DungeonEditorMapHitRefs.normalizeKind(topologyKind)
                + ":" + Math.max(0L, topologyId)
                + ":" + DungeonEditorMapHitRefs.normalizeKind(labelKind));
    }
}
