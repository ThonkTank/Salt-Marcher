package features.dungeon.adapter.javafx.editor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.geometry.EdgeKey;
import features.dungeon.domain.core.projection.DungeonBoundaryFacts;
import features.dungeon.domain.core.projection.DungeonDerivedState;
import features.dungeon.domain.core.projection.DungeonDerivedStateProjection;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.door.Door;
import features.dungeon.domain.core.structure.door.DoorBoundaryMaterialization;
import features.dungeon.domain.core.structure.door.DoorIndex;
import features.dungeon.domain.core.structure.room.BoundaryStretchOrientation;
import features.dungeon.domain.core.structure.room.RoomClusterGeometry;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryOrdering;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryStretchPlan;
import features.dungeon.domain.core.structure.room.RoomClusterFloorMap;
import features.dungeon.domain.core.structure.room.RoomClusterWallDeleteResolver;
import features.dungeon.domain.core.structure.room.RoomClusterWallDeleteTarget;
import features.dungeon.domain.core.structure.room.RoomClusterWallMap;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;

final class DungeonWallInvariantScenarios {


    private DungeonWallInvariantScenarios() {
    }

    static void run() {
        assertStructureLocalWallMap();

        assertWallRowNormalization();

        assertWallMaterialization();

        assertWallStretchSelection();
        assertInvalidShrinkRejected();

        assertWallDoorBoundarySurface();

        assertDungeonLevelWallProjection();

        assertWallPathAtomicCommitAndDelete();

        assertWallRunDeleteAndCornerPolicy();

        assertExteriorWallDeleteProtection();

    }

    private static void assertStructureLocalWallMap() {
        Cell center = new Cell(5, 7, 0);
        RoomClusterWallMap wallMap = new RoomClusterWallMap(center, List.of(
                new BoundaryRow(42L, 0, new Cell(0, 0, 0), Direction.NORTH,
                        RoomClusterBoundaryMaterialization.BoundaryKind.WALL),
                new BoundaryRow(42L, 0, new Cell(0, 0, 0), Direction.EAST,
                        RoomClusterBoundaryMaterialization.BoundaryKind.OPEN),
                new BoundaryRow(42L, 1, new Cell(0, 0, 1), Direction.SOUTH,
                        RoomClusterBoundaryMaterialization.BoundaryKind.DOOR)));
        RoomClusterGeometry cluster = new RoomClusterGeometry(
                42L,
                7L,
                center,
                RoomClusterFloorMap.fromCells(List.of(center)),
                wallMap);

        assertEquals(wallMap, cluster.wallMap(), "cluster composes the wall owner");
        assertEquals(wallMap, new RoomClusterWallMap(center, List.of(
                        new BoundaryRow(42L, 0, new Cell(0, 0, 0), Direction.EAST,
                                RoomClusterBoundaryMaterialization.BoundaryKind.OPEN),
                        new BoundaryRow(42L, 1, new Cell(0, 0, 1), Direction.SOUTH,
                                RoomClusterBoundaryMaterialization.BoundaryKind.DOOR),
                        new BoundaryRow(42L, 0, new Cell(0, 0, 0), Direction.NORTH,
                                RoomClusterBoundaryMaterialization.BoundaryKind.WALL))),
                "wall owner keeps mixed boundary kinds in one map");
    }

    private static void assertWallRowNormalization() {
        Cell center = new Cell(5, 7, 0);
        BoundaryRow north = new BoundaryRow(42L, 0, new Cell(0, 0, 0), Direction.NORTH,
                RoomClusterBoundaryMaterialization.BoundaryKind.WALL);
        BoundaryRow duplicateNorth = new BoundaryRow(42L, 0, new Cell(0, 0, 0), Direction.NORTH,
                RoomClusterBoundaryMaterialization.BoundaryKind.OPEN);
        BoundaryRow doorNorth = new BoundaryRow(42L, 0, new Cell(0, 0, 0), Direction.NORTH,
                RoomClusterBoundaryMaterialization.BoundaryKind.DOOR);
        BoundaryRow upper = new BoundaryRow(42L, 1, new Cell(-1, 0, 1), Direction.WEST,
                RoomClusterBoundaryMaterialization.BoundaryKind.DOOR);
        List<BoundaryRow> rows = new ArrayList<>(List.of(upper, north, duplicateNorth, doorNorth));
        rows.add(null);
        RoomClusterWallMap wallMap = new RoomClusterWallMap(center, rows);
        Edge northEdge = Edge.sideOf(center, Direction.NORTH);
        Edge reversedNorth = new Edge(northEdge.to(), northEdge.from());

        assertEquals(new RoomClusterWallMap(center, List.of(doorNorth, upper)), wallMap,
                "wall owner deduplicates boundary rows by explicit boundary-kind precedence");
        assertEquals(EdgeKey.from(reversedNorth), RoomClusterBoundaryOrdering.boundaryKey(center, north),
                "wall owner uses normalized reversed edge identity");
        assertEquals(List.of(doorNorth, duplicateNorth, north, upper), RoomClusterBoundaryOrdering.sortedRows(rows),
                "wall owner compatibility ordering sorts rows deterministically without deduplicating");
        assertEquals(List.of(doorNorth, duplicateNorth, north),
                RoomClusterBoundaryOrdering.boundariesByLevel(rows).get(0),
                "wall owner compatibility grouping preserves same-edge rows before owner deduplication");
        assertEquals(RoomClusterBoundaryOrdering.boundaryKey(center, duplicateNorth),
                RoomClusterBoundaryOrdering.boundaryKey(center, north),
                "wall owner maps duplicate rows to one edge key");
    }

    private static void assertWallMaterialization() {
        RoomClusterFloorMap floorMap = RoomClusterFloorMap.fromCells(List.of(new Cell(2, 3, 0), new Cell(3, 3, 0)));
        Cell center = new Cell(2, 3, 0);
        Edge northEdge = Edge.sideOf(center, Direction.NORTH);
        Edge southEdge = Edge.sideOf(center, Direction.SOUTH);
        Edge sharedEdge = Edge.sideOf(center, Direction.EAST);

        BoundaryRow wallRow = RoomClusterBoundaryMaterialization.forEdge(
                floorMap.allCells(),
                center,
                42L,
                northEdge,
                RoomClusterBoundaryMaterialization.BoundaryKind.WALL);
        assertTrue(wallRow != null, "wall owner reports wall row creation");
        RoomClusterWallMap wallMap = new RoomClusterWallMap(center, List.of(wallRow));
        assertEquals(new RoomClusterWallMap(center, List.of(wallRow)), wallMap,
                "wall owner preserves materialized wall kind");
        assertEquals(wallMap, new RoomClusterWallMap(center, List.of(wallRow, wallRow)),
                "wall owner reports duplicate materialization as no-op state");
        assertEquals(wallRow, RoomClusterBoundaryMaterialization.forEdge(
                        floorMap.allCells(),
                        center,
                        42L,
                        northEdge,
                        RoomClusterBoundaryMaterialization.BoundaryKind.WALL),
                "wall owner compatibility route keeps valid wall rows materializable");
        BoundaryRow openRow = RoomClusterBoundaryMaterialization.openForEdge(
                floorMap.allCells(),
                center,
                42L,
                southEdge);
        assertTrue(openRow != null, "wall owner reports open row creation");
        assertEquals(new RoomClusterWallMap(center, List.of(openRow)),
                new RoomClusterWallMap(center, List.of(openRow, openRow)),
                "wall owner preserves materialized open kind as boundary state");
        assertEquals(null, RoomClusterBoundaryMaterialization.openForEdge(
                        floorMap.allCells(),
                        center,
                        42L,
                        sharedEdge),
                "wall owner rejects split-room open row");
        assertEquals(null, RoomClusterBoundaryMaterialization.forEdge(
                        floorMap.allCells(),
                        center,
                        42L,
                        Edge.sideOf(new Cell(8, 8, 0), Direction.NORTH),
                        RoomClusterBoundaryMaterialization.BoundaryKind.WALL),
                "wall owner rejects untouched edge");
    }

    private static void assertWallStretchSelection() {
        Cell left = new Cell(0, 0, 0);
        Cell right = new Cell(1, 0, 0);
        RoomClusterFloorMap floorMap = RoomClusterFloorMap.fromCells(List.of(left, right));
        Edge northLeft = Edge.sideOf(left, Direction.NORTH);
        Edge northRight = Edge.sideOf(right, Direction.NORTH);
        Cell center = new Cell(0, 0, 0);
        BoundaryRow leftRow = new BoundaryRow(42L, 0, new Cell(0, 0, 0), Direction.NORTH,
                RoomClusterBoundaryMaterialization.BoundaryKind.WALL);
        BoundaryRow rightRow = new BoundaryRow(42L, 0, new Cell(1, 0, 0), Direction.NORTH,
                RoomClusterBoundaryMaterialization.BoundaryKind.WALL);
        RoomClusterWallMap wallMap = new RoomClusterWallMap(center, List.of(leftRow, rightRow));
        RoomClusterWallMap keyedWallMap = RoomClusterWallMap.fromKeyedRows(Map.of(
                RoomClusterBoundaryOrdering.boundaryKey(center, leftRow),
                leftRow,
                RoomClusterBoundaryOrdering.boundaryKey(center, rightRow),
                rightRow));

        RoomClusterBoundaryStretchPlan.Selection selection =
                keyedWallMap.stretchSelection(
                        floorMap,
                        List.of(northRight, northLeft),
                        0,
                        -1,
                        0)
                        .orElseThrow(() -> new IllegalStateException("expected wall-owned stretch selection"));
        assertEquals(wallMap, new RoomClusterWallMap(center, List.of(rightRow, leftRow)),
                "wall owner provides deterministic stretch row state");
        assertEquals(List.of(EdgeKey.from(northLeft), EdgeKey.from(northRight)),
                new ArrayList<>(selection.sourceKeys()),
                "wall owner delegates stretch source key normalization to the wall map state");
        assertEquals(BoundaryStretchOrientation.HORIZONTAL, selection.orientation(),
                "wall owner resolves stretch orientation");
        assertEquals(0, selection.startVariable(), "wall owner resolves contiguous stretch start");
        assertEquals(2, selection.endVariable(), "wall owner resolves contiguous stretch end");
        assertTrue(selection.movesOutward(), "wall owner resolves outward stretch direction");
        assertEquals(Set.of(new Cell(0, -1, 0), new Cell(1, -1, 0)), selection.stripCells(),
                "wall owner resolves moved strip cells");
        assertEquals(List.of(new Edge(new Cell(0, 0, 0), new Cell(0, -1, 0))),
                selection.connectorPath(selection.vertices().getFirst()),
                "wall owner returns core connector path derivation");

        RoomClusterBoundaryStretchPlan.Selection inwardSelection =
                keyedWallMap.stretchSelection(
                        floorMap,
                        List.of(northLeft, northRight),
                        0,
                        1,
                        0)
                        .orElseThrow(() -> new IllegalStateException("expected inward wall-owned stretch selection"));
        assertFalse(inwardSelection.movesOutward(), "wall owner resolves inward stretch direction");
        assertEquals(Set.of(new Cell(0, 0, 0), new Cell(1, 0, 0)), inwardSelection.stripCells(),
                "wall owner resolves inward source strip cells");
    }

    private static void assertWallDoorBoundarySurface() {
        Cell center = new Cell(0, 0, 0);
        Door door = new Door(7L, 1L, 42L, center, Direction.EAST);
        BoundaryRow wallRow = new BoundaryRow(42L, 0, center, Direction.EAST,
                RoomClusterBoundaryMaterialization.BoundaryKind.WALL);
        BoundaryRow doorRow = boundaryRow(door.doorBoundaryState());

        assertTrue(DoorBoundaryMaterialization.forEdge(
                        Edge.sideOf(center, Direction.EAST),
                        Map.of(1L, List.of(center), 2L, List.of(new Cell(1, 0, 0))),
                        DoorBoundaryMaterialization.ExistingBoundaryKind.NON_DOOR)
                .materializesDoor(), "door owner allows conversion of existing non-door wall boundary");
        assertFalse(DoorBoundaryMaterialization.forEdge(
                        Edge.sideOf(center, Direction.EAST),
                        Map.of(1L, List.of(center), 2L, List.of(new Cell(1, 0, 0))),
                        DoorBoundaryMaterialization.ExistingBoundaryKind.DOOR)
                .materializesDoor(), "door owner rejects duplicate door boundary materialization");
        assertEquals(new RoomClusterWallMap(center, List.of(doorRow)),
                new RoomClusterWallMap(center, List.of(wallRow, doorRow)),
                "wall owner normalizes one boundary surface where door replaces wall");

        DoorIndex index = new DoorIndex(List.of(door));
        assertEquals(new DoorIndex(List.of()), index.withoutDoor(door, false),
                "door owner removes unbound door from the bounded boundary surface");
        assertEquals(new RoomClusterWallMap(center, List.of(wallRow)),
                new RoomClusterWallMap(center, List.of(boundaryRow(door.restoredWallState()))),
                "door owner exposes restored wall state for the wall boundary surface");
    }

    private static BoundaryRow boundaryRow(Door.BoundaryState state) {
        return new BoundaryRow(
                state.clusterId(),
                state.level(),
                state.relativeCell(),
                state.direction(),
                switch (state.kind()) {
                    case DOOR -> RoomClusterBoundaryMaterialization.BoundaryKind.DOOR;
                    case WALL -> RoomClusterBoundaryMaterialization.BoundaryKind.WALL;
                });
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
                false);
        Set<Edge> openedWalls = wallEdges(new DungeonDerivedStateProjection().project(opened));
        assertFalse(openedWalls.contains(firstNorthWall),
                "wall projection changes only after routing boundary mutation through DungeonMap structure ownership");
        assertEquals(projectedWalls, wallEdges(derived),
                "original wall projection remains a snapshot after authored structure mutation");
    }

    private static DungeonMap projectionMap() {
        DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(81L), "Wall Projection")
                .paintRoomRectangle(new Cell(1, 1, 0), new Cell(2, 1, 0))
                .paintRoomRectangle(new Cell(5, 1, 0), new Cell(6, 1, 0));
        Edge firstNorthWall = Edge.sideOf(new Cell(1, 1, 0), Direction.NORTH);
        Edge secondNorthWall = Edge.sideOf(new Cell(5, 1, 0), Direction.NORTH);
        map = map.editClusterBoundaries(
                clusterIdForAnchor(map, new Cell(1, 1, 0)),
                List.of(firstNorthWall),
                BoundaryKind.WALL,
                false);
        return map.editClusterBoundaries(
                clusterIdForAnchor(map, new Cell(5, 1, 0)),
                List.of(secondNorthWall),
                BoundaryKind.WALL,
                false);
    }

    private static void assertWallPathAtomicCommitAndDelete() {
        DungeonMap map = roomMap();
        long clusterId = clusterIdForAnchor(map, new Cell(1, 1, 0));
        List<Edge> run = internalVerticalRun();
        DungeonMap withRun = map.editClusterBoundaries(clusterId, run, BoundaryKind.WALL, false);
        Set<Edge> walls = wallEdges(new DungeonDerivedStateProjection().project(withRun));
        DungeonMap canceled = map.editClusterBoundaries(clusterId, List.of(), BoundaryKind.WALL, false);

        assertTrue(walls.containsAll(run),
                "wall owner commits every segment in one accumulated wall path");
        assertEquals(walls, wallEdges(new DungeonDerivedStateProjection()
                        .project(withRun.editClusterBoundaries(clusterId, run, BoundaryKind.WALL, false))),
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
        DungeonMap withShape = map.editClusterBoundaries(clusterId, wallShape, BoundaryKind.WALL, false);
        RoomClusterWallDeleteResolver wallDeleteResolver =
                RoomClusterWallMap.authoredWallDeleteResolver(wallShape);
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
                true);
        Set<Edge> segmentDeletedWalls = wallEdges(new DungeonDerivedStateProjection().project(segmentDeleted));
        DungeonMap cornerDeleted = withShape.editClusterBoundaries(
                clusterId,
                cornerTarget.edges(),
                BoundaryKind.WALL,
                true);
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
                0);
        DungeonMap rejectedCorner = map.moveClusterCorner(clusterId, new Cell(4, 4, 0), -4, -4, 0);

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
                false);
        RoomClusterWallDeleteResolver wallDeleteResolver =
                RoomClusterWallMap.authoredWallDeleteResolver(List.of(exteriorNorth, interiorTarget));
        RoomClusterWallDeleteTarget protectedTarget =
                wallDeleteResolver.deleteTarget(
                        roomMapCells(),
                        exteriorNorth);
        RoomClusterWallDeleteTarget cellTarget =
                wallDeleteResolver.cellDeleteTarget(
                        roomMapCells(),
                        new Cell(2, 1, 0));
        Set<Edge> before = wallEdges(new DungeonDerivedStateProjection().project(map));
        DungeonMap rejected = map.editClusterBoundaries(clusterId, List.of(exteriorNorth), BoundaryKind.WALL, true);
        DungeonMap interiorDeleted = withInteriorWall.editClusterBoundaries(
                clusterId,
                cellTarget.edges(),
                BoundaryKind.WALL,
                true);

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
                .paintRoomRectangle(new Cell(1, 1, 0), new Cell(3, 3, 0));
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
