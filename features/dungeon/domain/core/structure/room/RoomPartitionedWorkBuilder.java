package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;

final class RoomPartitionedWorkBuilder {

    private static final DungeonRoomBoundaryPartition BOUNDARY_PARTITION = new DungeonRoomBoundaryPartition();
    private final RoomTopologyRebuilder rebuilder;

    RoomPartitionedWorkBuilder(RoomTopologyRebuilder rebuilder) {
        this.rebuilder = rebuilder;
    }

    DungeonRoomTopologyClusterWork partitionedWork(
            DungeonRoomTopologyClusterWork previous,
            Map<Integer, List<Cell>> nextCellsByLevel,
            Map<Integer, List<DungeonClusterBoundary>> preservedBoundariesByLevel,
            RoomMutationIdCursor ids,
            Map<Long, List<Cell>> previousCellsByRoom
    ) {
        return partitionedWork(
                previous,
                nextCellsByLevel,
                preservedBoundariesByLevel,
                ids,
                previousCellsByRoom,
                false);
    }

    DungeonRoomTopologyClusterWork stretchPartitionedWork(
            DungeonRoomTopologyClusterWork previous,
            Map<Integer, List<Cell>> nextCellsByLevel,
            Map<Integer, List<DungeonClusterBoundary>> preservedBoundariesByLevel,
            RoomMutationIdCursor ids,
            Map<Long, List<Cell>> previousCellsByRoom
    ) {
        return partitionedWork(
                previous,
                nextCellsByLevel,
                preservedBoundariesByLevel,
                ids,
                previousCellsByRoom,
                true);
    }

    private DungeonRoomTopologyClusterWork partitionedWork(
            DungeonRoomTopologyClusterWork previous,
            Map<Integer, List<Cell>> nextCellsByLevel,
            Map<Integer, List<DungeonClusterBoundary>> preservedBoundariesByLevel,
            RoomMutationIdCursor ids,
            Map<Long, List<Cell>> previousCellsByRoom,
            boolean stretch
    ) {
        DungeonRoomTopologyClusterWork partitionWork =
                new DungeonRoomTopologyClusterWork(previous.cluster(), previous.rooms(), nextCellsByLevel);
        List<DungeonRoom> rooms = BOUNDARY_PARTITION.roomsForMutation(
                partitionWork,
                nextCellsByLevel,
                preservedBoundariesByLevel,
                ids.nextRoomId(),
                previousCellsByRoom);
        ids.observeRooms(rooms);
        return new DungeonRoomTopologyClusterWork(
                rebuiltCluster(partitionWork, preservedBoundariesByLevel, stretch),
                rooms,
                nextCellsByLevel);
    }

    private DungeonRoomCluster rebuiltCluster(
            DungeonRoomTopologyClusterWork partitionWork,
            Map<Integer, List<DungeonClusterBoundary>> preservedBoundariesByLevel,
            boolean stretch
    ) {
        return stretch
                ? rebuilder.clusterForStretch(partitionWork, preservedBoundariesByLevel)
                : rebuilder.clusterWithBoundaries(partitionWork, preservedBoundariesByLevel);
    }

    DungeonRoomTopologyClusterWork rehomedWork(
            DungeonRoomTopologyClusterWork target,
            Map<Integer, List<Cell>> cellsByLevel,
            List<DungeonRoomTopologyClusterWork> sources
    ) {
        return rehomedWork(target, cellsByLevel, sources, Set.of());
    }

    DungeonRoomTopologyClusterWork rehomedWork(
            DungeonRoomTopologyClusterWork target,
            Map<Integer, List<Cell>> cellsByLevel,
            List<DungeonRoomTopologyClusterWork> sources,
            Set<Long> excludedRoomIds
    ) {
        List<DungeonRoom> rooms = new ArrayList<>();
        Set<Long> seenRoomIds = new LinkedHashSet<>();
        for (DungeonRoomTopologyClusterWork source : RoomMutationWorkSets.safeClusters(sources)) {
            for (DungeonRoom room : source.rooms()) {
                if (shouldRehome(room, excludedRoomIds, seenRoomIds)) {
                    rooms.add(rehomedRoom(room, target.cluster()));
                }
            }
        }
        return new DungeonRoomTopologyClusterWork(target.cluster(), rooms, cellsByLevel);
    }

    Map<Integer, List<DungeonClusterBoundary>> preservedBoundariesFor(
            DungeonRoomCluster targetCluster,
            List<DungeonRoomTopologyClusterWork> sources,
            Map<Integer, List<Cell>> nextCellsByLevel
    ) {
        List<DungeonClusterBoundary> boundaries = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork source : RoomMutationWorkSets.safeClusters(sources)) {
            boundaries.addAll(DungeonBoundaryRehoming.flatten(DungeonBoundaryRehoming.byLevel(
                    source.cluster(),
                    source.cluster().preservedBoundariesForTopologyWork(nextCellsByLevel),
                    targetCluster.toCore(nextCellsByLevel),
                    nextCellsByLevel)));
        }
        return DungeonClusterBoundary.orderedByLevel(boundaries);
    }

    private static boolean shouldRehome(DungeonRoom room, Set<Long> excludedRoomIds, Set<Long> seenRoomIds) {
        return room != null
                && !excludedRoomIds.contains(room.roomId())
                && seenRoomIds.add(room.roomId());
    }

    private static DungeonRoom rehomedRoom(DungeonRoom room, DungeonRoomCluster cluster) {
        return new DungeonRoom(
                room.roomId(),
                cluster.mapId(),
                cluster.clusterId(),
                room.name(),
                room.floorAnchors(),
                room.narration());
    }

}
