package features.world.quarantine.dungeonmap.editor.workspace.preview;

import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorTopologyPlanner;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorLayoutContext;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.canvas.state.DungeonLayoutRenderData;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

public final class DungeonPreviewTopologySession {

    private DungeonLayout previewLayout;
    private CorridorLayoutContext previewCorridorLayoutContext;
    private Map<Long, CorridorGeometry> previewCorridorGeometries = Map.of();
    private Map<Point2i, DungeonRoom> previewRoomsByCell = Map.of();
    private Map<Point2i, DungeonRoomCluster> previewClustersByCell = Map.of();

    public DungeonPreviewTopologySession() {
    }

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
        previewCorridorLayoutContext = CorridorLayoutContext.from(previewLayout);
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
            DungeonCorridor corridor = baseLayout.findCorridor(corridorId);
            if (corridor == null) {
                continue;
            }
            CorridorGeometry geometry = CorridorTopologyPlanner.planCorridorGeometry(
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
