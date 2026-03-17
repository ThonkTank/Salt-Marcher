package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.domain.model.CorridorComponent;
import features.world.dungeonmap.domain.model.CorridorGeometry;
import features.world.dungeonmap.domain.model.CorridorTopology;
import features.world.dungeonmap.domain.model.DungeonCorridor;
import features.world.dungeonmap.domain.model.DungeonCorridorGeometry;
import features.world.dungeonmap.domain.model.DungeonCorridorGeometry.LayoutContext;
import features.world.dungeonmap.domain.model.DungeonLayout;
import features.world.dungeonmap.domain.model.DungeonRoom;
import features.world.dungeonmap.domain.model.DungeonRoomCluster;
import features.world.dungeonmap.domain.model.DoorSegment;
import features.world.dungeonmap.domain.model.GridSegment;
import features.world.dungeonmap.domain.model.Point2i;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonLayoutRenderData {

    private final DungeonLayout layout;
    private final LayoutContext layoutContext;
    private final CorridorTopology corridorTopology;
    private final Map<Long, CorridorGeometry> corridorGeometries;
    private final Set<Point2i> corridorCells;
    private final Map<Point2i, List<Long>> corridorIdsByCell;
    private final Map<CorridorRenderKeys.CorridorDoorMarkerKey, List<Long>> corridorIdsByDoor;
    private final Map<CorridorRenderKeys.CorridorSegmentKey, List<Long>> corridorIdsBySegment;
    private final Map<Point2i, DungeonRoom> roomsByCell;
    private final Map<Point2i, DungeonRoomCluster> clustersByCell;
    private final Map<Long, List<Long>> corridorIdsByCluster;
    private final Map<Point2i, List<Long>> clusterIdsByVertex;
    private DungeonLayoutRenderData(
            DungeonLayout layout,
            LayoutContext layoutContext,
            CorridorTopology corridorTopology,
            Map<Long, CorridorGeometry> corridorGeometries,
            Set<Point2i> corridorCells,
            Map<Point2i, List<Long>> corridorIdsByCell,
            Map<CorridorRenderKeys.CorridorDoorMarkerKey, List<Long>> corridorIdsByDoor,
            Map<CorridorRenderKeys.CorridorSegmentKey, List<Long>> corridorIdsBySegment,
            Map<Point2i, DungeonRoom> roomsByCell,
            Map<Point2i, DungeonRoomCluster> clustersByCell,
            Map<Long, List<Long>> corridorIdsByCluster,
            Map<Point2i, List<Long>> clusterIdsByVertex
    ) {
        this.layout = layout;
        this.layoutContext = layoutContext;
        this.corridorTopology = corridorTopology;
        this.corridorGeometries = corridorGeometries;
        this.corridorCells = corridorCells;
        this.corridorIdsByCell = corridorIdsByCell;
        this.corridorIdsByDoor = corridorIdsByDoor;
        this.corridorIdsBySegment = corridorIdsBySegment;
        this.roomsByCell = roomsByCell;
        this.clustersByCell = clustersByCell;
        this.corridorIdsByCluster = corridorIdsByCluster;
        this.clusterIdsByVertex = clusterIdsByVertex;
    }

    public static DungeonLayoutRenderData from(DungeonLayout layout) {
        LayoutContext layoutContext = layout == null
                ? new LayoutContext(Map.of(), Map.of(), Map.of())
                : DungeonCorridorGeometry.layoutContext(layout);
        CorridorTopology corridorTopology = layout == null
                ? new CorridorTopology(Map.of(), Map.of(), Map.of())
                : DungeonCorridorGeometry.corridorTopology(layout, layoutContext);
        Map<Long, CorridorGeometry> corridorGeometries = corridorTopology.corridorGeometries();
        Set<Point2i> corridorCells = new LinkedHashSet<>();
        Map<Point2i, List<Long>> corridorIdsByCell = new HashMap<>();
        Map<CorridorRenderKeys.CorridorDoorMarkerKey, List<Long>> corridorIdsByDoor = new HashMap<>();
        Map<CorridorRenderKeys.CorridorSegmentKey, List<Long>> corridorIdsBySegment = new HashMap<>();
        Map<Point2i, DungeonRoom> roomsByCell = indexRoomsByCell(layout);
        Map<Point2i, DungeonRoomCluster> clustersByCell = indexClustersByCell(layout);
        Map<Long, List<Long>> corridorIdsByCluster = indexCorridorIdsByCluster(layout);
        Map<Point2i, List<Long>> clusterIdsByVertex = indexClusterIdsByVertex(layout);
        List<CorridorGeometry> orderedGeometries = layout == null
                ? List.copyOf(corridorGeometries.values())
                : layout.corridors().stream()
                        .map(corridor -> corridorGeometries.get(corridor.corridorId()))
                        .filter(geometry -> geometry != null)
                        .toList();
        for (CorridorGeometry geometry : orderedGeometries) {
            corridorCells.addAll(geometry.cells());
            for (Point2i cell : geometry.cells()) {
                corridorIdsByCell.computeIfAbsent(cell, ignored -> new ArrayList<>()).add(geometry.corridorId());
            }
            for (DoorSegment door : geometry.doors()) {
                corridorIdsByDoor.computeIfAbsent(CorridorRenderKeys.doorMarkerKey(door), ignored -> new ArrayList<>())
                        .add(geometry.corridorId());
            }
            for (GridSegment segment : geometry.segments()) {
                corridorIdsBySegment.computeIfAbsent(
                                CorridorRenderKeys.segmentKey(segment.from(), segment.to()),
                                ignored -> new ArrayList<>())
                        .add(geometry.corridorId());
            }
        }
        return new DungeonLayoutRenderData(
                layout,
                layoutContext,
                corridorTopology,
                Map.copyOf(corridorGeometries),
                Set.copyOf(corridorCells),
                immutableListMap(corridorIdsByCell),
                immutableListMap(corridorIdsByDoor),
                immutableListMap(corridorIdsBySegment),
                Map.copyOf(roomsByCell),
                Map.copyOf(clustersByCell),
                immutableListMap(corridorIdsByCluster),
                immutableListMap(clusterIdsByVertex));
    }

    public DungeonLayout layout() {
        return layout;
    }

    public LayoutContext layoutContext() {
        return layoutContext;
    }

    public List<Point2i> corridorPath(Long corridorId) {
        CorridorGeometry geometry = corridorGeometry(corridorId);
        if (geometry == null || geometry.segments().isEmpty()) {
            return List.of();
        }
        java.util.List<Point2i> points = new java.util.ArrayList<>();
        for (GridSegment segment : geometry.segments()) {
            if (points.isEmpty() || !points.get(points.size() - 1).equals(segment.from())) {
                points.add(segment.from());
            }
            points.add(segment.to());
        }
        return List.copyOf(points);
    }

    public CorridorGeometry corridorGeometry(Long corridorId) {
        return corridorId == null ? null : corridorGeometries.get(corridorId);
    }

    public Set<Point2i> corridorCells() {
        return corridorCells;
    }

    public List<Long> corridorIdsAtCell(Point2i cell) {
        return cell == null ? List.of() : corridorIdsByCell.getOrDefault(cell, List.of());
    }

    public List<Long> corridorIdsForDoorFromRoom(DoorSegment door) {
        return door == null ? List.of() : corridorIdsByDoor.getOrDefault(CorridorRenderKeys.doorMarkerKey(door), List.of());
    }

    public Map<CorridorRenderKeys.CorridorDoorMarkerKey, List<Long>> corridorIdsByDoorMarker() {
        return corridorIdsByDoor;
    }

    public Map<CorridorRenderKeys.CorridorSegmentKey, List<Long>> corridorIdsBySegment() {
        return corridorIdsBySegment;
    }

    public DungeonRoom roomAtCell(Point2i cell) {
        return cell == null ? null : roomsByCell.get(cell);
    }

    public DungeonRoomCluster clusterAtCell(Point2i cell) {
        return cell == null ? null : clustersByCell.get(cell);
    }

    public List<Long> corridorIdsForCluster(Long clusterId) {
        return clusterId == null ? List.of() : corridorIdsByCluster.getOrDefault(clusterId, List.of());
    }

    public List<Long> clusterIdsAtVertex(Point2i vertex) {
        return vertex == null ? List.of() : clusterIdsByVertex.getOrDefault(vertex, List.of());
    }

    public CorridorTopology corridorTopology() {
        return corridorTopology;
    }

    public CorridorComponent corridorComponent(String componentId) {
        return corridorTopology.componentById(componentId);
    }

    public CorridorComponent corridorComponentForCorridor(Long corridorId) {
        return corridorTopology.componentForCorridor(corridorId);
    }

    public String corridorComponentId(Long corridorId) {
        return corridorId == null ? null : corridorTopology.componentIdByCorridorId().get(corridorId);
    }

    private static <K> Map<K, List<Long>> immutableListMap(Map<K, List<Long>> source) {
        Map<K, List<Long>> copy = new HashMap<>();
        for (Map.Entry<K, List<Long>> entry : source.entrySet()) {
            copy.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(copy);
    }

    private static Map<Point2i, DungeonRoom> indexRoomsByCell(DungeonLayout layout) {
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
        return result;
    }

    private static Map<Point2i, DungeonRoomCluster> indexClustersByCell(DungeonLayout layout) {
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
        return result;
    }

    private static Map<Long, List<Long>> indexCorridorIdsByCluster(DungeonLayout layout) {
        if (layout == null) {
            return Map.of();
        }
        Map<Long, List<Long>> result = new HashMap<>();
        Map<Long, LinkedHashSet<Long>> mutable = new HashMap<>();
        for (DungeonCorridor corridor : layout.corridors()) {
            if (corridor == null || corridor.corridorId() == null) {
                continue;
            }
            LinkedHashSet<Long> touchedClusters = new LinkedHashSet<>();
            for (Long roomId : corridor.roomIds()) {
                DungeonRoomCluster cluster = layout.clusterForRoom(roomId);
                if (cluster != null && cluster.clusterId() != null) {
                    touchedClusters.add(cluster.clusterId());
                }
            }
            for (Long clusterId : touchedClusters) {
                mutable.computeIfAbsent(clusterId, ignored -> new LinkedHashSet<>()).add(corridor.corridorId());
            }
        }
        for (Map.Entry<Long, LinkedHashSet<Long>> entry : mutable.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return result;
    }

    private static Map<Point2i, List<Long>> indexClusterIdsByVertex(DungeonLayout layout) {
        if (layout == null) {
            return Map.of();
        }
        Map<Point2i, LinkedHashSet<Long>> mutable = new HashMap<>();
        for (DungeonRoomCluster cluster : layout.clusters()) {
            if (cluster == null || cluster.clusterId() == null) {
                continue;
            }
            for (Point2i cell : layout.clusterCells(cluster.clusterId())) {
                mutable.computeIfAbsent(new Point2i(cell.x(), cell.y()), ignored -> new LinkedHashSet<>()).add(cluster.clusterId());
                mutable.computeIfAbsent(new Point2i(cell.x() + 1, cell.y()), ignored -> new LinkedHashSet<>()).add(cluster.clusterId());
                mutable.computeIfAbsent(new Point2i(cell.x(), cell.y() + 1), ignored -> new LinkedHashSet<>()).add(cluster.clusterId());
                mutable.computeIfAbsent(new Point2i(cell.x() + 1, cell.y() + 1), ignored -> new LinkedHashSet<>()).add(cluster.clusterId());
            }
        }
        Map<Point2i, List<Long>> result = new HashMap<>();
        for (Map.Entry<Point2i, LinkedHashSet<Long>> entry : mutable.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }
}
