package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;

/**
 * Owns authored movement of a whole room cluster and its room anchors.
 */
public final class RoomClusterMovement {

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
        return new DungeonMap(
                target.metadata(),
                nextTopology,
                target.topologyIndex(),
                nextRooms,
                target.corridors(),
                target.stairs(),
                target.transitionCatalog(),
                target.revision() + 1L);
    }

    private static SpatialTopology moveTopologyCluster(
            SpatialTopology topology,
            long clusterId,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<DungeonRoomCluster> movedClusters = new ArrayList<>();
        boolean changed = false;
        for (DungeonRoomCluster cluster : topology.roomClusters()) {
            if (cluster.clusterId() == clusterId) {
                movedClusters.add(new DungeonRoomCluster(
                        cluster.clusterId(),
                        cluster.mapId(),
                        new Cell(
                                cluster.center().q() + deltaQ,
                                cluster.center().r() + deltaR,
                                cluster.center().level() + deltaLevel),
                        movedCellsByLevel(cluster.relativeVerticesByLevel(), deltaLevel),
                        movedBoundariesByLevel(cluster.boundariesByLevel(), deltaLevel)));
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
        List<DungeonRoom> movedRooms = new ArrayList<>();
        boolean changed = false;
        for (DungeonRoom room : rooms.rooms()) {
            if (room.clusterId() == clusterId) {
                movedRooms.add(movedRoom(room, deltaQ, deltaR, deltaLevel));
                changed = true;
            } else {
                movedRooms.add(room);
            }
        }
        return changed ? new RoomCatalog(movedRooms) : rooms;
    }

    private static DungeonRoom movedRoom(DungeonRoom room, int deltaQ, int deltaR, int deltaLevel) {
        Map<Integer, Cell> movedAnchors = new LinkedHashMap<>();
        for (Map.Entry<Integer, Cell> entry : room.floorAnchors().entrySet()) {
            Cell anchor = entry.getValue();
            int nextLevel = entry.getKey() + deltaLevel;
            movedAnchors.put(
                    nextLevel,
                    new Cell(anchor.q() + deltaQ, anchor.r() + deltaR, anchor.level() + deltaLevel));
        }
        return new DungeonRoom(
                room.roomId(),
                room.mapId(),
                room.clusterId(),
                room.name(),
                movedAnchors,
                room.narration());
    }

    private static Map<Integer, List<Cell>> movedCellsByLevel(
            Map<Integer, List<Cell>> cellsByLevel,
            int deltaLevel
    ) {
        if (deltaLevel == 0 || cellsByLevel == null || cellsByLevel.isEmpty()) {
            return cellsByLevel;
        }
        Map<Integer, List<Cell>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<Cell>> entry : cellsByLevel.entrySet()) {
            List<Cell> movedCells = new ArrayList<>();
            for (Cell cell : entry.getValue()) {
                if (cell != null) {
                    movedCells.add(new Cell(cell.q(), cell.r(), cell.level() + deltaLevel));
                }
            }
            result.put(entry.getKey() + deltaLevel, movedCells);
        }
        return Map.copyOf(result);
    }

    private static Map<Integer, List<DungeonClusterBoundary>> movedBoundariesByLevel(
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel,
            int deltaLevel
    ) {
        if (deltaLevel == 0 || boundariesByLevel == null || boundariesByLevel.isEmpty()) {
            return boundariesByLevel;
        }
        Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry : boundariesByLevel.entrySet()) {
            List<DungeonClusterBoundary> movedBoundaries = new ArrayList<>();
            for (DungeonClusterBoundary boundary : entry.getValue()) {
                if (boundary != null) {
                    movedBoundaries.add(new DungeonClusterBoundary(
                            boundary.clusterId(),
                            boundary.level() + deltaLevel,
                            new Cell(
                                    boundary.relativeCell().q(),
                                    boundary.relativeCell().r(),
                                    boundary.relativeCell().level() + deltaLevel),
                            boundary.direction(),
                            boundary.kind(),
                            boundary.topologyRef()));
                }
            }
            result.put(entry.getKey() + deltaLevel, movedBoundaries);
        }
        return Map.copyOf(result);
    }
}
