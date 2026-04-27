package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public record LoadDungeonSurfaceQuery(
        @Nullable DungeonMapId mapId,
        DungeonSurfaceKind surfaceKind,
        DungeonTopologyElementRef topologyRef,
        long clusterId,
        boolean clusterSelection,
        @Nullable DungeonTravelPosition travelPosition
) {

    public LoadDungeonSurfaceQuery {
        surfaceKind = surfaceKind == null ? DungeonSurfaceKind.defaultKind() : surfaceKind;
        topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
        clusterId = Math.max(0L, clusterId);
    }

    public LoadDungeonSurfaceQuery(@Nullable DungeonMapId mapId, DungeonSurfaceKind surfaceKind) {
        this(mapId, surfaceKind, DungeonTopologyElementRef.empty(), 0L, false, null);
    }
}
