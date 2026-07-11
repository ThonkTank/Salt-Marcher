package src.view.slotcontent.main.dungeonmap;

import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;

final class DungeonMapRenderMarkerHandles {
    private static final String STAIR_KIND = "STAIR";

    private DungeonMapRenderMarkerHandles() {
    }

    static DungeonMapRenderState.MarkerHandle markerHandle(
            int q,
            int r,
            int level
    ) {
        return new DungeonMapRenderState.MarkerHandle(null, q, r, level, null);
    }

    static DungeonMapRenderState.MarkerHandle markerHandle(
            DungeonMapRenderState.TopologyRef topologyRef,
            int q,
            int r,
            int level
    ) {
        return new DungeonMapRenderState.MarkerHandle(null, q, r, level, topologyRef);
    }

    static DungeonMapRenderState.MarkerHandle markerHandle(
            DungeonEditorHandleRef handle,
            int q,
            int r,
            int level
    ) {
        return new DungeonMapRenderState.MarkerHandle(handle, q, r, level, null);
    }

    static DungeonMapRenderState.MarkerHandle featureMarkerHandle(
            DungeonEditorMapSnapshot.Feature feature,
            int q,
            int r,
            int level
    ) {
        if (STAIR_KIND.equalsIgnoreCase(feature.kind())) {
            return markerHandle(q, r, level);
        }
        DungeonMapRenderState.TopologyRef topologyRef = DungeonMapRenderCells.featureTopologyRef(feature);
        if (topologyRef.equals(DungeonMapRenderState.TopologyRef.empty())) {
            return markerHandle(q, r, level);
        }
        return markerHandle(topologyRef, q, r, level);
    }
}
