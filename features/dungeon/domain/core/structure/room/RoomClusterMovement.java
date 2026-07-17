package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.corridor.RoomClusterCorridorMovement;
import features.dungeon.domain.core.structure.topology.SpatialTopology;

/**
 * Owns authored movement of a whole room cluster and its room anchors.
 */
public final class RoomClusterMovement {
    private static final RoomClusterCorridorMovement CORRIDOR_MOVEMENT = new RoomClusterCorridorMovement();

    public DungeonMap moveCluster(DungeonMap dungeonMap, long clusterId, int deltaQ, int deltaR, int deltaLevel) {
        DungeonMap target = Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (clusterId <= 0L || (deltaQ == 0 && deltaR == 0 && deltaLevel == 0)) {
            return target;
        }
        SpatialTopology nextTopology = moveTopologyCluster(target.topology(), clusterId, deltaQ, deltaR, deltaLevel);
        RoomCatalog nextRooms = moveRoomsForCluster(target.rooms(), clusterId, deltaQ, deltaR, deltaLevel);
        if (nextTopology.equals(target.topology()) && nextRooms.equals(target.rooms())) {
            return target;
        }
        DungeonMap clusterMovedMap = new DungeonMap(
                target.metadata(),
                nextTopology,
                target.topologyIndex(),
                nextRooms,
                target.corridors(),
                target.stairs(),
                target.transitionCatalog(),
                target.revision() + 1L);
        return CORRIDOR_MOVEMENT.moveAffectedCorridors(target, clusterMovedMap);
    }

    private static SpatialTopology moveTopologyCluster(
            SpatialTopology topology,
            long clusterId,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<RoomCluster> movedClusters = new ArrayList<>();
        boolean changed = false;
        for (RoomCluster cluster : topology.roomClusters()) {
            if (cluster.clusterId() == clusterId) {
                movedClusters.add(cluster.movedBy(deltaQ, deltaR, deltaLevel));
                changed = true;
            } else {
                movedClusters.add(cluster);
            }
        }
        return changed ? topology.withRoomClusters(movedClusters) : topology;
    }

    private static RoomCatalog moveRoomsForCluster(
            RoomCatalog rooms,
            long clusterId,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<RoomRegion> movedRooms = new ArrayList<>();
        boolean changed = false;
        for (RoomRegion room : rooms.rooms()) {
            if (room.clusterId() == clusterId) {
                movedRooms.add(movedRoom(room, deltaQ, deltaR, deltaLevel));
                changed = true;
            } else {
                movedRooms.add(room);
            }
        }
        return changed ? new RoomCatalog(movedRooms) : rooms;
    }

    private static RoomRegion movedRoom(RoomRegion room, int deltaQ, int deltaR, int deltaLevel) {
        java.util.Set<Cell> movedCells = new java.util.LinkedHashSet<>();
        for (Cell cell : room.floorCells()) {
            movedCells.add(new Cell(
                    cell.q() + deltaQ,
                    cell.r() + deltaR,
                    cell.level() + deltaLevel));
        }
        return new RoomRegion(
                room.roomId(),
                room.mapId(),
                room.clusterId(),
                room.name(),
                movedCells,
                room.narration());
    }
}
