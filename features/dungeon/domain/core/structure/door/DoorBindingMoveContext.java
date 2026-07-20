package features.dungeon.domain.core.structure.door;

import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.corridor.CorridorDoorBindingGeometry;
import features.dungeon.domain.core.component.CorridorDoorBinding;
import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;

record DoorBindingMoveContext(
        RoomCluster targetCluster,
        BoundarySegment oldDoorBoundary,
        DungeonTopologyRef expectedTopologyRef,
        Edge nextDoorEdge,
        @Nullable BoundarySegment nextBoundary,
        CorridorDoorBinding newBinding
) {
    static @Nullable DoorBindingMoveContext from(
            DungeonMap sourceMap,
            @Nullable CorridorDoorBinding oldBinding,
            @Nullable CorridorDoorBinding newBinding
    ) {
        if (!sameRoomClusterMove(oldBinding, newBinding)) {
            return null;
        }
        RoomCluster targetCluster = targetCluster(sourceMap, oldBinding);
        if (targetCluster == null) {
            return null;
        }
        Edge oldDoorEdge = doorEdge(targetCluster, oldBinding);
        BoundarySegment oldDoorBoundary = boundaryAt(targetCluster, oldDoorEdge);
        if (oldDoorBoundary == null || !oldDoorBoundary.isDoor()) {
            return null;
        }
        DungeonTopologyRef expectedTopologyRef = oldDoorBoundary.resolvedTopologyRef();
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
            @Nullable CorridorDoorBinding oldBinding,
            @Nullable CorridorDoorBinding newBinding
    ) {
        return oldBinding != null
                && newBinding != null
                && !sameBoundary(oldBinding, newBinding)
                && oldBinding.roomId() == newBinding.roomId()
                && oldBinding.clusterId() == newBinding.clusterId();
    }

    private static @Nullable RoomCluster targetCluster(
            DungeonMap sourceMap,
            CorridorDoorBinding oldBinding
    ) {
        RoomRegion room = sourceMap.rooms().findRoom(oldBinding.roomId()).orElse(null);
        if (room == null || room.clusterId() != oldBinding.clusterId()) {
            return null;
        }
        return cluster(sourceMap, oldBinding.clusterId());
    }

    private static boolean matchingTopology(
            DungeonTopologyRef expectedTopologyRef,
            CorridorDoorBinding oldBinding,
            CorridorDoorBinding newBinding
    ) {
        return expectedTopologyRef.equals(oldBinding.topologyRef())
                && expectedTopologyRef.equals(newBinding.topologyRef());
    }

    private static boolean sameBoundaryKey(Edge oldDoorEdge, Edge nextDoorEdge) {
        return DungeonBoundaryKey.from(oldDoorEdge).equals(DungeonBoundaryKey.from(nextDoorEdge));
    }

    private static boolean sameBoundary(
            CorridorDoorBinding oldBinding,
            CorridorDoorBinding newBinding
    ) {
        return oldBinding.roomId() == newBinding.roomId()
                && oldBinding.clusterId() == newBinding.clusterId()
                && oldBinding.roomCell().equals(newBinding.roomCell())
                && oldBinding.direction() == newBinding.direction();
    }

    private static @Nullable BoundarySegment boundaryAt(RoomCluster cluster, Edge edge) {
        if (cluster == null || edge == null) {
            return null;
        }
        return cluster.boundaryAt(edge);
    }

    private static Edge doorEdge(RoomCluster cluster, CorridorDoorBinding binding) {
        return CorridorDoorBindingGeometry.doorEdge(binding);
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
