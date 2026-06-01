package src.domain.dungeon.model.worldspace.helper;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.worldspace.model.DungeonCell;
import src.domain.dungeon.model.worldspace.model.DungeonEditorHandle;
import src.domain.dungeon.model.worldspace.model.DungeonEditorHandleFacts;
import src.domain.dungeon.model.worldspace.model.DungeonEditorHandleType;
import src.domain.dungeon.model.worldspace.model.DungeonEdgeDirection;
import src.domain.dungeon.model.worldspace.model.DungeonMap;
import src.domain.dungeon.model.worldspace.model.DungeonRoom;
import src.domain.dungeon.model.worldspace.model.DungeonRoomCellProjection;
import src.domain.dungeon.model.worldspace.model.DungeonRoomCluster;
import src.domain.dungeon.model.worldspace.model.DungeonTopologyElementKind;
import src.domain.dungeon.model.worldspace.model.DungeonTopologyRef;

public final class DungeonEditorClusterHandleProjectionHelper {

    private static final DungeonRoomCellProjection CELL_PROJECTOR = new DungeonRoomCellProjection();

    public List<DungeonEditorHandleFacts> project(DungeonMap dungeonMap) {
        List<DungeonEditorHandleFacts> result = new ArrayList<>();
        if (dungeonMap == null) {
            return List.of();
        }
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            appendClusterHandles(result, dungeonMap, cluster);
        }
        return List.copyOf(result);
    }

    private static void appendClusterHandles(
            List<DungeonEditorHandleFacts> result,
            DungeonMap dungeonMap,
            DungeonRoomCluster cluster
    ) {
        List<DungeonRoom> rooms = roomsForCluster(dungeonMap, cluster.clusterId());
        if (rooms.isEmpty()) {
            return;
        }
        DungeonRoom room = rooms.getFirst();
        result.add(clusterLabel(cluster, room));
        for (Map.Entry<Integer, List<DungeonCell>> entry : CELL_PROJECTOR.cellsByLevel(cluster, rooms).entrySet()) {
            appendClusterCornerHandles(result, cluster, room, entry.getKey(), entry.getValue());
        }
    }

    private static DungeonEditorHandleFacts clusterLabel(DungeonRoomCluster cluster, DungeonRoom room) {
        return new DungeonEditorHandleFacts(
                new DungeonEditorHandle(
                        DungeonEditorHandleType.CLUSTER_LABEL,
                        new DungeonTopologyRef(DungeonTopologyElementKind.ROOM, room.roomId()),
                        room.roomId(),
                        cluster.clusterId(),
                        0L,
                        room.roomId(),
                        0,
                        cluster.center(),
                        DungeonEdgeDirection.NORTH),
                room.name());
    }

    private static List<DungeonRoom> roomsForCluster(DungeonMap dungeonMap, long clusterId) {
        List<DungeonRoom> rooms = new ArrayList<>();
        for (DungeonRoom room : dungeonMap.rooms().rooms()) {
            if (room.clusterId() == clusterId) {
                rooms.add(room);
            }
        }
        rooms.sort(DungeonEditorClusterHandleProjectionHelper::compareByRoomId);
        return List.copyOf(rooms);
    }

    private static int compareByRoomId(DungeonRoom left, DungeonRoom right) {
        return Long.compare(left.roomId(), right.roomId());
    }

    private static void appendClusterCornerHandles(
            List<DungeonEditorHandleFacts> result,
            DungeonRoomCluster cluster,
            DungeonRoom room,
            int level,
            List<DungeonCell> cells
    ) {
        List<DungeonCell> corners = boundingCorners(cells, level);
        for (int index = 0; index < corners.size(); index++) {
            result.add(clusterCorner(cluster, room, corners.get(index), index));
        }
    }

    private static DungeonEditorHandleFacts clusterCorner(
            DungeonRoomCluster cluster,
            DungeonRoom room,
            DungeonCell corner,
            int index
    ) {
        return new DungeonEditorHandleFacts(
                new DungeonEditorHandle(
                        DungeonEditorHandleType.CLUSTER_CORNER,
                        new DungeonTopologyRef(DungeonTopologyElementKind.ROOM, room.roomId()),
                        room.roomId(),
                        cluster.clusterId(),
                        0L,
                        room.roomId(),
                        index,
                        corner,
                        DungeonEdgeDirection.NORTH),
                "Ecke " + (index + 1));
    }

    private static List<DungeonCell> boundingCorners(List<DungeonCell> cells, int level) {
        if (cells == null || cells.isEmpty()) {
            return List.of();
        }
        int minQ = cells.getFirst().q();
        int maxQ = minQ;
        int minR = cells.getFirst().r();
        int maxR = minR;
        for (DungeonCell cell : cells) {
            minQ = Math.min(minQ, cell.q());
            maxQ = Math.max(maxQ, cell.q());
            minR = Math.min(minR, cell.r());
            maxR = Math.max(maxR, cell.r());
        }
        return List.of(
                new DungeonCell(minQ, minR, level),
                new DungeonCell(maxQ + 1, minR, level),
                new DungeonCell(maxQ + 1, maxR + 1, level),
                new DungeonCell(minQ, maxR + 1, level));
    }
}
