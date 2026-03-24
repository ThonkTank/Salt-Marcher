package features.world.dungeonmap.model.structures.room;

import features.world.dungeonmap.model.geometry.BoundaryNetwork;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.objects.Wall;

import java.util.Collection;
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
        Floor resolvedFloor = floor == null ? new Floor(null) : floor;
        return resolved(
                roomId,
                mapId,
                clusterId,
                name,
                resolvedFloor,
                List.of(new Wall(resolvedFloor.shape().boundaryEdges())),
                narration);
    }

    public static Room resolved(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            Floor floor,
            Collection<Wall> walls
    ) {
        return resolved(roomId, mapId, clusterId, name, floor, walls, RoomNarration.empty());
    }

    public static Room resolved(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            Floor floor,
            Collection<Wall> walls,
            RoomNarration narration
    ) {
        Floor resolvedFloor = floor == null ? new Floor(null) : floor;
        List<Wall> canonicalWalls = normalizedWalls(walls, resolvedFloor.shape().boundaryEdges());
        return new Room(
                roomId,
                mapId,
                clusterId,
                name,
                resolvedFloor,
                canonicalWalls,
                narration);
    }

    public Room {
        floor = floor == null ? new Floor(null) : floor;
        walls = walls == null ? List.of() : List.copyOf(walls);
        narration = narration == null ? RoomNarration.empty() : narration;
    }

    public Room withFloor(Floor floor) {
        return resolved(roomId, mapId, clusterId, name, floor, walls, narration);
    }

    public Room withBoundaries(List<Wall> walls) {
        return resolved(roomId, mapId, clusterId, name, floor, walls, narration);
    }

    public Room withNarration(RoomNarration narration) {
        return resolved(roomId, mapId, clusterId, name, floor, walls, narration);
    }

    public BoundaryNetwork boundaryNetwork() {
        return BoundaryNetwork.fromPaths(walls);
    }

    public Set<VertexEdge> boundaryEdges() {
        return boundaryNetwork().edges();
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
                narration);
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
}
