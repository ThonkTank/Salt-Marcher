package features.world.dungeonmap.model.structures.room;

import features.world.dungeonmap.model.geometry.BoundaryNetwork;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.BoundaryObject;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.objects.Wall;

import java.util.Collection;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public record Room(
        Long roomId,
        long mapId,
        long clusterId,
        String name,
        Floor floor,
        List<Wall> walls,
        List<Door> doors,
        RoomNarration narration
) {
    public static Room create(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            Floor floor
    ) {
        return create(roomId, mapId, clusterId, name, floor, RoomNarration.empty());
    }

    public static Room create(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            Floor floor,
            RoomNarration narration
    ) {
        return resolved(roomId, mapId, clusterId, name, floor, List.of(), List.of(), narration);
    }

    public static Room resolved(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            Floor floor,
            Collection<Wall> walls,
            Collection<Door> doors
    ) {
        return resolved(roomId, mapId, clusterId, name, floor, walls, doors, RoomNarration.empty());
    }

    public static Room resolved(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            Floor floor,
            Collection<Wall> walls,
            Collection<Door> doors,
            RoomNarration narration
    ) {
        Floor resolvedFloor = floor == null ? new Floor(null) : floor;
        Set<VertexEdge> perimeterEdges = resolvedFloor.shape().boundaryEdges();
        List<Door> resolvedDoors = normalizedDoors(doors, perimeterEdges);
        Set<VertexEdge> doorEdges = boundaryEdges(resolvedDoors, perimeterEdges);
        List<Wall> resolvedWalls = normalizedWalls(walls, perimeterEdges);
        Set<VertexEdge> wallEdges = boundaryEdges(resolvedWalls, perimeterEdges);
        for (VertexEdge perimeterEdge : perimeterEdges) {
            if (!doorEdges.contains(perimeterEdge)) {
                wallEdges.add(perimeterEdge);
            }
        }
        wallEdges.removeAll(doorEdges);
        Set<VertexEdge> existingWallEdges = boundaryEdges(resolvedWalls, perimeterEdges);
        Set<VertexEdge> missingWallEdges = new LinkedHashSet<>(wallEdges);
        missingWallEdges.removeAll(existingWallEdges);
        List<Wall> canonicalWalls = new java.util.ArrayList<>(resolvedWalls);
        if (!missingWallEdges.isEmpty()) {
            canonicalWalls.add(new Wall(missingWallEdges));
        }
        return new Room(
                roomId,
                mapId,
                clusterId,
                name,
                resolvedFloor,
                canonicalWalls,
                resolvedDoors,
                narration);
    }

    public Room {
        // A room is the smallest self-managed structure: one floor object plus boundary objects.
        floor = floor == null ? new Floor(null) : floor;
        walls = walls == null ? List.of() : List.copyOf(walls);
        doors = doors == null ? List.of() : List.copyOf(doors);
        narration = narration == null ? RoomNarration.empty() : narration;
    }

    public Room withFloor(Floor floor) {
        return resolved(roomId, mapId, clusterId, name, floor, walls, doors, narration);
    }

    public Room withBoundaries(List<Wall> walls, List<Door> doors) {
        return resolved(roomId, mapId, clusterId, name, floor, walls, doors, narration);
    }

    public Room withResolvedState(Floor floor, List<Wall> walls, List<Door> doors) {
        return resolved(roomId, mapId, clusterId, name, floor, walls, doors, narration);
    }

    public Room withNarration(RoomNarration narration) {
        return resolved(roomId, mapId, clusterId, name, floor, walls, doors, narration);
    }

    public Room withAdditionalDoors(Collection<Door> additionalDoors) {
        if (additionalDoors == null || additionalDoors.isEmpty()) {
            return this;
        }
        List<Door> combinedDoors = new ArrayList<>(doors);
        boolean changed = false;
        for (Door additionalDoor : additionalDoors) {
            if (additionalDoor == null || additionalDoor.edges().isEmpty()) {
                continue;
            }
            combinedDoors.add(additionalDoor);
            changed = true;
        }
        return changed ? resolved(roomId, mapId, clusterId, name, floor, walls, combinedDoors, narration) : this;
    }

    public Floor floor() {
        return floor;
    }

    public List<BoundaryObject> boundaryObjects() {
        List<BoundaryObject> result = new java.util.ArrayList<>(walls.size() + doors.size());
        result.addAll(walls);
        result.addAll(doors);
        return List.copyOf(result);
    }

    public BoundaryNetwork boundaryNetwork() {
        return BoundaryNetwork.fromPaths(boundaryObjects().stream()
                .map(BoundaryObject::path)
                .toList());
    }

    public Set<VertexEdge> boundaryEdges() {
        return boundaryNetwork().edges();
    }

    public boolean hasBoundaryEdge(VertexEdge edge) {
        return edge != null && boundaryEdges().contains(edge);
    }

    public Set<Point2i> cells() {
        return floor.shape().absoluteCells();
    }

    public boolean contains(Point2i cell) {
        return cell != null && floor.shape().contains(cell);
    }

    public Room movedBy(Point2i delta) {
        if (delta == null || (delta.x() == 0 && delta.y() == 0)) {
            return this;
        }
        return new Room(
                roomId,
                mapId,
                clusterId,
                name,
                floor.movedBy(delta),
                walls.stream().map(wall -> wall.movedBy(delta)).toList(),
                doors.stream().map(door -> door.movedBy(delta)).toList(),
                narration);
    }

    public boolean blocks(Point2i fromCell, Point2i stepDelta) {
        // Room traversal combines geometry from VertexPath with object semantics from Wall/Door.
        for (BoundaryObject boundary : boundaryObjects()) {
            if (boundary.blocksTraversal() && boundary.path().crosses(fromCell, stepDelta)) {
                return true;
            }
        }
        return false;
    }

    public List<Wall> wallsTouching(Point2i cell) {
        if (cell == null) {
            return List.of();
        }
        return walls.stream()
                .filter(wall -> wall.touchesCell(cell))
                .toList();
    }

    public List<Door> doorsTouching(Point2i cell) {
        if (cell == null) {
            return List.of();
        }
        return doors.stream()
                .filter(door -> door.touchesCell(cell))
                .toList();
    }

    public List<BoundaryObject> boundaryObjectsTouching(Point2i cell) {
        if (cell == null) {
            return List.of();
        }
        return boundaryObjects().stream()
                .filter(boundary -> boundary.path().touchesCell(cell))
                .toList();
    }

    private static Set<VertexEdge> boundaryEdges(Collection<? extends BoundaryObject> boundaries, Set<VertexEdge> allowedEdges) {
        Set<VertexEdge> result = new LinkedHashSet<>();
        if (boundaries == null || allowedEdges == null || allowedEdges.isEmpty()) {
            return result;
        }
        for (BoundaryObject boundary : boundaries) {
            if (boundary == null) {
                continue;
            }
            for (VertexEdge edge : boundary.path().edges()) {
                if (allowedEdges.contains(edge)) {
                    result.add(edge);
                }
            }
        }
        return result;
    }

    private static List<Wall> normalizedWalls(Collection<Wall> walls, Set<VertexEdge> allowedEdges) {
        List<Wall> result = new java.util.ArrayList<>();
        if (walls == null || allowedEdges == null || allowedEdges.isEmpty()) {
            return result;
        }
        for (Wall wall : walls) {
            if (wall == null) {
                continue;
            }
            Set<VertexEdge> edges = new LinkedHashSet<>();
            for (VertexEdge edge : wall.edges()) {
                if (allowedEdges.contains(edge)) {
                    edges.add(edge);
                }
            }
            if (!edges.isEmpty()) {
                result.add(new Wall(edges));
            }
        }
        return List.copyOf(result);
    }

    private static List<Door> normalizedDoors(Collection<Door> doors, Set<VertexEdge> allowedEdges) {
        List<Door> result = new java.util.ArrayList<>();
        if (doors == null || allowedEdges == null || allowedEdges.isEmpty()) {
            return result;
        }
        for (Door door : doors) {
            if (door == null) {
                continue;
            }
            Set<VertexEdge> edges = new LinkedHashSet<>();
            for (VertexEdge edge : door.edges()) {
                if (allowedEdges.contains(edge)) {
                    edges.add(edge);
                }
            }
            if (!edges.isEmpty()) {
                result.add(new Door(edges, door.traversalState()));
            }
        }
        return List.copyOf(result);
    }
}
