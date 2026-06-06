package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;

public final class RoomTopologyRebuilder {

    public RebuildResult rebuilt(SpatialTopology topology, List<DungeonRoomTopologyClusterWork> workClusters) {
        List<DungeonRoomCluster> clusters = new ArrayList<>();
        List<DungeonRoom> rooms = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : sortedByClusterId(workClusters)) {
            if (work.allCells().isEmpty()) {
                continue;
            }
            List<DungeonRoom> rebuiltRooms = roomsFor(work);
            if (rebuiltRooms.isEmpty()) {
                continue;
            }
            clusters.add(work.rebuiltCluster());
            rooms.addAll(rebuiltRooms);
        }
        return new RebuildResult(safeTopology(topology).withRoomClusters(clusters), new RoomCatalog(rooms));
    }

    public RebuildResult rebuiltPreservingRooms(
            SpatialTopology topology,
            List<DungeonRoomTopologyClusterWork> workClusters
    ) {
        List<DungeonRoomCluster> clusters = new ArrayList<>();
        List<DungeonRoom> rooms = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : sortedByClusterId(workClusters)) {
            if (work.allCells().isEmpty() || work.rooms().isEmpty()) {
                continue;
            }
            clusters.add(work.cluster());
            rooms.addAll(work.rooms());
        }
        return new RebuildResult(safeTopology(topology).withRoomClusters(clusters), new RoomCatalog(rooms));
    }

    public DungeonRoomCluster clusterWithBoundaries(
            DungeonRoomTopologyClusterWork work,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        DungeonRoomTopologyClusterWork safeWork = Objects.requireNonNull(work, "work");
        return new DungeonRoomCluster(
                safeWork.cluster().clusterId(),
                safeWork.cluster().mapId(),
                safeWork.cluster().center(),
                safeWork.cluster().relativeVerticesByLevel(),
                boundariesByLevel);
    }

    public DungeonRoomCluster clusterForStretch(
            DungeonRoomTopologyClusterWork work,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        return Objects.requireNonNull(work, "work").rebuiltClusterWithBoundaries(boundariesByLevel);
    }

    private static SpatialTopology safeTopology(SpatialTopology topology) {
        return topology == null ? SpatialTopology.empty() : topology;
    }

    private static List<DungeonRoom> roomsFor(DungeonRoomTopologyClusterWork work) {
        Optional<Room> rebuilt = work.toCore().rebuiltRoom();
        if (rebuilt.isEmpty()) {
            return List.of();
        }
        Room room = rebuilt.get();
        return List.of(DungeonRoom.fromCore(room, narrationFor(work, room.roomId())));
    }

    private static DungeonRoomNarration narrationFor(DungeonRoomTopologyClusterWork work, long roomId) {
        for (DungeonRoom room : work.rooms()) {
            if (room != null && room.roomId() == roomId) {
                return room.narration();
            }
        }
        return DungeonRoomNarration.empty();
    }

    private static List<DungeonRoomTopologyClusterWork> sortedByClusterId(
            List<DungeonRoomTopologyClusterWork> workClusters
    ) {
        List<DungeonRoomTopologyClusterWork> result = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : workClusters == null
                ? List.<DungeonRoomTopologyClusterWork>of()
                : workClusters) {
            if (work != null && work.cluster() != null) {
                result.add(work);
            }
        }
        result.sort(RoomTopologyRebuilder::compareClusterWork);
        return result;
    }

    private static int compareClusterWork(DungeonRoomTopologyClusterWork left, DungeonRoomTopologyClusterWork right) {
        return Long.compare(left.cluster().clusterId(), right.cluster().clusterId());
    }

    public record RebuildResult(
            SpatialTopology topology,
            RoomCatalog rooms
    ) {
        public RebuildResult {
            topology = safeTopology(topology);
            rooms = rooms == null ? RoomCatalog.empty() : rooms;
        }
    }
}
