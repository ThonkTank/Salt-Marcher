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
 *
 * <p>The boundary aggregate now materializes the current surface perimeter as real walls so callers no longer need a
 * synthetic "effective wall" fallback for exterior edges.</p>
 */
public final class StructureBoundary {

    public record PersistenceSnapshot(
            List<Door> doors,
            List<Wall> walls
    ) {
        public PersistenceSnapshot {
            doors = doors == null ? List.of() : List.copyOf(doors);
            walls = walls == null ? List.of() : List.copyOf(walls);
        }
    }

    private final Set<CellCoord> surfaceCells;
    private final EdgeShape edgeShape;
    private final List<Door> doors;
    private final List<Wall> walls;

    public static StructureBoundary empty() {
        return new StructureBoundary(Set.of(), List.of(), List.of());
    }

    public static PersistenceSnapshot emptySnapshot() {
        return new PersistenceSnapshot(List.of(), List.of());
    }

    public static StructureBoundary fromSurfaceAndFeatures(
            Collection<CellCoord> surfaceCells,
            Collection<Door> doors,
            Collection<Wall> walls
    ) {
        return rewrittenForSurface(surfaceCells, surfaceCells, doors, walls);
    }

    public static StructureBoundary rewrittenForSurface(
            Collection<CellCoord> previousSurfaceCells,
            Collection<CellCoord> surfaceCells,
            Collection<Door> doors,
            Collection<Wall> walls
    ) {
        TileShape surfaceShape = TileShape.of(surfaceCells);
        if (surfaceShape.isEmpty()) {
            return empty();
        }
        Set<CellCoord> normalizedSurfaceCells = surfaceShape.cellCoords();
        Set<CellCoord> normalizedPreviousSurfaceCells = TileShape.of(previousSurfaceCells).cellCoords();
        return new StructureBoundary(
                normalizedSurfaceCells,
                doors,
                rebuiltWalls(normalizedPreviousSurfaceCells, normalizedSurfaceCells, walls));
    }

    public static StructureBoundary fromPersistenceSnapshot(
            Collection<CellCoord> surfaceCells,
            PersistenceSnapshot snapshot
    ) {
        PersistenceSnapshot resolvedSnapshot = snapshot == null ? emptySnapshot() : snapshot;
        return fromSurfaceAndFeatures(surfaceCells, resolvedSnapshot.doors(), resolvedSnapshot.walls());
    }

    private StructureBoundary(
            Collection<CellCoord> surfaceCells,
            Collection<Door> doors,
            Collection<Wall> walls
    ) {
        this.surfaceCells = surfaceCells == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(surfaceCells));
        this.walls = immutableWalls(walls);
        this.edgeShape = EdgeShape.fromBoundarySegments(wallEdges(this.walls));
        this.doors = normalizeDoors(this.edgeShape, doors);
    }

    public List<Door> doors() {
        return doors;
    }

    public List<Wall> walls() {
        return walls;
    }

    public PersistenceSnapshot persistenceSnapshot() {
        return new PersistenceSnapshot(doors, walls);
    }

    public Set<GridSegment2x> boundaryEdges() {
        return edgeShape.segmentSet2x();
    }

    public Set<GridSegment2x> doorBoundaryEdges() {
        if (doors.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (Door door : doors) {
            if (door != null) {
                result.addAll(door.boundarySegments());
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
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

    public Wall wallAtBoundarySegment(GridSegment2x segment2x) {
        if (segment2x == null || !boundaryEdges().contains(segment2x)) {
            return null;
        }
        for (Wall wall : walls) {
            if (wall != null && wall.hasBoundarySegment(segment2x)) {
                return wall;
            }
        }
        return null;
    }

    public Set<GridSegment2x> movementBlockingBoundaryEdges() {
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (GridSegment2x segment2x : boundaryEdges().stream().sorted(GridSegment2x.ORDER).toList()) {
            if (doorAtBoundarySegment(segment2x) != null) {
                continue;
            }
            Wall wall = wallAtBoundarySegment(segment2x);
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
        result.removeAll(wallEdges(walls));
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public Set<GridSegment2x> deletableWallEdges() {
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>(wallEdges(walls));
        result.retainAll(interiorAdjacencyEdges());
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
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
        return fromSurfaceAndFeatures(surfaceCells, doors, walls);
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
                deletedWalls(walls, normalizedBoundaryEdges(deletableWallEdges(), segments2x)));
    }

    public StructureBoundary translatedByCells(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new StructureBoundary(
                surfaceCells.stream().map(cell -> cell.add(resolvedDelta)).toList(),
                doors.stream()
                        .map(door -> door == null ? null : door.movedBy(resolvedDelta))
                        .filter(Objects::nonNull)
                        .toList(),
                walls.stream()
                        .map(wall -> wall == null ? null : wall.movedBy(resolvedDelta))
                        .filter(Objects::nonNull)
                        .toList());
    }

    public StructureBoundary rewrittenToSurface(Collection<CellCoord> surfaceCells) {
        return rewrittenForSurface(this.surfaceCells, surfaceCells, doors, walls);
    }

    public StructureBoundary clippedToSurface(Collection<CellCoord> clippedSurfaceCells) {
        return rewrittenToSurface(clippedSurfaceCells);
    }

    public boolean isEmpty() {
        return surfaceCells.isEmpty()
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

    private static Set<GridSegment2x> perimeterBoundaryEdgesForSurface(Set<CellCoord> surfaceCells) {
        if (surfaceCells == null || surfaceCells.isEmpty()) {
            return Set.of();
        }
        TileShape surfaceShape = TileShape.of(surfaceCells);
        return surfaceShape.isEmpty() ? Set.of() : surfaceShape.boundaryShape().segmentSet2x();
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
        return immutableWalls(result);
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
            return immutableWalls(existingWalls);
        }
        ArrayList<Wall> result = new ArrayList<>();
        for (Wall wall : existingWalls) {
            if (wall != null) {
                result.addAll(wall.withoutBoundarySegments(removedSegments));
            }
        }
        return immutableWalls(result);
    }

    private static Set<GridSegment2x> wallEdges(Collection<Wall> walls) {
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (Wall wall : walls == null ? List.<Wall>of() : walls) {
            if (wall != null) {
                result.addAll(wall.boundarySegments());
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static List<Wall> rebuiltWalls(
            Set<CellCoord> previousSurfaceCells,
            Set<CellCoord> surfaceCells,
            Collection<Wall> walls
    ) {
        Set<GridSegment2x> perimeterEdges = perimeterBoundaryEdgesForSurface(surfaceCells);
        Set<GridSegment2x> interiorEdges = interiorAdjacencyEdgesForSurface(surfaceCells);
        LinkedHashSet<GridSegment2x> legalEdges = new LinkedHashSet<>(perimeterEdges);
        legalEdges.addAll(interiorEdges);

        LinkedHashSet<GridSegment2x> formerPerimeterBecomingInterior = new LinkedHashSet<>(
                perimeterBoundaryEdgesForSurface(previousSurfaceCells));
        formerPerimeterBecomingInterior.retainAll(interiorEdges);

        ArrayList<Wall> result = new ArrayList<>();
        LinkedHashSet<GridSegment2x> occupiedSegments = new LinkedHashSet<>();
        for (Wall wall : sortedWalls(walls)) {
            List<Wall> retainedComponents = formerPerimeterBecomingInterior.isEmpty()
                    ? List.of(wall)
                    : wall.withoutBoundarySegments(formerPerimeterBecomingInterior);
            for (Wall retainedComponent : retainedComponents) {
                Wall clippedWall = retainedComponent == null ? null : retainedComponent.clippedToBoundary(legalEdges);
                if (clippedWall == null) {
                    continue;
                }
                addOccupiedSegments(occupiedSegments, clippedWall);
                result.add(clippedWall);
            }
        }

        LinkedHashSet<GridSegment2x> missingPerimeterEdges = new LinkedHashSet<>(perimeterEdges);
        missingPerimeterEdges.removeAll(occupiedSegments);
        for (Wall materializedPerimeterWall : Wall.fromBoundaryComponents(missingPerimeterEdges, WallKind.solid())) {
            addOccupiedSegments(occupiedSegments, materializedPerimeterWall);
            result.add(materializedPerimeterWall);
        }
        return immutableWalls(result);
    }

    private static List<Wall> immutableWalls(Collection<Wall> walls) {
        ArrayList<Wall> result = new ArrayList<>();
        LinkedHashSet<GridSegment2x> occupiedSegments = new LinkedHashSet<>();
        for (Wall wall : sortedWalls(walls)) {
            addOccupiedSegments(occupiedSegments, wall);
            result.add(wall);
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<Wall> sortedWalls(Collection<Wall> walls) {
        return (walls == null ? List.<Wall>of() : walls).stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(Wall::anchorSegment2x, GridSegment2x.ORDER))
                .toList();
    }

    private static void addOccupiedSegments(Set<GridSegment2x> occupiedSegments, Wall wall) {
        for (GridSegment2x segment2x : wall.boundarySegments()) {
            if (!occupiedSegments.add(segment2x)) {
                throw new IllegalArgumentException("Walls may not overlap on the same boundary segment");
            }
        }
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
