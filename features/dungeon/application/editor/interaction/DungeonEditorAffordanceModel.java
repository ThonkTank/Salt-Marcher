package features.dungeon.application.editor.interaction;

import features.dungeon.api.DungeonEditorHandleKind;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.graph.DungeonTopologyElementKind;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomClusterFloorMap;
import features.dungeon.domain.core.structure.room.RoomCellCoverage;
import features.dungeon.domain.core.structure.room.RoomClusterWallRun;
import features.dungeon.domain.core.structure.room.RoomClusterWallRunSource;

public final class DungeonEditorAffordanceModel {

    public List<DungeonEditorHandleProjection> clusterAffordances(@Nullable DungeonMap dungeonMap) {
        if (dungeonMap == null) {
            return List.of();
        }
        List<DungeonEditorHandleProjection> result = new ArrayList<>();
        Map<Long, RoomRegion> primaryRoomsByCluster = primaryRoomsByCluster(dungeonMap.rooms().rooms());
        for (RoomCluster cluster : dungeonMap.topology().roomClusters()) {
            if (cluster != null) {
                appendClusterAffordances(
                        result,
                        cluster,
                        dungeonMap.rooms().roomsInCluster(cluster.clusterId()),
                        primaryRoomsByCluster.get(cluster.clusterId()));
            }
        }
        return List.copyOf(result);
    }

    private static void appendClusterAffordances(
            List<DungeonEditorHandleProjection> result,
            RoomCluster cluster,
            List<RoomRegion> clusterRooms,
            @Nullable RoomRegion room
    ) {
        if (room == null) {
            return;
        }
        Map<Integer, List<Cell>> cellsByLevel = new RoomCellCoverage().cellsByLevel(cluster, clusterRooms);
        Cell labelCell = primaryLabelCell(cluster, cellsByLevel);
        result.add(new DungeonEditorHandleProjection(
                DungeonEditorHandleKind.CLUSTER_LABEL,
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
                null,
                List.of()));
        for (Map.Entry<Integer, List<Cell>> entry : cellsByLevel.entrySet()) {
            appendCornerAffordances(result, cluster, room, entry.getKey());
            appendWallRunAffordances(result, cluster, room, entry.getKey());
        }
    }

    private static Map<Long, RoomRegion> primaryRoomsByCluster(List<RoomRegion> rooms) {
        Map<Long, RoomRegion> result = new LinkedHashMap<>();
        for (RoomRegion room : rooms == null ? List.<RoomRegion>of() : rooms) {
            if (room != null) {
                RoomRegion existing = result.get(room.clusterId());
                if (existing == null || room.roomId() < existing.roomId()) {
                    result.put(room.clusterId(), room);
                }
            }
        }
        return Map.copyOf(result);
    }

    private static void appendCornerAffordances(
            List<DungeonEditorHandleProjection> result,
            RoomCluster cluster,
            RoomRegion room,
            int level
    ) {
        List<Cell> corners = cluster.authoredBoundaryVertices(level);
        for (int index = 0; index < corners.size(); index++) {
            Cell corner = corners.get(index);
            result.add(new DungeonEditorHandleProjection(
                    DungeonEditorHandleKind.CLUSTER_CORNER,
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
                    null,
                    List.of()));
        }
    }

    private static Cell primaryLabelCell(RoomCluster cluster, Map<Integer, List<Cell>> cellsByLevel) {
        return new RoomClusterFloorMap(cellsByLevel).preferredCentroidOr(cluster.center().level(), cluster.center());
    }

    private static void appendWallRunAffordances(
            List<DungeonEditorHandleProjection> result,
            RoomCluster cluster,
            RoomRegion room,
            int level
    ) {
        List<RoomClusterWallRun> wallRuns = cluster.authoredWallRuns(level);
        for (int index = 0; index < wallRuns.size(); index++) {
            RoomClusterWallRun wallRun = wallRuns.get(index);
            RoomClusterWallRunSource source = wallRun.source();
            result.add(new DungeonEditorHandleProjection(
                    DungeonEditorHandleKind.CLUSTER_WALL_RUN,
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
                    source.sourceEdge(),
                    source.sourceEdges()));
        }
    }
}
