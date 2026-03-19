package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.Tile;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.TileShape;
import features.world.dungeonmap.model.objects.Wall;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

public final class RoomCluster {

    private final Long clusterId;
    private final long mapId;
    private final TileShape geometry;
    private final List<Wall> walls;
    private final List<Door> doors;
    private final List<Room> rooms;
    private final Set<Point2i> cells;
    private final Map<Long, TileShape> roomGeometryById;
    private final Map<Point2i, Room> roomsByCell;

    public RoomCluster(
            Long clusterId,
            long mapId,
            TileShape geometry,
            List<Wall> walls,
            List<Door> doors
    ) {
        this(clusterId, mapId, geometry, walls, doors, List.of());
    }

    private RoomCluster(
            Long clusterId,
            long mapId,
            TileShape geometry,
            List<Wall> walls,
            List<Door> doors,
            List<Room> rooms
    ) {
        this.clusterId = clusterId;
        this.mapId = mapId;
        this.geometry = geometry == null ? TileShape.singleCell(null) : geometry;
        this.walls = walls == null ? List.of() : List.copyOf(walls);
        this.doors = doors == null ? List.of() : List.copyOf(doors);
        this.rooms = rooms == null ? List.of() : List.copyOf(rooms);
        this.cells = this.geometry.absoluteCells();
        this.roomGeometryById = deriveRoomGeometryById();
        this.roomsByCell = indexRoomsByCell();
    }

    public RoomCluster withRooms(List<Room> rooms) {
        return new RoomCluster(clusterId, mapId, geometry, walls, doors, rooms);
    }

    public Long clusterId() {
        return clusterId;
    }

    public long mapId() {
        return mapId;
    }

    public TileShape geometry() {
        return geometry;
    }

    public List<Wall> walls() {
        return walls;
    }

    public List<Door> doors() {
        return doors;
    }

    public List<Room> rooms() {
        return rooms;
    }

    public Set<Point2i> cells() {
        return cells;
    }

    public List<List<Point2i>> loops() {
        return List.of();
    }

    public TileShape roomGeometry(Long roomId) {
        return roomId == null ? null : roomGeometryById.get(roomId);
    }

    public Set<Point2i> roomCells(Long roomId) {
        TileShape shape = roomGeometry(roomId);
        return shape == null ? Set.of() : shape.absoluteCells();
    }

    public Room roomAt(Point2i cell) {
        return cell == null ? null : roomsByCell.get(cell);
    }

    public boolean contains(Point2i cell) {
        return cell != null && cells.contains(cell);
    }

    private Map<Long, TileShape> deriveRoomGeometryById() {
        List<Set<Point2i>> components = clusterComponents();
        List<TileShape> componentGeometry = components.stream().map(RoomCluster::shapeForCells).toList();
        Map<Long, TileShape> result = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            TileShape shape = componentGeometry.stream()
                    .filter(component -> component.absoluteCells().contains(room.geometry().anchor()))
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException(
                            "Raum " + room.roomId() + " hat keinen gueltigen Komponentenanker in Cluster " + clusterId));
            result.put(room.roomId(), shape);
        }
        return Map.copyOf(result);
    }

    private Map<Point2i, Room> indexRoomsByCell() {
        Map<Point2i, Room> result = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            TileShape shape = roomGeometryById.get(room.roomId());
            if (shape == null) {
                continue;
            }
            for (Point2i cell : shape.absoluteCells()) {
                result.put(cell, room);
            }
        }
        return Map.copyOf(result);
    }

    private List<Set<Point2i>> clusterComponents() {
        Set<EdgeBlock> blockedEdges = new LinkedHashSet<>();
        for (Wall wall : walls) {
            blockedEdges.add(new EdgeBlock(wall.roomCell(), wall.delta()));
        }
        for (Door door : doors) {
            blockedEdges.add(new EdgeBlock(door.roomCell(), door.delta()));
        }

        Set<Point2i> unvisited = new LinkedHashSet<>(cells);
        List<Set<Point2i>> components = new ArrayList<>();
        while (!unvisited.isEmpty()) {
            Point2i seed = unvisited.iterator().next();
            Set<Point2i> component = new LinkedHashSet<>();
            ArrayDeque<Point2i> queue = new ArrayDeque<>();
            queue.add(seed);
            unvisited.remove(seed);
            while (!queue.isEmpty()) {
                Point2i current = queue.removeFirst();
                component.add(current);
                for (Point2i delta : List.of(
                        new Point2i(0, -1), new Point2i(1, 0), new Point2i(0, 1), new Point2i(-1, 0))) {
                    Point2i neighbor = current.add(delta);
                    if (!cells.contains(neighbor) || !unvisited.contains(neighbor)) {
                        continue;
                    }
                    if (blockedEdges.contains(new EdgeBlock(current, delta))) {
                        continue;
                    }
                    unvisited.remove(neighbor);
                    queue.addLast(neighbor);
                }
            }
            components.add(component);
        }
        components.sort(Comparator.<Set<Point2i>>comparingInt(Set::size).reversed());
        return List.copyOf(components);
    }

    private static TileShape shapeForCells(Collection<Point2i> cells) {
        Set<Point2i> normalizedCells = Set.copyOf(cells);
        Point2i anchor = centerForCells(normalizedCells);
        Set<Tile> relativeTiles = normalizedCells.stream()
                .map(cell -> new Tile(cell.subtract(anchor)))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        return new TileShape(anchor, relativeTiles);
    }

    private static Point2i centerForCells(Set<Point2i> cells) {
        int sumX = 0;
        int sumY = 0;
        for (Point2i cell : cells) {
            sumX += cell.x();
            sumY += cell.y();
        }
        return new Point2i(Math.round((float) sumX / cells.size()), Math.round((float) sumY / cells.size()));
    }

    private record EdgeBlock(Point2i cell, Point2i delta) {
    }
}
