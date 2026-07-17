package features.dungeon.domain.core.structure.door;

import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.corridor.CorridorDoorBindingGeometry;
import features.dungeon.domain.core.structure.corridor.CorridorDoorBindingState;
import features.dungeon.domain.core.structure.room.DungeonClusterBoundary;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;

record DoorBindingMoveContext(
        RoomCluster targetCluster,
        DungeonClusterBoundary oldDoorBoundary,
        DungeonTopologyRef expectedTopologyRef,
        Edge nextDoorEdge,
        @Nullable DungeonClusterBoundary nextBoundary,
        CorridorDoorBindingState newBinding
) {
    static @Nullable DoorBindingMoveContext from(
            DungeonMap sourceMap,
            @Nullable CorridorDoorBindingState oldBinding,
            @Nullable CorridorDoorBindingState newBinding
    ) {
        if (!sameRoomClusterMove(oldBinding, newBinding)) {
            return null;
        }
        RoomCluster targetCluster = targetCluster(sourceMap, oldBinding);
        if (targetCluster == null) {
            return null;
        }
        Edge oldDoorEdge = doorEdge(targetCluster, oldBinding);
        DungeonClusterBoundary oldDoorBoundary = boundaryAt(targetCluster, oldDoorEdge);
        if (oldDoorBoundary == null || !oldDoorBoundary.isDoor()) {
            return null;
        }
        DungeonTopologyRef expectedTopologyRef = oldDoorBoundary.resolvedTopologyRef(targetCluster.center());
        Edge nextDoorEdge = doorEdge(targetCluster, newBinding);
        if (!matchingTopology(expectedTopologyRef, oldBinding, newBinding)
                || sameBoundaryKey(oldDoorEdge, nextDoorEdge)) {
            return null;
        }
        return new DoorBindingMoveContext(
                targetCluster,
                oldDoorBoundary,
                expectedTopologyRef,
                nextDoorEdge,
                boundaryAt(targetCluster, nextDoorEdge),
                newBinding);
    }

    private static boolean sameRoomClusterMove(
            @Nullable CorridorDoorBindingState oldBinding,
            @Nullable CorridorDoorBindingState newBinding
    ) {
        return oldBinding != null
                && newBinding != null
                && !sameBoundary(oldBinding, newBinding)
                && oldBinding.roomId() == newBinding.roomId()
                && oldBinding.clusterId() == newBinding.clusterId();
    }

    private static @Nullable RoomCluster targetCluster(
            DungeonMap sourceMap,
            CorridorDoorBindingState oldBinding
    ) {
        RoomRegion room = sourceMap.rooms().findRoom(oldBinding.roomId()).orElse(null);
        if (room == null || room.clusterId() != oldBinding.clusterId()) {
            return null;
        }
        return cluster(sourceMap, oldBinding.clusterId());
    }

    private static boolean matchingTopology(
            DungeonTopologyRef expectedTopologyRef,
            CorridorDoorBindingState oldBinding,
            CorridorDoorBindingState newBinding
    ) {
        return expectedTopologyRef.equals(oldBinding.topologyRef())
                && expectedTopologyRef.equals(newBinding.topologyRef());
    }

    private static boolean sameBoundaryKey(Edge oldDoorEdge, Edge nextDoorEdge) {
        return DungeonBoundaryKey.from(oldDoorEdge).equals(DungeonBoundaryKey.from(nextDoorEdge));
    }

    private static boolean sameBoundary(
            CorridorDoorBindingState oldBinding,
            CorridorDoorBindingState newBinding
    ) {
        return oldBinding.roomId() == newBinding.roomId()
                && oldBinding.clusterId() == newBinding.clusterId()
                && oldBinding.relativeCell().equals(newBinding.relativeCell())
                && oldBinding.direction() == newBinding.direction();
    }

    private static @Nullable DungeonClusterBoundary boundaryAt(RoomCluster cluster, Edge edge) {
        if (cluster == null || edge == null) {
            return null;
        }
        DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
        for (DungeonClusterBoundary boundary : cluster.orderedAuthoredBoundaries()) {
            if (boundary != null && key.equals(DungeonBoundaryKey.from(boundary.absoluteEdge(cluster.center())))) {
                return boundary;
            }
        }
        return null;
    }

    private static Edge doorEdge(RoomCluster cluster, CorridorDoorBindingState binding) {
        return CorridorDoorBindingGeometry.absoluteDoorEdge(binding, cluster.center());
    }

    private static @Nullable RoomCluster cluster(DungeonMap dungeonMap, long clusterId) {
        for (RoomCluster cluster : dungeonMap.topology().roomClusters()) {
            if (cluster.clusterId() == clusterId) {
                return cluster;
            }
        }
        return null;
    }
}
