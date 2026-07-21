package features.dungeon.adapter.javafx.editor;

import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.projection.DungeonBoundaryFacts;
import features.dungeon.domain.core.projection.DungeonDerivedState;
import features.dungeon.domain.core.projection.DungeonDerivedStateProjection;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.component.boundary.BoundaryKind;
import features.dungeon.domain.core.structure.room.RoomClusterWallDeleteResolver;
import features.dungeon.domain.core.structure.room.RoomClusterWallDeleteTarget;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomTopologyWorkCatalog;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;

final class DungeonWallInvariantScenarios {


    private DungeonWallInvariantScenarios() {
    }

    static void run() {
        assertInvalidShrinkRejected();

        assertDungeonLevelWallProjection();

        assertWallPathAtomicCommitAndDelete();

        assertWallRunDeleteAndCornerPolicy();

        assertExteriorWallDeleteProtection();

    }

    private static void assertDungeonLevelWallProjection() {
        DungeonMap map = projectionMap();
        DungeonDerivedState derived = new DungeonDerivedStateProjection().project(map);
        Edge firstNorthWall = Edge.sideOf(new Cell(1, 1, 0), Direction.NORTH);
        Edge secondNorthWall = Edge.sideOf(new Cell(5, 1, 0), Direction.NORTH);
        Set<Edge> projectedWalls = wallEdges(derived);

        assertTrue(projectedWalls.contains(firstNorthWall),
                "wall projection includes first structure-owned wall boundary");
        assertTrue(projectedWalls.contains(secondNorthWall),
                "wall projection includes second structure-owned wall boundary");
        assertThrowsUnsupported(
                () -> derived.map().boundaries().add(derived.map().boundaries().getFirst()),
                "wall projection exposes immutable read-side boundary facts");
        assertEquals(projectedWalls, wallEdges(derived),
                "rejected projection mutation leaves derived wall facts unchanged");

        long firstClusterId = clusterIdForAnchor(map, new Cell(1, 1, 0));
        DungeonMap opened = map.editClusterBoundaries(
                firstClusterId,
                List.of(firstNorthWall),
                BoundaryKind.OPEN,
                false,
                roomIds(500L, 500L));
        Set<Edge> openedWalls = wallEdges(new DungeonDerivedStateProjection().project(opened));
        assertFalse(openedWalls.contains(firstNorthWall),
                "wall projection changes only after routing boundary mutation through DungeonMap structure ownership");
        assertEquals(projectedWalls, wallEdges(derived),
                "original wall projection remains a snapshot after authored structure mutation");
    }

    private static DungeonMap projectionMap() {
        DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(81L), "Wall Projection")
                .paintRoomRectangle(
                        new Cell(1, 1, 0), new Cell(2, 1, 0), roomIds(100L, 100L));
        map = map.paintRoomRectangle(
                new Cell(5, 1, 0), new Cell(6, 1, 0), roomIds(200L, 200L));
        Edge firstNorthWall = Edge.sideOf(new Cell(1, 1, 0), Direction.NORTH);
        Edge secondNorthWall = Edge.sideOf(new Cell(5, 1, 0), Direction.NORTH);
        map = map.editClusterBoundaries(
                clusterIdForAnchor(map, new Cell(1, 1, 0)),
                List.of(firstNorthWall),
                BoundaryKind.WALL,
                false,
                roomIds(300L, 300L));
        return map.editClusterBoundaries(
                clusterIdForAnchor(map, new Cell(5, 1, 0)),
                List.of(secondNorthWall),
                BoundaryKind.WALL,
                false,
                roomIds(400L, 400L));
    }

    private static void assertWallPathAtomicCommitAndDelete() {
        DungeonMap map = roomMap();
        long clusterId = clusterIdForAnchor(map, new Cell(1, 1, 0));
        List<Edge> run = internalVerticalRun();
        DungeonMap withRun = map.editClusterBoundaries(
                clusterId, run, BoundaryKind.WALL, false, roomIds(600L, 600L));
        Set<Edge> walls = wallEdges(new DungeonDerivedStateProjection().project(withRun));
        DungeonMap canceled = map.editClusterBoundaries(
                clusterId, List.of(), BoundaryKind.WALL, false, roomIds(700L, 700L));

        assertTrue(walls.containsAll(run),
                "wall owner commits every segment in one accumulated wall path");
        assertEquals(walls, wallEdges(new DungeonDerivedStateProjection()
                        .project(withRun.editClusterBoundaries(
                                clusterId, run, BoundaryKind.WALL, false, roomIds(800L, 800L)))),
                "wall owner treats duplicate accumulated path commit as stable wall facts");
        assertEquals(wallEdges(new DungeonDerivedStateProjection().project(map)),
                wallEdges(new DungeonDerivedStateProjection().project(canceled)),
                "wall owner leaves cancel/no-op path completion stable before commit");
    }

    private static void assertWallRunDeleteAndCornerPolicy() {
        DungeonMap map = roomMap();
        long clusterId = clusterIdForAnchor(map, new Cell(1, 1, 0));
        List<Edge> wallShape = tJunctionWallShape();
        Edge northTarget = new Edge(new Cell(2, 1, 0), new Cell(2, 2, 0));
        Edge northSecond = new Edge(new Cell(2, 2, 0), new Cell(2, 3, 0));
        Edge southTarget = new Edge(new Cell(2, 3, 0), new Cell(2, 4, 0));
        Edge eastTarget = new Edge(new Cell(2, 3, 0), new Cell(3, 3, 0));
        Edge eastSecond = new Edge(new Cell(3, 3, 0), new Cell(4, 3, 0));
        DungeonMap withShape = map.editClusterBoundaries(
                clusterId, wallShape, BoundaryKind.WALL, false, roomIds(900L, 900L));
        RoomClusterWallDeleteResolver wallDeleteResolver =
                RoomClusterWallDeleteResolver.authored(wallShape);
        RoomClusterWallDeleteTarget segmentTarget =
                wallDeleteResolver.deleteTarget(
                        roomMapCells(),
                        northTarget);
        RoomClusterWallDeleteTarget cornerTarget =
                wallDeleteResolver.cornerDeleteTarget(
                        roomMapCells(),
                        new Cell(2, 3, 0));
        DungeonMap segmentDeleted = withShape.editClusterBoundaries(
                clusterId,
                segmentTarget.edges(),
                BoundaryKind.WALL,
                true,
                roomIds(1_000L, 1_000L));
        Set<Edge> segmentDeletedWalls = wallEdges(new DungeonDerivedStateProjection().project(segmentDeleted));
        DungeonMap cornerDeleted = withShape.editClusterBoundaries(
                clusterId,
                cornerTarget.edges(),
                BoundaryKind.WALL,
                true,
                roomIds(1_100L, 1_100L));
        Set<Edge> cornerDeletedWalls = wallEdges(new DungeonDerivedStateProjection().project(cornerDeleted));

        assertTrue(segmentTarget.interiorRun(), "wall owner classifies segment target as eligible interior run");
        assertEquals(Set.of(northTarget, northSecond), Set.copyOf(segmentTarget.edges()),
                "wall owner exposes complete straight-run delete target for a segment");
        assertTrue(cornerTarget.interiorRun(), "wall owner classifies corner target as eligible interior runs");
        assertEquals(Set.of(northTarget, northSecond, southTarget, eastTarget, eastSecond),
                Set.copyOf(cornerTarget.edges()),
                "wall owner exposes every straight-run delete target touching a corner");
        assertFalse(segmentDeletedWalls.contains(northTarget),
                "wall owner removes the selected segment target");
        assertFalse(segmentDeletedWalls.contains(northSecond),
                "wall owner expands the segment target to its straight run before the corner");
        assertTrue(segmentDeletedWalls.contains(southTarget),
                "wall owner does not delete through a non-collinear corner");
        assertTrue(segmentDeletedWalls.contains(eastTarget),
                "wall owner leaves a different run untouched for segment deletion");
        assertFalse(cornerDeletedWalls.contains(northTarget),
                "wall owner removes a corner target's first straight run");
        assertFalse(cornerDeletedWalls.contains(northSecond),
                "wall owner expands the first corner run to the next corner");
        assertFalse(cornerDeletedWalls.contains(eastTarget),
                "wall owner removes a second straight run touching the same corner");
        assertFalse(cornerDeletedWalls.contains(eastSecond),
                "wall owner expands the second corner run to the next corner");
        assertFalse(cornerDeletedWalls.contains(southTarget),
                "wall owner removes the opposite straight run that touches the same corner");
    }

    private static void assertInvalidShrinkRejected() {
        DungeonMap map = roomMap();
        long clusterId = clusterIdForAnchor(map, new Cell(1, 1, 0));
        Set<Edge> before = wallEdges(new DungeonDerivedStateProjection().project(map));
        DungeonMap rejectedStretch = map.moveBoundaryStretch(
                clusterId,
                List.of(Edge.sideOf(new Cell(1, 1, 0), Direction.NORTH),
                        Edge.sideOf(new Cell(2, 1, 0), Direction.NORTH),
                        Edge.sideOf(new Cell(3, 1, 0), Direction.NORTH)),
                0,
                4,
                0,
                roomIds(1_200L, 1_200L));
        DungeonMap rejectedCorner = map.moveClusterCorner(
                clusterId,
                new Cell(4, 4, 0),
                -4,
                -4,
                0,
                roomIds(1_300L, 1_300L));

        assertEquals(before, wallEdges(new DungeonDerivedStateProjection().project(rejectedStretch)),
                "wall owner rejects inward wall-run shrink that would erase the room");
        assertEquals(before, wallEdges(new DungeonDerivedStateProjection().project(rejectedCorner)),
                "wall owner rejects inward corner shrink that would erase the room");
    }

    private static void assertExteriorWallDeleteProtection() {
        DungeonMap map = roomMap();
        long clusterId = clusterIdForAnchor(map, new Cell(1, 1, 0));
        Edge exteriorNorth = Edge.sideOf(new Cell(1, 1, 0), Direction.NORTH);
        Edge interiorTarget = new Edge(new Cell(2, 1, 0), new Cell(2, 2, 0));
        DungeonMap withInteriorWall = map.editClusterBoundaries(
                clusterId,
                List.of(interiorTarget),
                BoundaryKind.WALL,
                false,
                roomIds(1_400L, 1_400L));
        RoomClusterWallDeleteResolver wallDeleteResolver =
                RoomClusterWallDeleteResolver.authored(List.of(exteriorNorth, interiorTarget));
        RoomClusterWallDeleteTarget protectedTarget =
                wallDeleteResolver.deleteTarget(
                        roomMapCells(),
                        exteriorNorth);
        RoomClusterWallDeleteTarget cellTarget =
                wallDeleteResolver.cellDeleteTarget(
                        roomMapCells(),
                        new Cell(2, 1, 0));
        Set<Edge> before = wallEdges(new DungeonDerivedStateProjection().project(map));
        DungeonMap rejected = map.editClusterBoundaries(
                clusterId,
                List.of(exteriorNorth),
                BoundaryKind.WALL,
                true,
                roomIds(1_500L, 1_500L));
        DungeonMap interiorDeleted = withInteriorWall.editClusterBoundaries(
                clusterId,
                cellTarget.edges(),
                BoundaryKind.WALL,
                true,
                roomIds(1_600L, 1_600L));

        assertTrue(protectedTarget.isProtectedExterior(),
                "wall owner classifies cluster exterior target as protected before delete mutation");
        assertTrue(cellTarget.interiorRun(),
                "wall owner classifies cell-side interior wall target as eligible delete");
        assertEquals(List.of(interiorTarget), cellTarget.edges(),
                "wall owner exposes the cell-side interior delete edge");
        assertEquals(before, wallEdges(new DungeonDerivedStateProjection().project(rejected)),
                "wall owner rejects exterior wall delete without changing derived wall facts");
        assertFalse(wallEdges(new DungeonDerivedStateProjection().project(interiorDeleted)).contains(interiorTarget),
                "wall owner accepts eligible interior wall deletion");
    }

    private static DungeonMap roomMap() {
        return DungeonMapAuthoring.empty(new DungeonMapIdentity(82L), "Wall Path")
                .paintRoomRectangle(
                        new Cell(1, 1, 0),
                        new Cell(3, 3, 0),
                        roomIds(10L, 10L));
    }

    private static RoomTopologyWorkCatalog.ReservedIdentities roomIds(
            long firstClusterId,
            long firstRoomId
    ) {
        return new RoomTopologyWorkCatalog.ReservedIdentities(
                firstClusterId, 64, firstRoomId, 64);
    }

    private static List<Edge> internalVerticalRun() {
        return List.of(
                new Edge(new Cell(2, 1, 0), new Cell(2, 2, 0)),
                new Edge(new Cell(2, 2, 0), new Cell(2, 3, 0)),
                new Edge(new Cell(2, 3, 0), new Cell(2, 4, 0)));
    }

    private static List<Edge> tJunctionWallShape() {
        return List.of(
                new Edge(new Cell(2, 1, 0), new Cell(2, 2, 0)),
                new Edge(new Cell(2, 2, 0), new Cell(2, 3, 0)),
                new Edge(new Cell(2, 3, 0), new Cell(2, 4, 0)),
                new Edge(new Cell(2, 3, 0), new Cell(3, 3, 0)),
                new Edge(new Cell(3, 3, 0), new Cell(4, 3, 0)));
    }

    private static List<Cell> roomMapCells() {
        return List.of(
                new Cell(1, 1, 0),
                new Cell(2, 1, 0),
                new Cell(3, 1, 0),
                new Cell(1, 2, 0),
                new Cell(2, 2, 0),
                new Cell(3, 2, 0),
                new Cell(1, 3, 0),
                new Cell(2, 3, 0),
                new Cell(3, 3, 0));
    }

    private static Set<Edge> wallEdges(DungeonDerivedState derived) {
        java.util.LinkedHashSet<Edge> result = new java.util.LinkedHashSet<>();
        for (DungeonBoundaryFacts boundary : derived.map().boundaries()) {
            if ("wall".equals(boundary.kind())) {
                result.add(boundary.edge());
            }
        }
        return Set.copyOf(result);
    }

    private static long clusterIdForAnchor(DungeonMap map, Cell anchor) {
        for (RoomRegion room : map.rooms().rooms()) {
            if (room.primaryAnchor().equals(anchor)) {
                return room.clusterId();
            }
        }
        throw new IllegalStateException("Expected room anchor " + anchor);
    }

    private static void assertEquals(Object expected, Object actual, String message) {
        if (!java.util.Objects.equals(expected, actual)) {
            throw new IllegalStateException(message + " expected=" + expected + " actual=" + actual);
        }
    }

    private static void assertTrue(boolean value, String message) {
        if (!value) {
            throw new IllegalStateException(message);
        }
    }

    private static void assertFalse(boolean value, String message) {
        if (value) {
            throw new IllegalStateException(message);
        }
    }

    private static void assertThrowsUnsupported(Runnable action, String message) {
        try {
            action.run();
        } catch (UnsupportedOperationException expected) {
            return;
        }
        throw new IllegalStateException(message);
    }
}
