package src.domain.dungeon.model.worldspace.helper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;
import src.domain.dungeon.model.core.structure.room.RoomCellCoverage;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleProjection;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleProjectionKind;
import src.domain.dungeon.model.worldspace.DungeonMap;

public final class DungeonEditorClusterHandleProjectionHelper {

    private static final RoomCellCoverage CELL_COVERAGE = new RoomCellCoverage();

    public List<DungeonEditorHandleProjection> project(DungeonMap dungeonMap) {
        List<DungeonEditorHandleProjection> result = new ArrayList<>();
        if (dungeonMap == null) {
            return List.of();
        }
        Map<Long, List<DungeonRoom>> roomsByCluster = roomsByCluster(dungeonMap.rooms().rooms());
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            if (cluster != null) {
                appendClusterHandles(
                        result,
                        cluster,
                        roomsByCluster.getOrDefault(cluster.clusterId(), List.of()));
            }
        }
        return List.copyOf(result);
    }

    private static void appendClusterHandles(
            List<DungeonEditorHandleProjection> result,
            DungeonRoomCluster cluster,
            List<DungeonRoom> rooms
    ) {
        if (rooms.isEmpty()) {
            return;
        }
        DungeonRoom room = rooms.getFirst();
        result.add(clusterLabel(cluster, room));
        for (Map.Entry<Integer, List<Cell>> entry : CELL_COVERAGE.cellsByLevel(cluster, rooms).entrySet()) {
            appendClusterCornerHandles(result, cluster, room, entry.getKey(), entry.getValue());
        }
    }

    private static DungeonEditorHandleProjection clusterLabel(DungeonRoomCluster cluster, DungeonRoom room) {
        return new DungeonEditorHandleProjection(
                DungeonEditorHandleProjectionKind.CLUSTER_LABEL,
                new DungeonTopologyRef(DungeonTopologyElementKind.ROOM, room.roomId()),
                room.roomId(),
                cluster.clusterId(),
                0L,
                room.roomId(),
                0,
                cluster.center(),
                Direction.NORTH,
                room.name());
    }

    private static Map<Long, List<DungeonRoom>> roomsByCluster(List<DungeonRoom> rooms) {
        Map<Long, List<DungeonRoom>> grouped = new LinkedHashMap<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            if (room != null) {
                List<DungeonRoom> clusterRooms = grouped.get(room.clusterId());
                if (clusterRooms == null) {
                    clusterRooms = new ArrayList<>();
                    grouped.put(room.clusterId(), clusterRooms);
                }
                clusterRooms.add(room);
            }
        }
        Map<Long, List<DungeonRoom>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, List<DungeonRoom>> entry : grouped.entrySet()) {
            List<DungeonRoom> clusterRooms = new ArrayList<>(entry.getValue());
            clusterRooms.sort(DungeonEditorClusterHandleProjectionHelper::compareByRoomId);
            result.put(entry.getKey(), List.copyOf(clusterRooms));
        }
        return Map.copyOf(result);
    }

    private static int compareByRoomId(DungeonRoom left, DungeonRoom right) {
        return Long.compare(left.roomId(), right.roomId());
    }

    private static void appendClusterCornerHandles(
            List<DungeonEditorHandleProjection> result,
            DungeonRoomCluster cluster,
            DungeonRoom room,
            int level,
            List<Cell> cells
    ) {
        List<Cell> corners = boundingCorners(cells, level);
        for (int index = 0; index < corners.size(); index++) {
            result.add(clusterCorner(cluster, room, corners.get(index), index));
        }
    }

    private static DungeonEditorHandleProjection clusterCorner(
            DungeonRoomCluster cluster,
            DungeonRoom room,
            Cell corner,
            int index
    ) {
        return new DungeonEditorHandleProjection(
                DungeonEditorHandleProjectionKind.CLUSTER_CORNER,
                new DungeonTopologyRef(DungeonTopologyElementKind.ROOM, room.roomId()),
                room.roomId(),
                cluster.clusterId(),
                0L,
                room.roomId(),
                index,
                corner,
                Direction.NORTH,
                "Ecke " + (index + 1));
    }

    private static List<Cell> boundingCorners(List<Cell> cells, int level) {
        if (cells == null || cells.isEmpty()) {
            return List.of();
        }
        int minQ = cells.getFirst().q();
        int maxQ = minQ;
        int minR = cells.getFirst().r();
        int maxR = minR;
        for (Cell cell : cells) {
            minQ = Math.min(minQ, cell.q());
            maxQ = Math.max(maxQ, cell.q());
            minR = Math.min(minR, cell.r());
            maxR = Math.max(maxR, cell.r());
        }
        return List.of(
                new Cell(minQ, minR, level),
                new Cell(maxQ + 1, minR, level),
                new Cell(maxQ + 1, maxR + 1, level),
                new Cell(minQ, maxR + 1, level));
    }
}
