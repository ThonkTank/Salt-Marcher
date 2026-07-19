package features.dungeon.domain.core.structure.room;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import features.dungeon.domain.core.structure.room.RoomTopologyRebuilder.RebuildResult;
import features.dungeon.domain.core.structure.topology.SpatialTopology;

/**
 * Owns aggregate-level room topology authoring inside the core room structure.
 */
public final class RoomTopologyAuthoring {

    private static final RoomTopologyWorkCatalog WORK_CATALOG = new RoomTopologyWorkCatalog();
    private static final RoomPartitionPreservingMutation ROOM_MUTATION = new RoomPartitionPreservingMutation();
    private static final RoomClusterBoundaryMutation BOUNDARY_MUTATION =
            new RoomClusterBoundaryMutation();
    private static final RoomClusterBoundaryStretchMutation STRETCH_MUTATION =
            new RoomClusterBoundaryStretchMutation();
    private static final RoomClusterCornerMovement CLUSTER_CORNER_MOVEMENT =
            new RoomClusterCornerMovement();

    public DungeonMap paintRectangle(
            DungeonMap dungeonMap,
            Cell start,
            Cell end,
            RoomTopologyWorkCatalog.ReservedIdentities ids
    ) {
        DungeonMap target = requireDungeonMap(dungeonMap);
        if (start == null || end == null) {
            return target;
        }
        Optional<RebuildResult> rebuild = ROOM_MUTATION.paintRectangle(
                target.topology(),
                WORK_CATALOG.workClusters(target.topology(), target.rooms()),
                start,
                end,
                target.metadata().mapId().value(),
                ids);
        return rebuild.map(result -> withRoomTopology(target, result)).orElse(target);
    }

    public DungeonMap deleteRectangle(
            DungeonMap dungeonMap,
            Cell start,
            Cell end,
            RoomTopologyWorkCatalog.ReservedIdentities ids
    ) {
        DungeonMap target = requireDungeonMap(dungeonMap);
        if (start == null || end == null) {
            return target;
        }
        Optional<RebuildResult> rebuild = ROOM_MUTATION.deleteRectangle(
                target.topology(),
                WORK_CATALOG.workClusters(target.topology(), target.rooms()),
                start,
                end,
                ids);
        return rebuild.map(result -> withRoomTopology(target, result)).orElse(target);
    }

    public DungeonMap editBoundaries(
            DungeonMap dungeonMap,
            long clusterId,
            List<Edge> edges,
            BoundaryKind kind,
            boolean deleteBoundary,
            RoomTopologyWorkCatalog.ReservedIdentities ids
    ) {
        DungeonMap target = requireDungeonMap(dungeonMap);
        Optional<RebuildResult> rebuild = BOUNDARY_MUTATION.editBoundaries(
                target.topology(),
                target.rooms(),
                target.corridors(),
                clusterId,
                edges,
                kind,
                deleteBoundary,
                ids);
        return rebuild.map(result -> withRoomTopology(target, result)).orElse(target);
    }

    public DungeonMap moveBoundaryStretch(
            DungeonMap dungeonMap,
            long clusterId,
            List<Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel,
            RoomTopologyWorkCatalog.ReservedIdentities ids
    ) {
        DungeonMap target = requireDungeonMap(dungeonMap);
        Optional<RebuildResult> rebuild = STRETCH_MUTATION.moveBoundaryStretch(
                target.topology(),
                target.rooms(),
                target.corridors(),
                clusterId,
                sourceEdges,
                deltaQ,
                deltaR,
                deltaLevel,
                ids);
        return rebuild.map(result -> withRoomTopology(target, result)).orElse(target);
    }

    public DungeonMap moveClusterCorner(
            DungeonMap dungeonMap,
            long clusterId,
            Cell corner,
            int deltaQ,
            int deltaR,
            int deltaLevel,
            RoomTopologyWorkCatalog.ReservedIdentities ids
    ) {
        DungeonMap target = requireDungeonMap(dungeonMap);
        Optional<RebuildResult> rebuild = CLUSTER_CORNER_MOVEMENT.moveCorner(
                target.topology(),
                target.rooms(),
                target.corridors(),
                clusterId,
                corner,
                deltaQ,
                deltaR,
                deltaLevel,
                ids);
        return rebuild.map(result -> withRoomTopology(target, result)).orElse(target);
    }

    private static DungeonMap requireDungeonMap(DungeonMap dungeonMap) {
        return Objects.requireNonNull(dungeonMap, "dungeonMap");
    }

    private static DungeonMap withRoomTopology(DungeonMap dungeonMap, RebuildResult rebuild) {
        SpatialTopology resolvedTopology = rebuild.topology().withRoomClusters(
                rebuild.topology().roomClusters().stream()
                        .map(RoomCluster::withResolvedBoundaryTopologyRefs)
                        .toList());
        return new DungeonMap(
                dungeonMap.metadata(),
                resolvedTopology,
                dungeonMap.topologyIndex(),
                rebuild.rooms(),
                dungeonMap.corridors(),
                dungeonMap.stairs(),
                dungeonMap.transitionCatalog(),
                dungeonMap.featureMarkers(),
                dungeonMap.revision() + 1L);
    }
}
