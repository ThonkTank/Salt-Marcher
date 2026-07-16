package features.dungeon.application.editor;

import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonEditorHandleRef;
import features.dungeon.api.DungeonEditorMapHitRef;
import features.dungeon.api.DungeonEditorTopologyElementRef;

public final class DungeonEditorMarkerHitRefs {
    private DungeonEditorMarkerHitRefs() {
    }

    public static DungeonEditorMapHitRef marker(DungeonEditorHandleRef ref, DungeonCellRef cell) {
        if (ref == null || ref.kind() == null || cell == null) {
            return DungeonEditorMapHitRefs.empty();
        }
        return marker(ref, cell.q(), cell.r(), cell.level());
    }

    public static DungeonEditorMapHitRef marker(DungeonEditorHandleRef ref, int q, int r, int level) {
        if (ref == null || ref.kind() == null) {
            return DungeonEditorMapHitRefs.empty();
        }
        return new DungeonEditorMapHitRef("marker:"
                + ref.kind().name()
                + ":" + DungeonEditorTopologyHitRefs.topologyKind(ref.topologyRef())
                + ":" + DungeonEditorTopologyHitRefs.topologyId(ref.topologyRef())
                + ":" + ref.ownerId()
                + ":" + ref.clusterId()
                + ":" + ref.corridorId()
                + ":" + ref.roomId()
                + ":" + ref.index()
                + ":" + q
                + ":" + r
                + ":" + level
                + ":" + ref.direction());
    }

    public static DungeonEditorMapHitRef featureMarker(
            DungeonEditorTopologyElementRef topologyRef,
            long ownerId,
            int q,
            int r,
            int level
    ) {
        return featureMarker(
                DungeonEditorTopologyHitRefs.topologyKind(topologyRef),
                DungeonEditorTopologyHitRefs.topologyId(topologyRef),
                ownerId,
                q,
                r,
                level);
    }

    public static DungeonEditorMapHitRef featureMarker(
            String topologyKind,
            long topologyId,
            long ownerId,
            int q,
            int r,
            int level
    ) {
        return new DungeonEditorMapHitRef("marker:FEATURE:"
                + DungeonEditorMapHitRefs.normalizeKind(topologyKind)
                + ":" + Math.max(0L, topologyId)
                + ":" + Math.max(0L, ownerId)
                + ":" + q
                + ":" + r
                + ":" + level);
    }
}
