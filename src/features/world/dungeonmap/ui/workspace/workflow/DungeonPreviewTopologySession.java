package features.world.dungeonmap.ui.workspace.workflow;

import features.world.dungeonmap.model.CorridorGeometry;
import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonCorridorGeometry;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.ui.workspace.render.DungeonLayoutRenderData;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

public final class DungeonPreviewTopologySession {

    private DungeonLayout previewLayout;
    private DungeonCorridorGeometry.LayoutContext previewCorridorLayoutContext;
    private Map<Long, CorridorGeometry> previewCorridorGeometries = Map.of();
    private Map<Point2i, DungeonRoom> previewRoomsByCell = Map.of();
    private Map<Point2i, DungeonRoomCluster> previewClustersByCell = Map.of();

    public void reset() {
        previewLayout = null;
        previewCorridorLayoutContext = null;
        previewCorridorGeometries = Map.of();
        previewRoomsByCell = Map.of();
        previewClustersByCell = Map.of();
    }

    public void rebuild(
            DungeonLayout baseLayout,
            DungeonLayoutRenderData baseRenderData,
            Map<Long, Point2i> previewClusterCenters,
            Function<DungeonRoomCluster, Point2i> previewCenter,
            Function<Long, Point2i> previewDelta
    ) {
        if (baseLayout == null || previewClusterCenters.isEmpty()) {
            reset();
            return;
        }
        List<DungeonRoomCluster> previewClusters = baseLayout.clusters().stream()
                .map(cluster -> new DungeonRoomCluster(
                        cluster.clusterId(),
                        cluster.mapId(),
                        previewCenter.apply(cluster),
                        cluster.relativeVertices(),
                        cluster.edgeOverrides()))
                .toList();
        List<DungeonRoom> previewRooms = baseLayout.rooms().stream()
                .map(room -> new DungeonRoom(
                        room.roomId(),
                        room.mapId(),
                        room.clusterId(),
                        room.name(),
                        room.componentAnchor().add(previewDelta.apply(room.clusterId()))))
                .toList();
        previewLayout = new DungeonLayout(baseLayout.map(), previewRooms, baseLayout.corridors(), previewClusters);
        previewRoomsByCell = indexPreviewRoomsByCell(previewLayout);
        previewClustersByCell = indexPreviewClustersByCell(previewLayout);
        previewCorridorLayoutContext = DungeonCorridorGeometry.layoutContext(previewLayout);
        previewCorridorGeometries = buildPreviewCorridorGeometries(baseLayout, baseRenderData, previewClusterCenters.keySet());
    }

    public DungeonLayout previewLayout() {
        return previewLayout;
    }

    public CorridorGeometry corridorGeometryOverride(Long corridorId) {
        return corridorId == null ? null : previewCorridorGeometries.get(corridorId);
    }

    public DungeonRoom roomAtCell(Point2i cell) {
        return cell == null ? null : previewRoomsByCell.get(cell);
    }

    public DungeonRoomCluster clusterAtCell(Point2i cell) {
        return cell == null ? null : previewClustersByCell.get(cell);
    }

    private Map<Long, CorridorGeometry> buildPreviewCorridorGeometries(
            DungeonLayout baseLayout,
            DungeonLayoutRenderData baseRenderData,
            Set<Long> movedClusterIds
    ) {
        if (baseLayout == null || baseRenderData == null || previewLayout == null || previewCorridorLayoutContext == null) {
            return Map.of();
        }
        Set<Long> affectedCorridorIds = new LinkedHashSet<>();
        for (Long clusterId : movedClusterIds) {
            affectedCorridorIds.addAll(baseRenderData.corridorIdsForCluster(clusterId));
        }
        if (affectedCorridorIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, CorridorGeometry> geometries = new HashMap<>();
        for (Long corridorId : affectedCorridorIds) {
            DungeonCorridor corridor = baseLayout.corridorById(corridorId);
            if (corridor == null) {
                continue;
            }
            CorridorGeometry geometry = DungeonCorridorGeometry.corridorGeometry(
                    previewLayout,
                    corridor,
                    previewCorridorLayoutContext);
            if (geometry != null) {
                geometries.put(corridorId, geometry);
            }
        }
        return Map.copyOf(geometries);
    }

    private Map<Point2i, DungeonRoom> indexPreviewRoomsByCell(DungeonLayout layout) {
        if (layout == null) {
            return Map.of();
        }
        Map<Point2i, DungeonRoom> result = new HashMap<>();
        for (DungeonRoom room : layout.rooms()) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            for (Point2i cell : layout.roomCells(room.roomId())) {
                result.put(cell, room);
            }
        }
        return Map.copyOf(result);
    }

    private Map<Point2i, DungeonRoomCluster> indexPreviewClustersByCell(DungeonLayout layout) {
        if (layout == null) {
            return Map.of();
        }
        Map<Point2i, DungeonRoomCluster> result = new HashMap<>();
        for (DungeonRoomCluster cluster : layout.clusters()) {
            if (cluster == null || cluster.clusterId() == null) {
                continue;
            }
            for (Point2i cell : layout.clusterCells(cluster.clusterId())) {
                result.put(cell, cluster);
            }
        }
        return Map.copyOf(result);
    }
}
