package src.domain.dungeon.model.runtime.helper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;
import src.domain.dungeon.model.core.structure.room.RoomClusterFloorMap;
import src.domain.dungeon.model.core.structure.room.RoomClusterWallMap.WallRun;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleProjection;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleProjectionKind;

public final class DungeonEditorClusterHandleProjectionHelper {

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
        Map<Integer, List<Cell>> cellsByLevel = cluster.cellsByLevel();
        Cell labelCell = primaryLabelCell(cluster, cellsByLevel);
        result.add(new DungeonEditorHandleProjection(
                DungeonEditorHandleProjectionKind.CLUSTER_LABEL,
                new DungeonTopologyRef(DungeonTopologyElementKind.ROOM, room.roomId()),
                cluster.clusterId(),
                cluster.clusterId(),
                0L,
                room.roomId(),
                0,
                labelCell,
                labelCell.q(),
                labelCell.r(),
                Direction.NORTH,
                cluster.name()));
        for (Map.Entry<Integer, List<Cell>> entry : cellsByLevel.entrySet()) {
            appendClusterCornerHandles(result, cluster, room, entry.getKey());
            appendWallRunHandles(result, cluster, room, entry.getKey());
        }
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
            clusterRooms.sort((left, right) -> Long.compare(left.roomId(), right.roomId()));
            result.put(entry.getKey(), List.copyOf(clusterRooms));
        }
        return Map.copyOf(result);
    }

    private static void appendClusterCornerHandles(
            List<DungeonEditorHandleProjection> result,
            DungeonRoomCluster cluster,
            DungeonRoom room,
            int level
    ) {
        List<Cell> corners = cluster.authoredBoundaryVertices(level);
        for (int index = 0; index < corners.size(); index++) {
            Cell corner = corners.get(index);
            result.add(new DungeonEditorHandleProjection(
                    DungeonEditorHandleProjectionKind.CLUSTER_CORNER,
                    new DungeonTopologyRef(DungeonTopologyElementKind.ROOM, room.roomId()),
                    room.roomId(),
                    cluster.clusterId(),
                    0L,
                    room.roomId(),
                    index,
                    corner,
                    corner.q(),
                    corner.r(),
                    Direction.NORTH,
                    "Ecke " + (index + 1)));
        }
    }

    private static Cell primaryLabelCell(DungeonRoomCluster cluster, Map<Integer, List<Cell>> cellsByLevel) {
        return new RoomClusterFloorMap(cellsByLevel).preferredCentroidOr(cluster.center().level(), cluster.center());
    }

    private static void appendWallRunHandles(
            List<DungeonEditorHandleProjection> result,
            DungeonRoomCluster cluster,
            DungeonRoom room,
            int level
    ) {
        List<WallRun> wallRuns = cluster.authoredWallRuns(level);
        for (int index = 0; index < wallRuns.size(); index++) {
            WallRun wallRun = wallRuns.get(index);
            result.add(new DungeonEditorHandleProjection(
                    DungeonEditorHandleProjectionKind.CLUSTER_WALL_RUN,
                    new DungeonTopologyRef(DungeonTopologyElementKind.ROOM, room.roomId()),
                    cluster.clusterId(),
                    cluster.clusterId(),
                    0L,
                    room.roomId(),
                    index,
                    wallRun.anchorCell(),
                    wallRun.markerQ(),
                    wallRun.markerR(),
                    wallRun.direction(),
                    "Wandlauf " + (index + 1)));
        }
    }
}
