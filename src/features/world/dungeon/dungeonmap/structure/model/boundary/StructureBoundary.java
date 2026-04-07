package features.world.dungeon.dungeonmap.structure.model.boundary;

import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridBoundary;
import features.world.dungeon.geometry.GridBounded;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridTranslatable;
import features.world.dungeon.geometry.GridTranslation;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.Door;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.Door.DoorState;
import features.world.dungeon.dungeonmap.structure.model.boundary.wall.Wall;
import features.world.dungeon.dungeonmap.structure.model.boundary.wall.WallKind;

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
public final class StructureBoundary implements GridBounded, GridTranslatable<StructureBoundary> {

    public record PersistenceSnapshot(
            List<Door> doors,
            List<Wall> walls
    ) {
        public PersistenceSnapshot {
            doors = doors == null ? List.of() : List.copyOf(doors);
            walls = walls == null ? List.of() : List.copyOf(walls);
        }
    }

    private final Set<GridPoint> surfaceCells;
    private final GridBoundary edgeShape;
    private final List<Door> doors;
    private final List<Wall> walls;

    public static StructureBoundary empty() {
        return new StructureBoundary(Set.of(), List.of(), List.of());
    }

    public static PersistenceSnapshot emptySnapshot() {
        return new PersistenceSnapshot(List.of(), List.of());
    }

    public static StructureBoundary fromSurfaceAndFeatures(
            Collection<GridPoint> surfaceCells,
            Collection<Door> doors,
            Collection<Wall> walls
    ) {
        return rewrittenForSurface(surfaceCells, surfaceCells, doors, walls);
    }

    public static StructureBoundary rewrittenForSurface(
            Collection<GridPoint> previousSurfaceCells,
            Collection<GridPoint> surfaceCells,
            Collection<Door> doors,
            Collection<Wall> walls
    ) {
        GridArea surfaceShape = GridArea.of(surfaceCells);
        if (surfaceShape.isEmpty()) {
            return empty();
        }
        Set<GridPoint> normalizedSurfaceCells = surfaceShape.cells();
        Set<GridPoint> normalizedPreviousSurfaceCells = GridArea.of(previousSurfaceCells).cells();
        return new StructureBoundary(
                normalizedSurfaceCells,
                doors,
                rebuiltWalls(normalizedPreviousSurfaceCells, normalizedSurfaceCells, walls));
    }

    public static StructureBoundary fromPersistenceSnapshot(
            Collection<GridPoint> surfaceCells,
            PersistenceSnapshot snapshot
    ) {
        PersistenceSnapshot resolvedSnapshot = snapshot == null ? emptySnapshot() : snapshot;
        return fromSurfaceAndFeatures(surfaceCells, resolvedSnapshot.doors(), resolvedSnapshot.walls());
    }

    private StructureBoundary(
            Collection<GridPoint> surfaceCells,
            Collection<Door> doors,
            Collection<Wall> walls
    ) {
        this.surfaceCells = surfaceCells == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(surfaceCells));
        this.walls = immutableWalls(walls);
        this.edgeShape = GridBoundary.of(wallEdges(this.walls));
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

    @Override
    public GridBoundary boundary() {
        return edgeShape;
    }

    public GridBoundary doorBoundary() {
        if (doors.isEmpty()) {
            return GridBoundary.empty();
        }
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>();
        for (Door door : doors) {
            if (door != null) {
                result.addAll(door.boundary().segments());
            }
        }
        return result.isEmpty() ? GridBoundary.empty() : GridBoundary.of(result);
    }

    public GridBoundary interiorAdjacencyBoundary() {
        return GridBoundary.of(interiorAdjacencyEdgesForSurface(surfaceCells));
    }

    public GridBoundary creatableWallBoundary() {
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>(interiorAdjacencyBoundary().segments());
        result.removeAll(wallEdges(walls));
        return result.isEmpty() ? GridBoundary.empty() : GridBoundary.of(result);
    }

    public GridBoundary deletableWallBoundary() {
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>(wallEdges(walls));
        result.retainAll(interiorAdjacencyBoundary().segments());
        return result.isEmpty() ? GridBoundary.empty() : GridBoundary.of(result);
    }

    public GridBoundary interiorBoundary() {
        if (surfaceCells.isEmpty()) {
            return GridBoundary.empty();
        }
        return GridBoundary.of(boundary().segments().stream()
                .filter(this::isInteriorBoundary)
                .sorted(GridSegment.ORDER)
                .toList());
    }

    public GridBoundary exteriorBoundary() {
        if (surfaceCells.isEmpty()) {
            return GridBoundary.empty();
        }
        return GridBoundary.of(boundary().segments().stream()
                .filter(this::isExteriorBoundary)
                .sorted(GridSegment.ORDER)
                .toList());
    }

    private Set<GridSegment> boundaryEdges() {
        return edgeShape.segments();
    }

    public Door doorAtBoundarySegment(GridSegment segment2x) {
        if (segment2x == null || !boundary().contains(segment2x)) {
            return null;
        }
        for (Door door : doors) {
            if (door != null && door.hasBoundarySegment(segment2x)) {
                return door;
            }
        }
        return null;
    }

    public Wall wallAtBoundarySegment(GridSegment segment2x) {
        if (segment2x == null || !boundary().contains(segment2x)) {
            return null;
        }
        for (Wall wall : walls) {
            if (wall != null && wall.hasBoundarySegment(segment2x)) {
                return wall;
            }
        }
        return null;
    }

    public boolean isInteriorBoundary(GridSegment segment2x) {
        return segment2x != null && touchingSurfaceCellCount(surfaceCells, segment2x) == 2L;
    }

    public boolean isExteriorBoundary(GridSegment segment2x) {
        return segment2x != null && touchingSurfaceCellCount(surfaceCells, segment2x) == 1L;
    }

    public boolean touchesBoundaryVertex(GridPoint vertex) {
        if (vertex == null) {
            return false;
        }
        return boundary().segments().stream()
                .anyMatch(segment2x -> segment2x.start().equals(vertex) || segment2x.end().equals(vertex));
    }

    public boolean isEditableWallVertex(GridPoint vertex, boolean deleteMode) {
        if (vertex == null) {
            return false;
        }
        Set<GridSegment> candidateEdges = deleteMode
                ? deletableWallBoundary().segments()
                : creatableWallBoundary().segments();
        return candidateEdges.stream()
                .anyMatch(segment2x -> segment2x.start().equals(vertex) || segment2x.end().equals(vertex));
    }

    public List<GridSegment> findCreatableWallPath(GridPoint start, GridPoint goal) {
        return shortestEdgePath(start, goal, creatableWallBoundary().segments());
    }

    public List<GridSegment> findDeletableWallPath(GridPoint start, GridPoint goal) {
        return shortestEdgePath(start, goal, deletableWallBoundary().segments());
    }

    public StructureBoundary withDoors(Collection<Door> doors) {
        return fromSurfaceAndFeatures(surfaceCells, doors, walls);
    }

    public StructureBoundary withCreatedWallPath(GridBoundary segments) {
        return fromSurfaceAndFeatures(
                surfaceCells,
                doors,
                createdWalls(walls, normalizedBoundaryEdges(creatableWallBoundary().segments(), segments == null ? Set.of() : segments.segments())));
    }

    public StructureBoundary withDeletedWallPath(GridBoundary segments) {
        return fromSurfaceAndFeatures(
                surfaceCells,
                doors,
                deletedWalls(walls, normalizedBoundaryEdges(deletableWallBoundary().segments(), segments == null ? Set.of() : segments.segments())));
    }

    public StructureBoundary withCreatedDoorSegments(GridBoundary segments) {
        List<Door> nextDoors = createdDoors(segments == null ? Set.of() : segments.segments());
        return Objects.equals(nextDoors, doors) ? this : withDoors(nextDoors);
    }

    public StructureBoundary withDeletedDoorSegments(GridBoundary segments) {
        List<Door> nextDoors = deletedDoors(segments == null ? Set.of() : segments.segments());
        return Objects.equals(nextDoors, doors) ? this : withDoors(nextDoors);
    }

    /**
     * Preserve the current move behavior as delete-source then create-target so every caller gets the same door split
     * and replacement semantics without rebuilding them in higher-level workflows.
     */
    public StructureBoundary withMovedDoor(
            GridSegment sourceBoundarySegment2x,
            GridSegment targetBoundarySegment2x
    ) {
        if (Objects.equals(sourceBoundarySegment2x, targetBoundarySegment2x)) {
            return this;
        }
        if (doorAtBoundarySegment(sourceBoundarySegment2x) == null) {
            throw new IllegalArgumentException("Door move source must already contain a door");
        }
        if (doorAtBoundarySegment(targetBoundarySegment2x) != null) {
            throw new IllegalArgumentException("Door move target is already occupied");
        }
        Wall targetWall = wallAtBoundarySegment(targetBoundarySegment2x);
        if (!boundary().contains(targetBoundarySegment2x)
                || targetWall == null
                || !targetWall.supportsDoorAttachments()) {
            throw new IllegalArgumentException("Door move target must be a valid boundary wall");
        }
        StructureBoundary withoutSource = withDeletedDoorSegments(GridBoundary.of(List.of(sourceBoundarySegment2x)));
        return withoutSource == this
                ? this
                : withoutSource.withCreatedDoorSegments(GridBoundary.of(List.of(targetBoundarySegment2x)));
    }

    @Override
    public StructureBoundary translated(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        if (resolvedTranslation.isZero()) {
            return this;
        }
        return new StructureBoundary(
                GridArea.of(surfaceCells).translated(resolvedTranslation).cells(),
                doors.stream()
                        .map(door -> door == null ? null : door.translated(resolvedTranslation))
                        .filter(Objects::nonNull)
                        .toList(),
                walls.stream()
                        .map(wall -> wall == null ? null : wall.translated(resolvedTranslation))
                        .filter(Objects::nonNull)
                        .toList());
    }

    public StructureBoundary rewrittenToSurface(GridArea surfaceCells) {
        return rewrittenForSurface(this.surfaceCells, surfaceCells == null ? Set.of() : surfaceCells.cells(), doors, walls);
    }

    public StructureBoundary clippedToSurface(GridArea clippedSurfaceCells) {
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
                && Objects.equals(boundary(), that.boundary())
                && Objects.equals(doors, that.doors)
                && Objects.equals(walls, that.walls);
    }

    @Override
    public int hashCode() {
        return Objects.hash(surfaceCells, boundary(), doors, walls);
    }

    @Override
    public String toString() {
        return "StructureBoundary[surfaceCells=" + surfaceCells
                + ", boundaryEdges=" + boundaryEdges()
                + ", doors=" + doors
                + ", walls=" + walls + "]";
    }

    private static List<GridSegment> shortestEdgePath(
            GridPoint start,
            GridPoint goal,
            Collection<GridSegment> traversableEdges
    ) {
        if (start == null || goal == null || traversableEdges == null || traversableEdges.isEmpty()) {
            return List.of();
        }
        if (Objects.equals(start, goal)) {
            return List.of();
        }
        Map<GridPoint, Set<GridPoint>> adjacency = edgeAdjacency(traversableEdges);
        if (!adjacency.containsKey(start) || !adjacency.containsKey(goal)) {
            return List.of();
        }
        ArrayDeque<GridPoint> queue = new ArrayDeque<>();
        Map<GridPoint, GridPoint> previous = new LinkedHashMap<>();
        queue.add(start);
        previous.put(start, null);
        while (!queue.isEmpty()) {
            GridPoint current = queue.removeFirst();
            if (current.equals(goal)) {
                break;
            }
            for (GridPoint neighbor : adjacency.getOrDefault(current, Set.of()).stream().sorted(GridPoint.ORDER).toList()) {
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
        ArrayList<GridSegment> path = new ArrayList<>();
        GridPoint current = goal;
        while (!Objects.equals(current, start)) {
            GridPoint parent = previous.get(current);
            if (parent == null) {
                return List.of();
            }
            path.add(new GridSegment(parent, current));
            current = parent;
        }
        Collections.reverse(path);
        return List.copyOf(path);
    }

    private static Map<GridPoint, Set<GridPoint>> edgeAdjacency(Collection<GridSegment> edges) {
        Map<GridPoint, Set<GridPoint>> result = new LinkedHashMap<>();
        for (GridSegment edge : edges == null ? List.<GridSegment>of() : edges) {
            if (edge == null) {
                continue;
            }
            result.computeIfAbsent(edge.start(), ignored -> new LinkedHashSet<>()).add(edge.end());
            result.computeIfAbsent(edge.end(), ignored -> new LinkedHashSet<>()).add(edge.start());
        }
        Map<GridPoint, Set<GridPoint>> immutable = new LinkedHashMap<>();
        for (Map.Entry<GridPoint, Set<GridPoint>> entry : result.entrySet()) {
            immutable.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return immutable.isEmpty() ? Map.of() : Map.copyOf(immutable);
    }

    private static Set<GridSegment> normalizedBoundaryEdges(
            Set<GridSegment> allowedEdges,
            Collection<GridSegment> boundaryEdges
    ) {
        if (allowedEdges == null || allowedEdges.isEmpty() || boundaryEdges == null || boundaryEdges.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>();
        GridBoundary.of(boundaryEdges).segments().stream()
                .sorted(GridSegment.ORDER)
                .filter(allowedEdges::contains)
                .forEach(result::add);
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Set<GridSegment> interiorAdjacencyEdgesForSurface(Set<GridPoint> surfaceCells) {
        if (surfaceCells == null || surfaceCells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>();
        for (GridPoint cell : surfaceCells) {
            for (CardinalDirection direction : CardinalDirection.values()) {
                GridPoint neighbor = cell.step(direction);
                if (!surfaceCells.contains(neighbor) || GridPoint.ORDER.compare(cell, neighbor) >= 0) {
                    continue;
                }
                result.add(GridSegment.boundaryEdge(cell, direction));
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Set<GridSegment> perimeterBoundaryEdgesForSurface(Set<GridPoint> surfaceCells) {
        if (surfaceCells == null || surfaceCells.isEmpty()) {
            return Set.of();
        }
        GridArea surfaceShape = GridArea.of(surfaceCells);
        return surfaceShape.isEmpty() ? Set.of() : surfaceShape.boundary().segments();
    }

    private static long touchingSurfaceCellCount(Set<GridPoint> surfaceCells, GridSegment segment) {
        if (surfaceCells == null || surfaceCells.isEmpty() || segment == null) {
            return 0L;
        }
        return segment.cellFootprint().cells().stream().filter(surfaceCells::contains).count();
    }

    private static List<Door> normalizeDoors(GridBoundary boundaryShape, Collection<Door> doors) {
        if (doors == null || doors.isEmpty() || boundaryShape == null || boundaryShape.isEmpty()) {
            return List.of();
        }
        ArrayList<Door> result = new ArrayList<>();
        for (Door door : doors) {
            Door normalizedDoor = door == null ? null : door.clippedToBoundary(boundaryShape);
            if (normalizedDoor == null) {
                continue;
            }
            Long doorId = normalizedDoor.doorId();
            if (doorId == null || doorId == 0L) {
                doorId = syntheticDoorId(normalizedDoor);
            }
            result.add(normalizedDoor.withDoorId(doorId));
        }
        result.sort(Comparator.comparing(Door::anchorSegment, GridSegment.ORDER));
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private List<Door> createdDoors(Collection<GridSegment> requestedSegments) {
        if (requestedSegments == null || requestedSegments.isEmpty()) {
            return doors;
        }
        List<GridSegment> editableSegments = requestedSegments.stream()
                .filter(Objects::nonNull)
                .filter(boundary().segments()::contains)
                .filter(segment2x -> doorAtBoundarySegment(segment2x) == null)
                .filter(segment2x -> {
                    Wall wall = wallAtBoundarySegment(segment2x);
                    return wall != null && wall.supportsDoorAttachments();
                })
                .sorted(GridSegment.ORDER)
                .toList();
        if (editableSegments.isEmpty()) {
            return doors;
        }
        LinkedHashSet<Door> nextDoors = new LinkedHashSet<>(doors);
        nextDoors.addAll(Door.fromBoundaryComponents(GridBoundary.of(editableSegments), DoorState.OPEN));
        return nextDoors.stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(Door::anchorSegment, GridSegment.ORDER))
                .toList();
    }

    private List<Door> deletedDoors(Collection<GridSegment> requestedSegments) {
        if (requestedSegments == null || requestedSegments.isEmpty()) {
            return doors;
        }
        Set<GridSegment> removableSegments = requestedSegments.stream()
                .filter(Objects::nonNull)
                .filter(segment2x -> doorAtBoundarySegment(segment2x) != null)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        if (removableSegments.isEmpty()) {
            return doors;
        }
        List<Door> nextDoors = doors.stream()
                .filter(Objects::nonNull)
                .map(door -> door.withoutBoundarySegments(GridBoundary.of(removableSegments)))
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(Door::anchorSegment, GridSegment.ORDER))
                .toList();
        return Objects.equals(nextDoors, doors) ? doors : nextDoors;
    }

    private static List<Wall> createdWalls(Collection<Wall> existingWalls, Collection<GridSegment> segments2x) {
        List<GridSegment> newSegments = (segments2x == null ? List.<GridSegment>of() : segments2x).stream()
                .filter(Objects::nonNull)
                .sorted(GridSegment.ORDER)
                .toList();
        if (newSegments.isEmpty()) {
            return existingWalls == null ? List.of() : List.copyOf(existingWalls);
        }
        ArrayList<Wall> result = new ArrayList<>(existingWalls == null ? List.<Wall>of() : existingWalls);
        result.addAll(Wall.fromBoundaryComponents(GridBoundary.of(newSegments), WallKind.solid()));
        return immutableWalls(result);
    }

    private static List<Wall> deletedWalls(Collection<Wall> existingWalls, Collection<GridSegment> segments2x) {
        if (existingWalls == null || existingWalls.isEmpty()) {
            return List.of();
        }
        List<GridSegment> removedSegments = (segments2x == null ? List.<GridSegment>of() : segments2x).stream()
                .filter(Objects::nonNull)
                .sorted(GridSegment.ORDER)
                .toList();
        if (removedSegments.isEmpty()) {
            return immutableWalls(existingWalls);
        }
        ArrayList<Wall> result = new ArrayList<>();
        for (Wall wall : existingWalls) {
            if (wall != null) {
                result.addAll(wall.withoutBoundarySegments(GridBoundary.of(removedSegments)));
            }
        }
        return immutableWalls(result);
    }

    private static Set<GridSegment> wallEdges(Collection<Wall> walls) {
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>();
        for (Wall wall : walls == null ? List.<Wall>of() : walls) {
            if (wall != null) {
                result.addAll(wall.boundarySegments());
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static List<Wall> rebuiltWalls(
            Set<GridPoint> previousSurfaceCells,
            Set<GridPoint> surfaceCells,
            Collection<Wall> walls
    ) {
        Set<GridSegment> perimeterEdges = perimeterBoundaryEdgesForSurface(surfaceCells);
        Set<GridSegment> interiorEdges = interiorAdjacencyEdgesForSurface(surfaceCells);
        LinkedHashSet<GridSegment> legalEdges = new LinkedHashSet<>(perimeterEdges);
        legalEdges.addAll(interiorEdges);

        LinkedHashSet<GridSegment> formerPerimeterBecomingInterior = new LinkedHashSet<>(
                perimeterBoundaryEdgesForSurface(previousSurfaceCells));
        formerPerimeterBecomingInterior.retainAll(interiorEdges);

        ArrayList<Wall> result = new ArrayList<>();
        LinkedHashSet<GridSegment> occupiedSegments = new LinkedHashSet<>();
        GridBoundary interiorBoundary = GridBoundary.of(formerPerimeterBecomingInterior);
        GridBoundary legalBoundary = GridBoundary.of(legalEdges);
        for (Wall wall : sortedWalls(walls)) {
            List<Wall> retainedComponents = formerPerimeterBecomingInterior.isEmpty()
                    ? List.of(wall)
                    : wall.withoutBoundarySegments(interiorBoundary);
            for (Wall retainedComponent : retainedComponents) {
                Wall clippedWall = retainedComponent == null ? null : retainedComponent.clippedToBoundary(legalBoundary);
                if (clippedWall == null) {
                    continue;
                }
                addOccupiedSegments(occupiedSegments, clippedWall);
                result.add(clippedWall);
            }
        }

        LinkedHashSet<GridSegment> missingPerimeterEdges = new LinkedHashSet<>(perimeterEdges);
        missingPerimeterEdges.removeAll(occupiedSegments);
        for (Wall materializedPerimeterWall : Wall.fromBoundaryComponents(GridBoundary.of(missingPerimeterEdges), WallKind.solid())) {
            addOccupiedSegments(occupiedSegments, materializedPerimeterWall);
            result.add(materializedPerimeterWall);
        }
        return immutableWalls(result);
    }

    private static List<Wall> immutableWalls(Collection<Wall> walls) {
        ArrayList<Wall> result = new ArrayList<>();
        LinkedHashSet<GridSegment> occupiedSegments = new LinkedHashSet<>();
        for (Wall wall : sortedWalls(walls)) {
            addOccupiedSegments(occupiedSegments, wall);
            result.add(wall);
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<Wall> sortedWalls(Collection<Wall> walls) {
        return (walls == null ? List.<Wall>of() : walls).stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(Wall::anchorSegment, GridSegment.ORDER))
                .toList();
    }

    private static void addOccupiedSegments(Set<GridSegment> occupiedSegments, Wall wall) {
        for (GridSegment segment2x : wall.boundarySegments()) {
            if (!occupiedSegments.add(segment2x)) {
                throw new IllegalArgumentException("Walls may not overlap on the same boundary segment");
            }
        }
    }

    private static long syntheticDoorId(Door door) {
        long result = 17L;
        result = 31L * result + (door == null || door.doorState() == null ? 0L : door.doorState().ordinal());
        result = 31L * result + (door == null || door.persistedAnchorSegment() == null ? 0L : door.persistedAnchorSegment().hashCode());
        for (GridSegment segment2x : door == null ? List.<GridSegment>of() : door.orderedBoundarySegments()) {
            result = 31L * result + segment2x.hashCode();
        }
        if (result == 0L) {
            result = -1L;
        }
        return result > 0L ? -result : result;
    }
}
