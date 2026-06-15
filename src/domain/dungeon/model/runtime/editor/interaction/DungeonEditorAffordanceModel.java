package src.domain.dungeon.model.runtime.editor.interaction;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;
import src.domain.dungeon.model.core.structure.room.RoomClusterFloorMap;
import src.domain.dungeon.model.core.structure.room.RoomClusterWallMap.WallRun;

public final class DungeonEditorAffordanceModel {

    public List<DungeonEditorHandleProjection> clusterAffordances(@Nullable DungeonMap dungeonMap) {
        if (dungeonMap == null) {
            return List.of();
        }
        List<DungeonEditorHandleProjection> result = new ArrayList<>();
        Map<Long, DungeonRoom> primaryRoomsByCluster = primaryRoomsByCluster(dungeonMap.rooms().rooms());
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            if (cluster != null) {
                appendClusterAffordances(
                        result,
                        cluster,
                        primaryRoomsByCluster.get(cluster.clusterId()));
            }
        }
        return List.copyOf(result);
    }

    private static void appendClusterAffordances(
            List<DungeonEditorHandleProjection> result,
            DungeonRoomCluster cluster,
            @Nullable DungeonRoom room
    ) {
        if (room == null) {
            return;
        }
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
                cluster.name(),
                null));
        for (Map.Entry<Integer, List<Cell>> entry : cellsByLevel.entrySet()) {
            appendCornerAffordances(result, cluster, room, entry.getKey());
            appendWallRunAffordances(result, cluster, room, entry.getKey());
        }
    }

    private static Map<Long, DungeonRoom> primaryRoomsByCluster(List<DungeonRoom> rooms) {
        Map<Long, DungeonRoom> result = new LinkedHashMap<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            if (room != null) {
                DungeonRoom existing = result.get(room.clusterId());
                if (existing == null || room.roomId() < existing.roomId()) {
                    result.put(room.clusterId(), room);
                }
            }
        }
        return Map.copyOf(result);
    }

    private static void appendCornerAffordances(
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
                    "Ecke " + (index + 1),
                    null));
        }
    }

    private static Cell primaryLabelCell(DungeonRoomCluster cluster, Map<Integer, List<Cell>> cellsByLevel) {
        return new RoomClusterFloorMap(cellsByLevel).preferredCentroidOr(cluster.center().level(), cluster.center());
    }

    private static void appendWallRunAffordances(
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
                    "Wandlauf " + (index + 1),
                    wallRun.sourceEdge()));
        }
    }
}
