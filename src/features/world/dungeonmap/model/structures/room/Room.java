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
        Set<VertexEdge> doorEdges,
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
        return resolved(roomId, mapId, clusterId, name, floor, List.of(), Set.of(), narration);
    }

    public static Room resolved(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            Floor floor,
            Collection<Wall> walls,
            Collection<VertexEdge> doorEdges
    ) {
        return resolved(roomId, mapId, clusterId, name, floor, walls, doorEdges, RoomNarration.empty());
    }

    public static Room resolved(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            Floor floor,
            Collection<Wall> walls,
            Collection<VertexEdge> doorEdges,
            RoomNarration narration
    ) {
        Floor resolvedFloor = floor == null ? new Floor(null) : floor;
        Set<VertexEdge> perimeterEdges = resolvedFloor.shape().boundaryEdges();
        Set<VertexEdge> resolvedDoorEdges = normalizedDoorEdges(doorEdges, perimeterEdges);
        List<Wall> resolvedWalls = normalizedWalls(walls, perimeterEdges);
        Set<VertexEdge> wallEdges = boundaryEdges(resolvedWalls, perimeterEdges);
        for (VertexEdge perimeterEdge : perimeterEdges) {
            if (!resolvedDoorEdges.contains(perimeterEdge)) {
                wallEdges.add(perimeterEdge);
            }
        }
        wallEdges.removeAll(resolvedDoorEdges);
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
                resolvedDoorEdges,
                narration);
    }

    public Room {
        floor = floor == null ? new Floor(null) : floor;
        walls = walls == null ? List.of() : List.copyOf(walls);
        doorEdges = doorEdges == null ? Set.of() : Set.copyOf(doorEdges);
        narration = narration == null ? RoomNarration.empty() : narration;
    }

    public Room withFloor(Floor floor) {
        return resolved(roomId, mapId, clusterId, name, floor, walls, doorEdges, narration);
    }

    public Room withBoundaries(List<Wall> walls, Set<VertexEdge> doorEdges) {
        return resolved(roomId, mapId, clusterId, name, floor, walls, doorEdges, narration);
    }

    public Room withResolvedState(Floor floor, List<Wall> walls, Set<VertexEdge> doorEdges) {
        return resolved(roomId, mapId, clusterId, name, floor, walls, doorEdges, narration);
    }

    public Room withNarration(RoomNarration narration) {
        return resolved(roomId, mapId, clusterId, name, floor, walls, doorEdges, narration);
    }

    public Room withAdditionalDoorEdges(Collection<VertexEdge> additionalDoorEdges) {
        if (additionalDoorEdges == null || additionalDoorEdges.isEmpty()) {
            return this;
        }
        Set<VertexEdge> combinedDoorEdges = new LinkedHashSet<>(doorEdges);
        for (VertexEdge edge : additionalDoorEdges) {
            if (edge != null) {
                combinedDoorEdges.add(edge);
            }
        }
        return combinedDoorEdges.equals(doorEdges)
                ? this
                : resolved(roomId, mapId, clusterId, name, floor, walls, combinedDoorEdges, narration);
    }

    public BoundaryNetwork boundaryNetwork() {
        return BoundaryNetwork.fromPaths(boundaryPaths());
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
        Set<VertexEdge> translatedDoorEdges = doorEdges.stream()
                .map(edge -> edge.translated(delta))
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        return new Room(
                roomId,
                mapId,
                clusterId,
                name,
                floor.movedBy(delta),
                walls.stream().map(wall -> wall.movedBy(delta)).toList(),
                translatedDoorEdges,
                narration);
    }

    private List<features.world.dungeonmap.model.geometry.VertexPath> boundaryPaths() {
        List<features.world.dungeonmap.model.geometry.VertexPath> result = new java.util.ArrayList<>(walls);
        if (!doorEdges.isEmpty()) {
            result.add(new features.world.dungeonmap.model.geometry.VertexPath(doorEdges) {
                @Override
                protected features.world.dungeonmap.model.geometry.VertexPath recreate(Collection<VertexEdge> edges) {
                    return this;
                }
            });
        }
        return List.copyOf(result);
    }

    private static Set<VertexEdge> boundaryEdges(Collection<Wall> walls, Set<VertexEdge> allowedEdges) {
        Set<VertexEdge> result = new LinkedHashSet<>();
        if (walls == null || allowedEdges == null || allowedEdges.isEmpty()) {
            return result;
        }
        for (Wall wall : walls) {
            if (wall == null) {
                continue;
            }
            for (VertexEdge edge : wall.edges()) {
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

    private static Set<VertexEdge> normalizedDoorEdges(Collection<VertexEdge> doorEdges, Set<VertexEdge> allowedEdges) {
        Set<VertexEdge> result = new LinkedHashSet<>();
        if (doorEdges == null || allowedEdges == null || allowedEdges.isEmpty()) {
            return result;
        }
        for (VertexEdge edge : doorEdges) {
            if (edge != null && allowedEdges.contains(edge)) {
                result.add(edge);
            }
        }
        return Set.copyOf(result);
    }
}
