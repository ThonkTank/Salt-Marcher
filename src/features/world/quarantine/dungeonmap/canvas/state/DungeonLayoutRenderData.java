package features.world.quarantine.dungeonmap.canvas.state;

import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorComponent;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorTopology;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.primitives.GridSegment;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonLayoutRenderData {

    private final DungeonLayout layout;
    private final CorridorTopology corridorTopology;
    private final Map<Long, CorridorGeometry> corridorGeometries;
    private final CorridorIndexes corridorIndexes;
    private final Map<Long, List<Long>> corridorIdsByCluster;
    private final Map<Point2i, List<Long>> clusterIdsByVertex;
    private DungeonLayoutRenderData(
            DungeonLayout layout,
            CorridorTopology corridorTopology,
            Map<Long, CorridorGeometry> corridorGeometries,
            CorridorIndexes corridorIndexes,
            Map<Long, List<Long>> corridorIdsByCluster,
            Map<Point2i, List<Long>> clusterIdsByVertex
    ) {
        this.layout = layout;
        this.corridorTopology = corridorTopology;
        this.corridorGeometries = corridorGeometries;
        this.corridorIndexes = corridorIndexes;
        this.corridorIdsByCluster = corridorIdsByCluster;
        this.clusterIdsByVertex = clusterIdsByVertex;
    }

    public static DungeonLayoutRenderData from(DungeonLayout layout, CorridorTopology corridorTopology) {
        Map<Long, CorridorGeometry> corridorGeometries = corridorTopology.corridorGeometries();
        List<CorridorGeometry> orderedGeometries = layout == null
                ? List.copyOf(corridorGeometries.values())
                : layout.corridors().stream()
                        .map(corridor -> corridorGeometries.get(corridor.corridorId()))
                        .filter(geometry -> geometry != null)
                        .toList();
        CorridorIndexes corridorIndexes = buildCorridorIndexes(orderedGeometries);
        Map<Long, List<Long>> corridorIdsByCluster = indexCorridorIdsByCluster(layout);
        Map<Point2i, List<Long>> clusterIdsByVertex = indexClusterIdsByVertex(layout);
        return new DungeonLayoutRenderData(
                layout,
                corridorTopology,
                Map.copyOf(corridorGeometries),
                corridorIndexes,
                immutableListMap(corridorIdsByCluster),
                immutableListMap(clusterIdsByVertex));
    }

    record CorridorIndexes(
            Set<Point2i> corridorCells,
            Map<Point2i, List<Long>> corridorIdsByCell,
            Map<CorridorRenderKeys.CorridorDoorMarkerKey, List<Long>> corridorIdsByDoor,
            Map<CorridorRenderKeys.CorridorSegmentKey, List<Long>> corridorIdsBySegment
    ) {
        CorridorIndexes {
            corridorCells = Set.copyOf(corridorCells);
            corridorIdsByCell = immutableListMap(corridorIdsByCell);
            corridorIdsByDoor = immutableListMap(corridorIdsByDoor);
            corridorIdsBySegment = immutableListMap(corridorIdsBySegment);
        }
    }

    private static CorridorIndexes buildCorridorIndexes(List<CorridorGeometry> orderedGeometries) {
        Set<Point2i> corridorCells = new LinkedHashSet<>();
        Map<Point2i, List<Long>> corridorIdsByCell = new HashMap<>();
        Map<CorridorRenderKeys.CorridorDoorMarkerKey, List<Long>> corridorIdsByDoor = new HashMap<>();
        Map<CorridorRenderKeys.CorridorSegmentKey, List<Long>> corridorIdsBySegment = new HashMap<>();
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
        return new CorridorIndexes(corridorCells, corridorIdsByCell, corridorIdsByDoor, corridorIdsBySegment);
    }

    public DungeonLayout layout() {
        return layout;
    }

    public List<Point2i> corridorPath(Long corridorId) {
        CorridorGeometry geometry = corridorGeometry(corridorId);
        if (geometry == null || geometry.segments().isEmpty()) {
            return List.of();
        }
        List<Point2i> points = new ArrayList<>();
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
        return corridorIndexes.corridorCells();
    }

    public List<Long> corridorIdsAtCell(Point2i cell) {
        return cell == null ? List.of() : corridorIndexes.corridorIdsByCell().getOrDefault(cell, List.of());
    }

    public List<Long> corridorIdsForDoorFromRoom(DoorSegment door) {
        return door == null ? List.of() : corridorIndexes.corridorIdsByDoor().getOrDefault(CorridorRenderKeys.doorMarkerKey(door), List.of());
    }

    public Map<CorridorRenderKeys.CorridorDoorMarkerKey, List<Long>> corridorIdsByDoorMarker() {
        return corridorIndexes.corridorIdsByDoor();
    }

    public Map<CorridorRenderKeys.CorridorSegmentKey, List<Long>> corridorIdsBySegment() {
        return corridorIndexes.corridorIdsBySegment();
    }

    public DungeonRoom roomAtCell(Point2i cell) {
        return layout == null ? null : layout.roomAtCell(cell);
    }

    public DungeonRoomCluster clusterAtCell(Point2i cell) {
        return layout == null ? null : layout.clusterAtCell(cell);
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

    private static Map<Long, List<Long>> indexCorridorIdsByCluster(DungeonLayout layout) {
        if (layout == null) {
            return Map.of();
        }
        Map<Long, List<Long>> result = new HashMap<>();
        Map<Long, LinkedHashSet<Long>> mutable = new HashMap<>();
        for (DungeonCorridor corridor : layout.corridors()) {
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
            for (Point2i cell : layout.clusterCells(cluster.clusterId())) {
                for (Point2i vertex : cellVertices(cell)) {
                    mutable.computeIfAbsent(vertex, ignored -> new LinkedHashSet<>()).add(cluster.clusterId());
                }
            }
        }
        Map<Point2i, List<Long>> result = new HashMap<>();
        for (Map.Entry<Point2i, LinkedHashSet<Long>> entry : mutable.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static List<Point2i> cellVertices(Point2i cell) {
        return List.of(
            new Point2i(cell.x(), cell.y()),
            new Point2i(cell.x() + 1, cell.y()),
            new Point2i(cell.x(), cell.y() + 1),
            new Point2i(cell.x() + 1, cell.y() + 1)
        );
    }
}
