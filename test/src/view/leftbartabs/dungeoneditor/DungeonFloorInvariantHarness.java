package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.room.Room;
import src.domain.dungeon.model.core.structure.room.RoomCluster;
import src.domain.dungeon.model.core.structure.room.RoomClusterFloorMap;
import src.domain.dungeon.model.core.structure.room.RoomClusterRoomPartition;

final class DungeonFloorInvariantHarness {

    private static final String OWNER = "FloorInvariantHarness";

    private DungeonFloorInvariantHarness() {
    }

    static void run(List<String> results) {
        assertStructureComposesFloorMap();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-FLOOR-001",
                "Room clusters compose one authoritative floor owner for structure-local floor cells");
        assertFloorCellNormalization();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-FLOOR-002",
                "Floor owner deduplicates cells, groups by level, and exposes deterministic ordering");
        assertRoomAssignmentUsesFloorMap();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-FLOOR-003",
                "Room-cell assignment derives from the cluster floor owner and closed boundary facts");
        assertFloorMutationResult();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-FLOOR-005",
                "Floor owner reports no-op and changed floor mutations while DungeonMap keeps revision policy outside the owner");
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
    }

    private static void assertFloorCellNormalization() {
        java.util.List<Cell> cells = new java.util.ArrayList<>(List.of(
                new Cell(2, 0, 1),
                new Cell(3, 2, 0),
                new Cell(1, 1, 0),
                new Cell(1, 1, 0)));
        cells.add(null);
        RoomClusterFloorMap floorMap = RoomClusterFloorMap.fromCells(cells);

        assertEquals(Map.of(
                        0, List.of(new Cell(1, 1, 0), new Cell(3, 2, 0)),
                        1, List.of(new Cell(2, 0, 1))),
                floorMap.cellsByLevel(),
                "floor owner normalizes duplicate unordered cells by level");
        assertEquals(List.of(0, 1), new java.util.ArrayList<>(floorMap.cellsByLevel().keySet()),
                "floor owner exposes deterministic level iteration order");
        assertEquals(floorMap,
                RoomClusterFloorMap.fromCells(List.of(
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

    private static void assertFloorMutationResult() {
        RoomClusterFloorMap floorMap = RoomClusterFloorMap.fromCells(List.of(new Cell(0, 0, 0)));

        assertFalse(floorMap.replaceCellsByLevel(Map.of(0, List.of(new Cell(0, 0, 0)))).changed(),
                "floor owner reports unchanged replacement as no-op");
        RoomClusterFloorMap.FloorMutation changed =
                floorMap.replaceCellsByLevel(Map.of(0, List.of(new Cell(0, 0, 0), new Cell(1, 0, 0))));
        assertTrue(changed.changed(), "floor owner reports changed replacement");
        assertEquals(List.of(new Cell(0, 0, 0), new Cell(1, 0, 0)),
                changed.floorMap().cellsAt(0),
                "floor mutation returns the next floor owner");
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
