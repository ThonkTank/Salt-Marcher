package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.model.CorridorComponent;
import features.world.dungeonmap.model.CorridorGeometry;
import features.world.dungeonmap.model.CorridorTopology;
import features.world.dungeonmap.model.DungeonCorridorGeometry;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.DoorSegment;
import features.world.dungeonmap.model.GridSegment;
import features.world.dungeonmap.model.Point2i;

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
    private final Set<Point2i> corridorCells;
    private final Map<Point2i, List<Long>> corridorIdsByCell;
    private final Map<DoorKey, List<Long>> corridorIdsByDoor;
    private final Map<Point2i, DungeonRoom> roomsByCell;
    private final Map<Point2i, DungeonRoomCluster> clustersByCell;

    private DungeonLayoutRenderData(
            DungeonLayout layout,
            CorridorTopology corridorTopology,
            Map<Long, CorridorGeometry> corridorGeometries,
            Set<Point2i> corridorCells,
            Map<Point2i, List<Long>> corridorIdsByCell,
            Map<DoorKey, List<Long>> corridorIdsByDoor,
            Map<Point2i, DungeonRoom> roomsByCell,
            Map<Point2i, DungeonRoomCluster> clustersByCell
    ) {
        this.layout = layout;
        this.corridorTopology = corridorTopology;
        this.corridorGeometries = corridorGeometries;
        this.corridorCells = corridorCells;
        this.corridorIdsByCell = corridorIdsByCell;
        this.corridorIdsByDoor = corridorIdsByDoor;
        this.roomsByCell = roomsByCell;
        this.clustersByCell = clustersByCell;
    }

    public static DungeonLayoutRenderData from(DungeonLayout layout) {
        CorridorTopology corridorTopology = layout == null
                ? new CorridorTopology(Map.of(), Map.of(), Map.of())
                : DungeonCorridorGeometry.corridorTopology(layout);
        Map<Long, CorridorGeometry> corridorGeometries = corridorTopology.corridorGeometries();
        Set<Point2i> corridorCells = new LinkedHashSet<>();
        Map<Point2i, List<Long>> corridorIdsByCell = new HashMap<>();
        Map<DoorKey, List<Long>> corridorIdsByDoor = new HashMap<>();
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
                corridorIdsByDoor.computeIfAbsent(DoorKey.of(door), ignored -> new ArrayList<>()).add(geometry.corridorId());
            }
        }
        Map<Point2i, DungeonRoom> roomsByCell = new HashMap<>();
        Map<Point2i, DungeonRoomCluster> clustersByCell = new HashMap<>();
        if (layout != null) {
            for (DungeonRoom room : layout.rooms()) {
                for (Point2i cell : layout.roomCells(room.roomId())) {
                    roomsByCell.put(cell, room);
                }
            }
            for (DungeonRoomCluster cluster : layout.clusters()) {
                for (Point2i cell : layout.clusterCells(cluster.clusterId())) {
                    clustersByCell.put(cell, cluster);
                }
            }
        }
        return new DungeonLayoutRenderData(
                layout,
                corridorTopology,
                Map.copyOf(corridorGeometries),
                Set.copyOf(corridorCells),
                immutableListMap(corridorIdsByCell),
                immutableListMap(corridorIdsByDoor),
                Map.copyOf(roomsByCell),
                Map.copyOf(clustersByCell));
    }

    public DungeonLayout layout() {
        return layout;
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
        return door == null ? List.of() : corridorIdsByDoor.getOrDefault(DoorKey.of(door), List.of());
    }

    public DungeonRoom roomAtCell(Point2i cell) {
        return cell == null ? null : roomsByCell.get(cell);
    }

    public DungeonRoomCluster clusterAtCell(Point2i cell) {
        return cell == null ? null : clustersByCell.get(cell);
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

    private record DoorKey(Point2i start, Point2i end, long roomId) {
        private static DoorKey of(DoorSegment door) {
            Point2i left = door.start();
            Point2i right = door.end();
            if (compare(left, right) <= 0) {
                return new DoorKey(left, right, door.roomId());
            }
            return new DoorKey(right, left, door.roomId());
        }

        private static int compare(Point2i left, Point2i right) {
            int byX = Integer.compare(left.x(), right.x());
            if (byX != 0) {
                return byX;
            }
            return Integer.compare(left.y(), right.y());
        }
    }
}
