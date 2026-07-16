package features.dungeon.application.editor;

import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.api.DungeonEditorMapHitRef;
import features.dungeon.api.DungeonEditorTopologyElementRef;

public final class DungeonEditorEdgeHitRefs {
    private DungeonEditorEdgeHitRefs() {
    }

    public static DungeonEditorMapHitRef edge(
            String kind,
            long ownerId,
            DungeonEditorTopologyElementRef topologyRef,
            DungeonEdgeRef edge
    ) {
        return edge(
                kind,
                ownerId,
                DungeonEditorTopologyHitRefs.topologyKind(topologyRef),
                DungeonEditorTopologyHitRefs.topologyId(topologyRef),
                edge);
    }

    public static DungeonEditorMapHitRef edge(
            String kind,
            long ownerId,
            String topologyKind,
            long topologyId,
            DungeonEdgeRef edge
    ) {
        if (edge == null || edge.from() == null || edge.to() == null) {
            return DungeonEditorMapHitRefs.empty();
        }
        return edge(
                kind,
                ownerId,
                topologyKind,
                topologyId,
                edge.from().level(),
                edge.from().q(),
                edge.from().r(),
                edge.to().q(),
                edge.to().r());
    }

    public static DungeonEditorMapHitRef edge(
            String kind,
            long ownerId,
            String topologyKind,
            long topologyId,
            int level,
            double startQ,
            double startR,
            double endQ,
            double endR
    ) {
        return new DungeonEditorMapHitRef("edge:"
                + DungeonEditorMapHitRefs.normalizeKind(kind)
                + ":" + Math.max(0L, ownerId)
                + ":" + DungeonEditorMapHitRefs.normalizeKind(topologyKind)
                + ":" + Math.max(0L, topologyId)
                + ":" + level
                + ":" + DungeonEditorMapHitRefs.sceneCoordinate(startQ)
                + ":" + DungeonEditorMapHitRefs.sceneCoordinate(startR)
                + ":" + DungeonEditorMapHitRefs.sceneCoordinate(endQ)
                + ":" + DungeonEditorMapHitRefs.sceneCoordinate(endR));
    }
}
