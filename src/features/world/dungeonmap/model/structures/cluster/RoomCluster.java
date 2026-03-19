package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexPath;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.TileShape;
import features.world.dungeonmap.model.objects.Wall;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class RoomCluster {

    private static final List<Point2i> CARDINAL_STEPS = List.of(
            new Point2i(0, -1),
            new Point2i(1, 0),
            new Point2i(0, 1),
            new Point2i(-1, 0));

    private final Long clusterId;
    private final long mapId;
    private final TileShape geometry;
    private final List<Wall> walls;
    private final List<Door> doors;
    private final List<Room> rooms;
    private final Set<Point2i> cells;
    private final Map<Long, Room> roomsById;
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
        TileShape resolvedGeometry = geometry == null ? TileShape.singleCell(null) : geometry;
        List<Wall> resolvedWalls = walls == null ? List.of() : List.copyOf(walls);
        List<Door> resolvedDoors = doors == null ? List.of() : List.copyOf(doors);
        Set<Point2i> resolvedCells = resolvedGeometry.absoluteCells();
        List<VertexPath> resolvedBarriers = barriers(resolvedWalls, resolvedDoors);
        List<Room> hydratedRooms = hydrateRooms(clusterId, resolvedCells, resolvedBarriers, rooms);

        this.clusterId = clusterId;
        this.mapId = mapId;
        this.geometry = resolvedGeometry;
        this.walls = resolvedWalls;
        this.doors = resolvedDoors;
        this.rooms = hydratedRooms;
        this.cells = resolvedCells;
        this.roomsById = indexRoomsById(hydratedRooms);
        this.roomsByCell = indexRoomsByCell(hydratedRooms);
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

    public TileShape roomGeometry(Long roomId) {
        Room room = roomId == null ? null : roomsById.get(roomId);
        return room == null ? null : room.geometry();
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

    private static List<VertexPath> barriers(List<Wall> walls, List<Door> doors) {
        List<VertexPath> result = new ArrayList<>(walls.size() + doors.size());
        result.addAll(walls);
        result.addAll(doors);
        return List.copyOf(result);
    }

    private static List<Room> hydrateRooms(
            Long clusterId,
            Set<Point2i> clusterCells,
            List<VertexPath> barriers,
            List<Room> rooms
    ) {
        if (rooms == null || rooms.isEmpty()) {
            return List.of();
        }
        Set<Point2i> unclaimedCells = new LinkedHashSet<>(clusterCells);
        List<Room> hydratedRooms = new ArrayList<>();
        for (Room room : rooms) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            Point2i startAnchor = room.geometry().anchor();
            if (!clusterCells.contains(startAnchor)) {
                throw new IllegalStateException(
                        "Raum " + room.roomId() + " hat einen Anker ausserhalb von Cluster " + clusterId);
            }
            if (!unclaimedCells.contains(startAnchor)) {
                throw new IllegalStateException(
                        "Raum " + room.roomId() + " teilt sich einen offenen Bereich in Cluster " + clusterId);
            }
            Set<Point2i> roomCells = reachableCells(startAnchor, unclaimedCells, barriers);
            if (roomCells.isEmpty()) {
                throw new IllegalStateException(
                        "Raum " + room.roomId() + " konnte in Cluster " + clusterId + " nicht hydriert werden");
            }
            unclaimedCells.removeAll(roomCells);
            hydratedRooms.add(room.withGeometry(TileShape.fromAbsoluteCells(roomCells)));
        }
        if (!unclaimedCells.isEmpty()) {
            throw new IllegalStateException(
                    "Cluster " + clusterId + " enthaelt Zellen ohne Raumankerzuordnung");
        }
        return List.copyOf(hydratedRooms);
    }

    private static Set<Point2i> reachableCells(
            Point2i startAnchor,
            Set<Point2i> traversableCells,
            List<VertexPath> barriers
    ) {
        Set<Point2i> visited = new LinkedHashSet<>();
        Set<Point2i> frontier = new LinkedHashSet<>(traversableCells);
        ArrayDeque<Point2i> queue = new ArrayDeque<>();
        queue.add(startAnchor);
        frontier.remove(startAnchor);
        while (!queue.isEmpty()) {
            Point2i current = queue.removeFirst();
            visited.add(current);
            for (Point2i step : CARDINAL_STEPS) {
                Point2i neighbor = current.add(step);
                if (!frontier.contains(neighbor) || isBlocked(barriers, current, step)) {
                    continue;
                }
                frontier.remove(neighbor);
                queue.addLast(neighbor);
            }
        }
        return Set.copyOf(visited);
    }

    private static boolean isBlocked(List<VertexPath> barriers, Point2i cell, Point2i step) {
        for (VertexPath barrier : barriers) {
            if (barrier != null && barrier.blocks(cell, step)) {
                return true;
            }
        }
        return false;
    }

    private static Map<Long, Room> indexRoomsById(List<Room> rooms) {
        Map<Long, Room> result = new LinkedHashMap<>();
        for (Room room : rooms) {
            result.put(room.roomId(), room);
        }
        return Map.copyOf(result);
    }

    private static Map<Point2i, Room> indexRoomsByCell(List<Room> rooms) {
        Map<Point2i, Room> result = new LinkedHashMap<>();
        for (Room room : rooms) {
            for (Point2i cell : room.geometry().absoluteCells()) {
                result.put(cell, room);
            }
        }
        return Map.copyOf(result);
    }
}
