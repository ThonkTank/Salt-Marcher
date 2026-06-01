package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class DungeonStairRoomInteriorValidationLogic {
    private final DungeonRoomCellProjection roomCellProjection = new DungeonRoomCellProjection();

    boolean avoidsRoomInteriors(
            SpatialTopology topology,
            RoomCatalog rooms,
            DungeonStairShape shape,
            DungeonCell anchor,
            DungeonEdgeDirection direction,
            int dimension1,
            int dimension2
    ) {
        if (invalidInput(topology, rooms, shape, anchor, direction)) {
            return false;
        }
        List<DungeonCell> pathCells = pathCells(shape, anchor, direction, dimension1);
        if (!uniquePathCells(pathCells)) {
            return false;
        }
        Set<DungeonCell> roomCells = roomCells(topology, rooms);
        if (roomCells.isEmpty()) {
            return true;
        }
        Set<DungeonCell> exitCells = exitCells(shape, anchor, direction, dimension1, dimension2);
        return avoidsRoomInteriors(pathCells, roomCells, exitCells);
    }

    private static boolean invalidInput(
            SpatialTopology topology,
            RoomCatalog rooms,
            DungeonStairShape shape,
            DungeonCell anchor,
            DungeonEdgeDirection direction
    ) {
        return topology == null || rooms == null || shape == null || anchor == null || direction == null;
    }

    private static boolean avoidsRoomInteriors(
            List<DungeonCell> pathCells,
            Set<DungeonCell> roomCells,
            Set<DungeonCell> exitCells
    ) {
        for (DungeonCell pathCell : pathCells) {
            if (crossesRoomInterior(pathCell, roomCells, exitCells)) {
                return false;
            }
        }
        return true;
    }

    private static boolean uniquePathCells(List<DungeonCell> pathCells) {
        return new LinkedHashSet<>(pathCells).size() == pathCells.size();
    }

    private static boolean crossesRoomInterior(
            DungeonCell pathCell,
            Set<DungeonCell> roomCells,
            Set<DungeonCell> exitCells
    ) {
        return roomCells.contains(pathCell) && !exitCells.contains(pathCell);
    }

    private static List<DungeonCell> pathCells(
            DungeonStairShape shape,
            DungeonCell anchor,
            DungeonEdgeDirection direction,
            int dimension1
    ) {
        return DungeonStairGeometryValues.generatedPath(shape, anchor, direction, dimension1);
    }

    private Set<DungeonCell> roomCells(SpatialTopology topology, RoomCatalog rooms) {
        Set<DungeonCell> result = new LinkedHashSet<>();
        for (DungeonRoomCluster cluster : topology.roomClusters()) {
            for (List<DungeonCell> cells : roomCellProjection.cellsByRoom(
                    cluster,
                    clusterRooms(rooms, cluster.clusterId())).values()) {
                result.addAll(cells);
            }
        }
        return Set.copyOf(result);
    }

    private static List<DungeonRoom> clusterRooms(RoomCatalog rooms, long clusterId) {
        List<DungeonRoom> result = new ArrayList<>();
        for (DungeonRoom room : rooms.rooms()) {
            if (room != null && room.clusterId() == clusterId) {
                result.add(room);
            }
        }
        return List.copyOf(result);
    }

    private static Set<DungeonCell> exitCells(
            DungeonStairShape shape,
            DungeonCell anchor,
            DungeonEdgeDirection direction,
            int dimension1,
            int dimension2
    ) {
        Set<DungeonCell> result = new LinkedHashSet<>();
        for (DungeonStairExit exit : DungeonStairGeometryValues.generatedExits(
                shape,
                anchor,
                direction,
                dimension1,
                dimension2,
                List.of())) {
            result.add(exit.position());
        }
        return Set.copyOf(result);
    }
}
