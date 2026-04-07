package features.world.dungeonmap.structure.model.boundary;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.structure.model.boundary.door.Door;
import features.world.dungeonmap.structure.model.boundary.wall.Wall;
import features.world.dungeonmap.structure.model.boundary.wall.WallKind;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Canonical level-local owner for wall and door capabilities attached to one structure surface.
 */
public final class StructureBoundary {

    public record PersistenceSnapshot(
            List<Door> doors,
            List<Wall> authoredWalls
    ) {
        public PersistenceSnapshot {
            doors = doors == null ? List.of() : List.copyOf(doors);
            authoredWalls = authoredWalls == null ? List.of() : List.copyOf(authoredWalls);
        }
    }

    private final Set<CellCoord> surfaceCells;
    private final EdgeShape edgeShape;
    private final List<Door> doors;
    private final List<Wall> walls;

    public static StructureBoundary empty() {
        return new StructureBoundary(Set.of(), EdgeShape.empty(), List.of(), List.of());
    }

    public static PersistenceSnapshot emptySnapshot() {
        return new PersistenceSnapshot(List.of(), List.of());
    }

    public static StructureBoundary fromSurfaceAndFeatures(
            Collection<CellCoord> surfaceCells,
            Collection<Door> doors,
            Collection<Wall> walls
    ) {
        TileShape surfaceShape = TileShape.of(surfaceCells);
        if (surfaceShape.isEmpty()) {
            return empty();
        }
        Set<CellCoord> normalizedSurfaceCells = surfaceShape.cellCoords();
        EdgeShape allowedWallShape = EdgeShape.fromBoundarySegments(interiorAdjacencyEdgesForSurface(normalizedSurfaceCells));
        List<Wall> normalizedWalls = normalizeWalls(allowedWallShape, walls);
        EdgeShape edgeShape = EdgeShape.fromBoundarySegments(derivedBoundaryEdgesForSurface(
                normalizedSurfaceCells,
                authoredWallEdges(normalizedWalls)));
        return new StructureBoundary(normalizedSurfaceCells, edgeShape, doors, normalizedWalls);
    }

    public static StructureBoundary fromBoundaryEdges(
            Collection<CellCoord> surfaceCells,
            Collection<GridSegment2x> boundaryEdges,
            Collection<Door> doors,
            Collection<Wall> walls
    ) {
        TileShape surfaceShape = TileShape.of(surfaceCells);
        if (surfaceShape.isEmpty()) {
            return empty();
        }
        Set<CellCoord> normalizedSurfaceCells = surfaceShape.cellCoords();
        Set<GridSegment2x> normalizedBoundaryEdges = normalizedBoundaryEdges(
                derivedBoundaryEdgesForSurface(normalizedSurfaceCells, authoredWallEdges(walls)),
                boundaryEdges);
        EdgeShape edgeShape = normalizedBoundaryEdges.isEmpty()
                ? EdgeShape.fromBoundarySegments(surfaceShape.boundaryShape().segmentSet2x())
                : EdgeShape.fromBoundarySegments(normalizedBoundaryEdges);
        return new StructureBoundary(normalizedSurfaceCells, edgeShape, doors, walls);
    }

    public static StructureBoundary fromPersistenceSnapshot(
            Collection<CellCoord> surfaceCells,
            PersistenceSnapshot snapshot
    ) {
        PersistenceSnapshot resolvedSnapshot = snapshot == null ? emptySnapshot() : snapshot;
        return fromSurfaceAndFeatures(surfaceCells, resolvedSnapshot.doors(), resolvedSnapshot.authoredWalls());
    }

    private StructureBoundary(
            Collection<CellCoord> surfaceCells,
            EdgeShape edgeShape,
            Collection<Door> doors,
            Collection<Wall> walls
    ) {
        this.surfaceCells = surfaceCells == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(surfaceCells));
        this.edgeShape = edgeShape == null ? EdgeShape.empty() : edgeShape;
        this.doors = normalizeDoors(this.edgeShape, doors);
        this.walls = normalizeWalls(this.edgeShape, walls);
    }

    public List<Door> doors() {
        return doors;
    }

    public List<Wall> authoredWalls() {
        return walls;
    }

    public PersistenceSnapshot persistenceSnapshot() {
        return new PersistenceSnapshot(doors, walls);
    }

    public Set<GridSegment2x> boundaryEdges() {
        return edgeShape.segmentSet2x();
    }

    public Door doorAtBoundarySegment(GridSegment2x segment2x) {
        if (segment2x == null || !boundaryEdges().contains(segment2x)) {
            return null;
        }
        for (Door door : doors) {
            if (door != null && door.hasBoundarySegment(segment2x)) {
                return door;
            }
        }
        return null;
    }

    // Non-authored boundary edges still behave like solid walls; resolving them as a Wall keeps callers on the
    // canonical wall owner API instead of mirroring wall truth as booleans or WallKind projections.
    public Wall effectiveWallAtBoundarySegment(GridSegment2x segment2x) {
        if (segment2x == null || !boundaryEdges().contains(segment2x)) {
            return null;
        }
        for (Wall wall : walls) {
            if (wall != null && wall.hasBoundarySegment(segment2x)) {
                return wall;
            }
        }
        return Wall.fromSegments(null, List.of(segment2x), segment2x, WallKind.solid());
    }

    public Set<GridSegment2x> movementBlockingBoundaryEdges() {
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (GridSegment2x segment2x : boundaryEdges().stream().sorted(GridSegment2x.ORDER).toList()) {
            if (doorAtBoundarySegment(segment2x) != null) {
                continue;
            }
            Wall wall = effectiveWallAtBoundarySegment(segment2x);
            if (wall != null && wall.blocksPassage()) {
                result.add(segment2x);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public Set<GridSegment2x> interiorAdjacencyEdges() {
        return interiorAdjacencyEdgesForSurface(surfaceCells);
    }

    public Set<GridSegment2x> creatableWallEdges() {
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>(interiorAdjacencyEdges());
        result.removeAll(authoredWallEdges(walls));
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public Set<GridSegment2x> deletableWallEdges() {
        return authoredWallEdges(walls);
    }

    public boolean isInteriorBoundary(GridSegment2x segment2x) {
        return segment2x != null && touchingSurfaceCellCount(surfaceCells, segment2x) == 2L;
    }

    public boolean isExteriorBoundary(GridSegment2x segment2x) {
        return segment2x != null && touchingSurfaceCellCount(surfaceCells, segment2x) == 1L;
    }

    public Set<GridSegment2x> interiorBoundaryEdges() {
        if (surfaceCells.isEmpty()) {
            return Set.of();
        }
        return boundaryEdges().stream()
                .filter(this::isInteriorBoundary)
                .sorted(GridSegment2x.ORDER)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    public Set<GridSegment2x> exteriorBoundaryEdges() {
        if (surfaceCells.isEmpty()) {
            return Set.of();
        }
        return boundaryEdges().stream()
                .filter(this::isExteriorBoundary)
                .sorted(GridSegment2x.ORDER)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    public boolean touchesBoundaryVertex(GridPoint2x vertex) {
        if (vertex == null) {
            return false;
        }
        return boundaryEdges().stream()
                .anyMatch(segment2x -> segment2x.start().equals(vertex) || segment2x.end().equals(vertex));
    }

    public boolean isEditableWallVertex(GridPoint2x vertex, boolean deleteMode) {
        if (vertex == null) {
            return false;
        }
        Set<GridSegment2x> candidateEdges = deleteMode ? deletableWallEdges() : creatableWallEdges();
        return candidateEdges.stream()
                .anyMatch(segment2x -> segment2x.start().equals(vertex) || segment2x.end().equals(vertex));
    }

    public List<GridSegment2x> findCreatableWallPath(GridPoint2x start, GridPoint2x goal) {
        return shortestEdgePath(start, goal, creatableWallEdges());
    }

    public List<GridSegment2x> findDeletableWallPath(GridPoint2x start, GridPoint2x goal) {
        return shortestEdgePath(start, goal, deletableWallEdges());
    }

    public StructureBoundary withDoors(Collection<Door> doors) {
        return fromBoundaryEdges(surfaceCells, boundaryEdges(), doors, walls);
    }

    public StructureBoundary withCreatedWallPath(Collection<GridSegment2x> segments2x) {
        return fromSurfaceAndFeatures(
                surfaceCells,
                doors,
                createdWalls(walls, normalizedBoundaryEdges(creatableWallEdges(), segments2x)));
    }

    public StructureBoundary withDeletedWallPath(Collection<GridSegment2x> segments2x) {
        return fromSurfaceAndFeatures(
                surfaceCells,
                doors,
                deletedWalls(walls, normalizedBoundaryEdges(authoredWallEdges(walls), segments2x)));
    }

    public StructureBoundary translatedByCells(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new StructureBoundary(
                surfaceCells.stream().map(cell -> cell.add(resolvedDelta)).toList(),
                edgeShape.translatedByCells(resolvedDelta),
                doors.stream()
                        .map(door -> door == null ? null : door.movedBy(resolvedDelta))
                        .filter(Objects::nonNull)
                        .toList(),
                walls.stream()
                        .map(wall -> wall == null ? null : wall.movedBy(resolvedDelta))
                        .filter(Objects::nonNull)
                        .toList());
    }

    public StructureBoundary clippedToSurface(Collection<CellCoord> clippedSurfaceCells) {
        TileShape clippedSurfaceShape = TileShape.of(clippedSurfaceCells);
        if (clippedSurfaceShape.isEmpty()) {
            return empty();
        }
        Set<CellCoord> normalizedSurfaceCells = clippedSurfaceShape.cellCoords();
        Set<GridSegment2x> clippedBoundaryEdges = derivedBoundaryEdgesForSurface(
                normalizedSurfaceCells,
                authoredWallEdges(walls));
        return fromBoundaryEdges(
                normalizedSurfaceCells,
                clippedBoundaryEdges,
                clippedDoorsForBoundary(doors, clippedBoundaryEdges),
                clippedWallsForBoundary(walls, clippedBoundaryEdges));
    }

    public boolean isEmpty() {
        return surfaceCells.isEmpty()
                && edgeShape.isEmpty()
                && doors.isEmpty()
                && walls.isEmpty();
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof StructureBoundary that)) {
            return false;
        }
        return Objects.equals(surfaceCells, that.surfaceCells)
                && Objects.equals(boundaryEdges(), that.boundaryEdges())
                && Objects.equals(doors, that.doors)
                && Objects.equals(walls, that.walls);
    }

    @Override
    public int hashCode() {
        return Objects.hash(surfaceCells, boundaryEdges(), doors, walls);
    }

    @Override
    public String toString() {
        return "StructureBoundary[surfaceCells=" + surfaceCells
                + ", boundaryEdges=" + boundaryEdges()
                + ", doors=" + doors
                + ", walls=" + walls + "]";
    }

    private static Set<GridSegment2x> derivedBoundaryEdgesForSurface(
            Collection<CellCoord> surfaceCells,
            Collection<GridSegment2x> authoredWallEdges
    ) {
        TileShape surfaceShape = TileShape.of(surfaceCells);
        if (surfaceShape.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>(surfaceShape.boundaryShape().segmentSet2x());
        result.addAll(normalizedBoundaryEdges(interiorAdjacencyEdgesForSurface(surfaceShape.cellCoords()), authoredWallEdges));
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static List<GridSegment2x> shortestEdgePath(
            GridPoint2x start,
            GridPoint2x goal,
            Collection<GridSegment2x> traversableEdges
    ) {
        if (start == null || goal == null || traversableEdges == null || traversableEdges.isEmpty()) {
            return List.of();
        }
        if (Objects.equals(start, goal)) {
            return List.of();
        }
        Map<GridPoint2x, Set<GridPoint2x>> adjacency = edgeAdjacency(traversableEdges);
        if (!adjacency.containsKey(start) || !adjacency.containsKey(goal)) {
            return List.of();
        }
        ArrayDeque<GridPoint2x> queue = new ArrayDeque<>();
        Map<GridPoint2x, GridPoint2x> previous = new LinkedHashMap<>();
        queue.add(start);
        previous.put(start, null);
        while (!queue.isEmpty()) {
            GridPoint2x current = queue.removeFirst();
            if (current.equals(goal)) {
                break;
            }
            for (GridPoint2x neighbor : adjacency.getOrDefault(current, Set.of()).stream().sorted(GridPoint2x.ORDER).toList()) {
                if (previous.containsKey(neighbor)) {
                    continue;
                }
                previous.put(neighbor, current);
                queue.addLast(neighbor);
            }
        }
        if (!previous.containsKey(goal)) {
            return List.of();
        }
        ArrayList<GridSegment2x> path = new ArrayList<>();
        GridPoint2x current = goal;
        while (!Objects.equals(current, start)) {
            GridPoint2x parent = previous.get(current);
            if (parent == null) {
                return List.of();
            }
            path.add(new GridSegment2x(parent, current));
            current = parent;
        }
        Collections.reverse(path);
        return List.copyOf(path);
    }

    private static Map<GridPoint2x, Set<GridPoint2x>> edgeAdjacency(Collection<GridSegment2x> edges) {
        Map<GridPoint2x, Set<GridPoint2x>> result = new LinkedHashMap<>();
        for (GridSegment2x edge : edges == null ? List.<GridSegment2x>of() : edges) {
            if (edge == null) {
                continue;
            }
            result.computeIfAbsent(edge.start(), ignored -> new LinkedHashSet<>()).add(edge.end());
            result.computeIfAbsent(edge.end(), ignored -> new LinkedHashSet<>()).add(edge.start());
        }
        Map<GridPoint2x, Set<GridPoint2x>> immutable = new LinkedHashMap<>();
        for (Map.Entry<GridPoint2x, Set<GridPoint2x>> entry : result.entrySet()) {
            immutable.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return immutable.isEmpty() ? Map.of() : Map.copyOf(immutable);
    }

    private static Set<GridSegment2x> normalizedBoundaryEdges(
            Set<GridSegment2x> allowedEdges,
            Collection<GridSegment2x> boundaryEdges
    ) {
        if (allowedEdges == null || allowedEdges.isEmpty() || boundaryEdges == null || boundaryEdges.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        GridSegment2x.boundarySteps(boundaryEdges).stream()
                .sorted(GridSegment2x.ORDER)
                .filter(allowedEdges::contains)
                .forEach(result::add);
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Set<GridSegment2x> interiorAdjacencyEdgesForSurface(Set<CellCoord> surfaceCells) {
        if (surfaceCells == null || surfaceCells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (CellCoord cell : surfaceCells) {
            for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                CellCoord neighbor = cell.add(step);
                if (!surfaceCells.contains(neighbor) || CellCoord.ORDER.compare(cell, neighbor) >= 0) {
                    continue;
                }
                result.add(GridSegment2x.boundaryEdge(cell, cell.directionTo4(neighbor)));
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static long touchingSurfaceCellCount(Set<CellCoord> surfaceCells, GridSegment2x segment) {
        if (surfaceCells == null || surfaceCells.isEmpty() || segment == null) {
            return 0L;
        }
        return segment.touchingCells().stream().filter(surfaceCells::contains).count();
    }

    private static List<Door> normalizeDoors(EdgeShape boundaryShape, Collection<Door> doors) {
        if (doors == null || doors.isEmpty() || boundaryShape == null || boundaryShape.isEmpty()) {
            return List.of();
        }
        ArrayList<Door> result = new ArrayList<>();
        List<GridSegment2x> resolvedBoundarySegments = boundaryShape.segments2x();
        for (Door door : doors) {
            Door normalizedDoor = door == null ? null : door.clippedToBoundary(resolvedBoundarySegments);
            if (normalizedDoor == null) {
                continue;
            }
            Long doorId = normalizedDoor.doorId();
            if (doorId == null || doorId == 0L) {
                doorId = syntheticDoorId(normalizedDoor);
            }
            result.add(normalizedDoor.withDoorId(doorId));
        }
        result.sort(Comparator.comparing(Door::anchorSegment2x, GridSegment2x.ORDER));
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<Wall> normalizeWalls(EdgeShape boundaryShape, Collection<Wall> walls) {
        if (walls == null || walls.isEmpty() || boundaryShape == null || boundaryShape.isEmpty()) {
            return List.of();
        }
        ArrayList<Wall> result = new ArrayList<>();
        LinkedHashSet<GridSegment2x> occupiedSegments = new LinkedHashSet<>();
        List<GridSegment2x> resolvedBoundarySegments = boundaryShape.segments2x();
        for (Wall wall : walls) {
            Wall normalizedWall = wall == null ? null : wall.clippedToBoundary(resolvedBoundarySegments);
            if (normalizedWall == null) {
                continue;
            }
            for (GridSegment2x segment2x : normalizedWall.boundarySegments()) {
                if (!occupiedSegments.add(segment2x)) {
                    throw new IllegalArgumentException("Authored walls may not overlap on the same boundary segment");
                }
            }
            result.add(normalizedWall);
        }
        result.sort(Comparator.comparing(Wall::anchorSegment2x, GridSegment2x.ORDER));
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Set<GridSegment2x> authoredWallEdges(Collection<Wall> walls) {
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (Wall wall : walls == null ? List.<Wall>of() : walls) {
            if (wall != null) {
                result.addAll(wall.boundarySegments());
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static List<Wall> createdWalls(Collection<Wall> existingWalls, Collection<GridSegment2x> segments2x) {
        List<GridSegment2x> newSegments = (segments2x == null ? List.<GridSegment2x>of() : segments2x).stream()
                .filter(Objects::nonNull)
                .sorted(GridSegment2x.ORDER)
                .toList();
        if (newSegments.isEmpty()) {
            return existingWalls == null ? List.of() : List.copyOf(existingWalls);
        }
        ArrayList<Wall> result = new ArrayList<>(existingWalls == null ? List.<Wall>of() : existingWalls);
        result.addAll(Wall.fromBoundaryComponents(newSegments, WallKind.solid()));
        return result.stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(Wall::anchorSegment2x, GridSegment2x.ORDER))
                .toList();
    }

    private static List<Wall> deletedWalls(Collection<Wall> existingWalls, Collection<GridSegment2x> segments2x) {
        if (existingWalls == null || existingWalls.isEmpty()) {
            return List.of();
        }
        List<GridSegment2x> removedSegments = (segments2x == null ? List.<GridSegment2x>of() : segments2x).stream()
                .filter(Objects::nonNull)
                .sorted(GridSegment2x.ORDER)
                .toList();
        if (removedSegments.isEmpty()) {
            return existingWalls.stream()
                    .filter(Objects::nonNull)
                    .sorted(Comparator.comparing(Wall::anchorSegment2x, GridSegment2x.ORDER))
                    .toList();
        }
        ArrayList<Wall> result = new ArrayList<>();
        for (Wall wall : existingWalls) {
            if (wall != null) {
                result.addAll(wall.withoutBoundarySegments(removedSegments));
            }
        }
        return result.stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(Wall::anchorSegment2x, GridSegment2x.ORDER))
                .toList();
    }

    private static List<Door> clippedDoorsForBoundary(Collection<Door> doors, Collection<GridSegment2x> boundaryEdges) {
        if (doors == null || doors.isEmpty() || boundaryEdges == null || boundaryEdges.isEmpty()) {
            return List.of();
        }
        ArrayList<Door> result = new ArrayList<>();
        for (Door door : doors) {
            Door clippedDoor = door == null ? null : door.clippedToBoundary(boundaryEdges);
            if (clippedDoor != null) {
                result.add(clippedDoor);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<Wall> clippedWallsForBoundary(Collection<Wall> walls, Collection<GridSegment2x> boundaryEdges) {
        if (walls == null || walls.isEmpty() || boundaryEdges == null || boundaryEdges.isEmpty()) {
            return List.of();
        }
        ArrayList<Wall> result = new ArrayList<>();
        for (Wall wall : walls) {
            Wall clippedWall = wall == null ? null : wall.clippedToBoundary(boundaryEdges);
            if (clippedWall != null) {
                result.add(clippedWall);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static long syntheticDoorId(Door door) {
        long result = 17L;
        result = 31L * result + (door == null || door.doorState() == null ? 0L : door.doorState().ordinal());
        result = 31L * result + (door == null || door.persistedAnchorSegment2x() == null ? 0L : door.persistedAnchorSegment2x().hashCode());
        for (GridSegment2x segment2x : door == null ? List.<GridSegment2x>of() : door.orderedBoundarySegments()) {
            result = 31L * result + segment2x.hashCode();
        }
        if (result == 0L) {
            result = -1L;
        }
        return result > 0L ? -result : result;
    }
}
