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
import src.domain.dungeon.model.core.structure.room.RoomClusterWork;
import src.domain.dungeon.model.core.projection.DungeonAreaFacts;
import src.domain.dungeon.model.core.projection.DungeonAreaType;
import src.domain.dungeon.model.worldspace.DungeonCell;
import src.domain.dungeon.model.worldspace.DungeonDerivedState;
import src.domain.dungeon.model.worldspace.DungeonDerivedStateProjection;
import src.domain.dungeon.model.worldspace.DungeonMap;
import src.domain.dungeon.model.worldspace.DungeonMapAuthoring;
import src.domain.dungeon.model.worldspace.DungeonMapIdentity;

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
        assertFloorAnchorDerivationAndReuse();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-FLOOR-004",
                "Floor owner derives deterministic room floor anchors and reuses surviving room anchors");
        assertFloorMutationResult();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-FLOOR-005",
                "Floor owner reports no-op and changed floor mutations while DungeonMap keeps revision policy outside the owner");
        assertDungeonLevelFloorProjection();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-FLOOR-006",
                "Dungeon-level floor facts are immutable projections derived from structure-owned floor maps");
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
        assertEquals(Map.of(0, lowerFirst, 1, upperFirst),
                work.rebuiltRoom().orElseThrow().floorAnchors(),
                "floor owner rebuild keeps anchors derived from the owned floor map");

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

    private static void assertDungeonLevelFloorProjection() {
        DungeonMap map = projectionMap();
        DungeonDerivedState derived = new DungeonDerivedStateProjection().project(map);
        Set<Set<DungeonCell>> projectedRooms = roomAreaCellSets(derived);

        assertTrue(projectedRooms.contains(Set.of(
                        new DungeonCell(1, 1, 0),
                        new DungeonCell(2, 1, 0))),
                "floor projection includes first structure-owned room floor cells");
        assertTrue(projectedRooms.contains(Set.of(
                        new DungeonCell(5, 1, 0),
                        new DungeonCell(6, 1, 0))),
                "floor projection includes second structure-owned room floor cells");
        assertEquals(2, projectedRooms.size(),
                "floor projection builds one read-side room area per authored structure cluster");

        DungeonAreaFacts firstArea = firstRoomArea(derived);
        assertThrowsUnsupported(
                () -> firstArea.cells().add(new DungeonCell(99, 99, 0)),
                "floor projection exposes immutable read-side cell facts");
        assertEquals(projectedRooms, roomAreaCellSets(derived),
                "rejected projection mutation leaves derived floor facts unchanged");

        DungeonMap changed = map.paintRoomRectangle(new DungeonCell(10, 1, 0), new DungeonCell(10, 1, 0));
        Set<Set<DungeonCell>> changedRooms =
                roomAreaCellSets(new DungeonDerivedStateProjection().project(changed));
        assertTrue(changedRooms.contains(Set.of(new DungeonCell(10, 1, 0))),
                "floor projection changes only after routing mutation through DungeonMap structure ownership");
        assertEquals(projectedRooms, roomAreaCellSets(derived),
                "original floor projection remains a snapshot after authored structure mutation");
    }

    private static DungeonMap projectionMap() {
        return DungeonMapAuthoring.empty(new DungeonMapIdentity(80L), "Floor Projection")
                .paintRoomRectangle(new DungeonCell(1, 1, 0), new DungeonCell(2, 1, 0))
                .paintRoomRectangle(new DungeonCell(5, 1, 0), new DungeonCell(6, 1, 0));
    }

    private static Set<Set<DungeonCell>> roomAreaCellSets(DungeonDerivedState derived) {
        java.util.LinkedHashSet<Set<DungeonCell>> result = new java.util.LinkedHashSet<>();
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
