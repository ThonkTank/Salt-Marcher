package features.dungeon.adapter.javafx.editor;

import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.component.floor.FloorCellMap;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.projection.DungeonAreaFacts;
import features.dungeon.domain.core.projection.DungeonAreaType;
import features.dungeon.domain.core.projection.DungeonDerivedState;
import features.dungeon.domain.core.projection.DungeonDerivedStateProjection;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.room.Room;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomClusterFloorMap;
import features.dungeon.domain.core.structure.room.RoomClusterRoomPartition;
import features.dungeon.domain.core.structure.room.RoomClusterWork;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;

final class DungeonFloorInvariantScenarios {


    private DungeonFloorInvariantScenarios() {
    }

    static void run() {
        assertStructureComposesFloorMap();

        assertFloorCellNormalization();

        assertRoomAssignmentUsesFloorMap();

        assertFloorAnchorDerivationAndReuse();

        assertFloorReplacementByConstruction();

        assertDungeonLevelFloorProjection();

    }

    private static void assertStructureComposesFloorMap() {
        RoomCluster cluster = RoomCluster.fromCells(3L, 9L, Set.of(
                new Cell(1, 1, 0),
                new Cell(2, 1, 0),
                new Cell(1, 1, 1)));

        assertEquals(List.of(new Cell(1, 1, 0), new Cell(2, 1, 0)),
                cluster.floorMap().cellsAt(0),
                "cluster exposes level-zero cells through floor owner");
        assertEquals(cluster.floorMap().cellsByLevel(), cluster.cellsByLevel(),
                "cluster compatibility access delegates to floor owner");
        assertEquals(cluster.floorMap(),
                new RoomClusterFloorMap(FloorCellMap.fromCells(cluster.floorMap().allCells())),
                "cluster floor facade delegates to the reusable component floor owner");
    }

    private static void assertFloorCellNormalization() {
        java.util.List<Cell> cells = new java.util.ArrayList<>(List.of(
                new Cell(2, 0, 1),
                new Cell(3, 2, 0),
                new Cell(1, 1, 0),
                new Cell(1, 1, 0)));
        cells.add(null);
        FloorCellMap floorMap = FloorCellMap.fromCells(cells);

        assertEquals(Map.of(
                        0, List.of(new Cell(1, 1, 0), new Cell(3, 2, 0)),
                        1, List.of(new Cell(2, 0, 1))),
                floorMap.cellsByLevel(),
                "floor owner normalizes duplicate unordered cells by level");
        assertEquals(List.of(0, 1), new java.util.ArrayList<>(floorMap.cellsByLevel().keySet()),
                "floor owner exposes deterministic level iteration order");
        assertEquals(floorMap,
                FloorCellMap.fromCells(List.of(
                        new Cell(1, 1, 0),
                        new Cell(2, 0, 1),
                        new Cell(3, 2, 0))),
                "floor owner value equality follows normalized cells");
    }

    private static void assertRoomAssignmentUsesFloorMap() {
        Cell left = new Cell(0, 0, 0);
        Cell middle = new Cell(1, 0, 0);
        Cell right = new Cell(2, 0, 0);
        RoomCluster cluster = RoomCluster.fromCells(9L, 2L, Set.of(right, left, middle));
        List<Room> rooms = List.of(
                new Room(7L, 2L, 9L, "Bestand", Map.of(0, left)),
                new Room(20L, 2L, 9L, "Split", Map.of(0, middle)));

        assertEquals(Map.of(
                        7L, List.of(left),
                        20L, List.of(middle, right)),
                RoomClusterRoomPartition.cellsByRoom(
                        cluster,
                        rooms,
                        Map.of(0, List.of(Edge.sideOf(left, Direction.EAST)))),
                "room assignment partitions every floor-owned cell exactly once");
    }

    private static void assertFloorAnchorDerivationAndReuse() {
        Cell upperFirst = new Cell(1, 0, 1);
        Cell upperLater = new Cell(2, 0, 1);
        Cell lowerFirst = new Cell(0, 0, 0);
        Cell lowerLater = new Cell(1, 0, 0);
        RoomCluster cluster = RoomCluster.fromCells(9L, 2L, Set.of(upperLater, lowerLater, upperFirst, lowerFirst));
        RoomClusterWork work = new RoomClusterWork(cluster, List.of(new Room(
                7L,
                2L,
                9L,
                "Bestand",
                Map.of(0, lowerFirst, 1, upperFirst))));

        assertEquals(Map.of(0, lowerFirst, 1, upperFirst),
                Room.anchorsByLevel(cluster.floorMap().cellsByLevel()),
                "floor owner derives one sorted anchor per owned floor level");

        Edge split = Edge.sideOf(lowerFirst, Direction.EAST);
        List<Room> splitRooms = RoomClusterRoomPartition.roomsForBoundaryEdit(
                work,
                Map.of(0, List.of(split)),
                20L);
        assertEquals(7L, splitRooms.getFirst().roomId(),
                "floor owner reuses surviving room id when its anchor remains in a component");
        assertEquals(Map.of(0, lowerFirst), splitRooms.getFirst().floorAnchors(),
                "floor owner preserves surviving room anchor after partition");
        assertEquals(20L, splitRooms.get(1).roomId(),
                "floor owner allocates a deterministic room id for a new split component");
        assertEquals(Map.of(0, lowerLater), splitRooms.get(1).floorAnchors(),
                "floor owner anchors new split component at sorted first cell");
        assertEquals(Map.of(1, upperFirst), splitRooms.get(2).floorAnchors(),
                "floor owner derives an anchor for the remaining upper-level component");
    }

    private static void assertFloorReplacementByConstruction() {
        FloorCellMap floorMap = FloorCellMap.fromCells(List.of(new Cell(0, 0, 0)));
        FloorCellMap same = new FloorCellMap(Map.of(0, List.of(new Cell(0, 0, 0))));
        FloorCellMap changed = new FloorCellMap(Map.of(0, List.of(new Cell(0, 0, 0), new Cell(1, 0, 0))));

        assertEquals(floorMap, same,
                "floor owner exposes unchanged replacement as equal value construction");
        assertFalse(floorMap.equals(changed),
                "floor owner exposes changed replacement as different value construction");
        assertEquals(List.of(new Cell(0, 0, 0), new Cell(1, 0, 0)),
                changed.cellsAt(0),
                "floor replacement value exposes the next owned cells");
    }

    private static void assertDungeonLevelFloorProjection() {
        DungeonMap map = projectionMap();
        DungeonDerivedState derived = new DungeonDerivedStateProjection().project(map);
        Set<Set<Cell>> projectedRooms = roomAreaCellSets(derived);

        assertTrue(projectedRooms.contains(Set.of(
                        new Cell(1, 1, 0),
                        new Cell(2, 1, 0))),
                "floor projection includes first structure-owned room floor cells");
        assertTrue(projectedRooms.contains(Set.of(
                        new Cell(5, 1, 0),
                        new Cell(6, 1, 0))),
                "floor projection includes second structure-owned room floor cells");
        assertEquals(2, projectedRooms.size(),
                "floor projection builds one read-side room area per authored structure cluster");

        DungeonAreaFacts firstArea = firstRoomArea(derived);
        assertThrowsUnsupported(
                () -> firstArea.cells().add(new Cell(99, 99, 0)),
                "floor projection exposes immutable read-side cell facts");
        assertEquals(projectedRooms, roomAreaCellSets(derived),
                "rejected projection mutation leaves derived floor facts unchanged");

        DungeonMap changed = map.paintRoomRectangle(new Cell(10, 1, 0), new Cell(10, 1, 0));
        Set<Set<Cell>> changedRooms =
                roomAreaCellSets(new DungeonDerivedStateProjection().project(changed));
        assertTrue(changedRooms.contains(Set.of(new Cell(10, 1, 0))),
                "floor projection changes only after routing mutation through DungeonMap structure ownership");
        assertEquals(projectedRooms, roomAreaCellSets(derived),
                "original floor projection remains a snapshot after authored structure mutation");
    }

    private static DungeonMap projectionMap() {
        return DungeonMapAuthoring.empty(new DungeonMapIdentity(80L), "Floor Projection")
                .paintRoomRectangle(new Cell(1, 1, 0), new Cell(2, 1, 0))
                .paintRoomRectangle(new Cell(5, 1, 0), new Cell(6, 1, 0));
    }

    private static Set<Set<Cell>> roomAreaCellSets(DungeonDerivedState derived) {
        java.util.LinkedHashSet<Set<Cell>> result = new java.util.LinkedHashSet<>();
        for (DungeonAreaFacts area : derived.map().areas()) {
            if (area.kind() == DungeonAreaType.ROOM) {
                result.add(Set.copyOf(area.cells()));
            }
        }
        return Set.copyOf(result);
    }

    private static DungeonAreaFacts firstRoomArea(DungeonDerivedState derived) {
        for (DungeonAreaFacts area : derived.map().areas()) {
            if (area.kind() == DungeonAreaType.ROOM) {
                return area;
            }
        }
        throw new IllegalStateException("Expected at least one projected room area.");
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
