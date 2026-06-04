package src.view.leftbartabs.dungeoneditor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.structure.door.Door;
import src.domain.dungeon.model.core.structure.door.DoorBoundaryMaterialization;
import src.domain.dungeon.model.core.structure.door.DoorIndex;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryOrdering;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryStretchPlan;
import src.domain.dungeon.model.core.structure.room.RoomCluster;
import src.domain.dungeon.model.core.structure.room.RoomClusterFloorMap;
import src.domain.dungeon.model.core.structure.room.RoomClusterWallMap;

final class DungeonWallInvariantHarness {

    private static final String OWNER = "WallInvariantHarness";

    private DungeonWallInvariantHarness() {
    }

    static void run(List<String> results) {
        assertStructureLocalWallMap();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-WALL-001",
                "Room clusters compose one authoritative wall owner for wall, open, and door boundary facts");
        assertWallRowNormalization();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-WALL-002",
                "Wall owner normalizes edge identity, duplicate rows, level, boundary kind, and deterministic ordering");
        assertWallMaterialization();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-WALL-003",
                "Wall owner materializes perimeter wall/open rows from floor facts and rejects invalid edges");
        assertWallStretchSelection();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-WALL-004",
                "Wall owner computes stretch source selection and connector paths from wall map state");
        assertWallDoorBoundarySurface();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-WALL-005",
                "Wall owner and Door owner share one boundary surface without duplicate wall/door state");
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
        RoomCluster cluster = new RoomCluster(
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
        assertEquals(RoomClusterBoundaryStretchPlan.Orientation.HORIZONTAL, selection.orientation(),
                "wall owner resolves stretch orientation");
        assertEquals(0, selection.startVariable(), "wall owner resolves contiguous stretch start");
        assertEquals(2, selection.endVariable(), "wall owner resolves contiguous stretch end");
        assertTrue(selection.movesOutward(), "wall owner resolves outward stretch direction");
        assertEquals(Set.of(new Cell(0, -1, 0), new Cell(1, -1, 0)), selection.stripCells(),
                "wall owner resolves moved strip cells");
        assertEquals(List.of(new Edge(new Cell(0, 0, 0), new Cell(0, -1, 0))),
                selection.connectorPath(selection.vertices().getFirst()),
                "wall owner returns core connector path derivation");
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
}
