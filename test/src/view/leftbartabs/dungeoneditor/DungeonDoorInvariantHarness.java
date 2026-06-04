package src.view.leftbartabs.dungeoneditor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.door.Door;
import src.domain.dungeon.model.core.structure.door.DoorBoundaryMaterialization;
import src.domain.dungeon.model.core.structure.door.DoorIndex;
import src.domain.dungeon.model.core.structure.room.RoomCluster;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization;
import src.domain.dungeon.model.core.structure.room.RoomClusterFloorMap;
import src.domain.dungeon.model.core.structure.room.RoomClusterWallMap;

final class DungeonDoorInvariantHarness {

    private static final String OWNER = "DoorInvariantHarness";

    private DungeonDoorInvariantHarness() {
    }

    static void run(List<String> results) {
        assertDoorLocalFacts();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-DOOR-001",
                "Door owner preserves stable id, room/cluster relation, boundary location, and direction");
        assertDoorIndex();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-DOOR-002",
                "Door index owns boundary lookup, uniqueness, null filtering, and deterministic ordering");
        assertDoorMaterialization();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-DOOR-003",
                "Door owner consumes floor/wall boundary facts for door materialization eligibility");
        assertDoorDeletePolicy();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-DOOR-004",
                "Door index rejects corridor-bound deletes and exposes restored wall boundary state for unbound doors");
    }

    private static void assertDoorLocalFacts() {
        Door invalid = new Door(-1L, -2L, -3L, new Cell(0, 0, 0), Direction.NORTH);
        Door door = new Door(7L, 11L, 42L, new Cell(2, 3, 1), Direction.EAST);

        assertEquals(0L, invalid.doorId(), "door owner normalizes invalid stable door id");
        assertEquals(0L, invalid.roomId(), "door owner normalizes invalid room id");
        assertEquals(0L, invalid.clusterId(), "door owner normalizes invalid cluster id");
        assertEquals(7L, door.doorId(), "door owner preserves stable door id");
        assertEquals(11L, door.roomId(), "door owner preserves room relation");
        assertEquals(42L, door.clusterId(), "door owner preserves cluster relation");
        assertEquals(new Cell(2, 3, 1), door.relativeCell(), "door owner preserves boundary cell");
        assertEquals(Direction.EAST, door.direction(), "door owner preserves wall-facing direction");
        assertEquals(Door.BoundaryState.Kind.DOOR, door.doorBoundaryState().kind(),
                "door owner publishes door boundary state");
        assertEquals(Door.BoundaryState.Kind.WALL, door.restoredWallState().kind(),
                "door owner publishes restored wall boundary state");
        assertThrows(
                () -> new Door(1L, 2L, 3L, null, Direction.NORTH),
                "door owner rejects missing boundary cell");
        assertThrows(
                () -> new Door(1L, 2L, 3L, new Cell(0, 0, 0), null),
                "door owner rejects missing direction");
    }

    private static void assertDoorIndex() {
        Door first = new Door(7L, 11L, 42L, new Cell(2, 3, 1), Direction.EAST);
        Door duplicate = new Door(9L, 13L, 42L, new Cell(2, 3, 1), Direction.EAST);
        Door later = new Door(8L, 12L, 42L, new Cell(2, 4, 1), Direction.SOUTH);
        ArrayList<Door> doors = new ArrayList<>(List.of(later, duplicate, first));
        doors.add(null);
        DoorIndex index = DoorIndex.from(doors);
        RoomCluster cluster = new RoomCluster(
                42L,
                4L,
                new Cell(0, 0, 0),
                RoomClusterFloorMap.fromCells(List.of(new Cell(0, 0, 0))),
                new RoomClusterWallMap(new Cell(0, 0, 0), List.of()),
                index);

        assertEquals(List.of(first, later), index.doors(),
                "door index filters null rows, sorts deterministically, and keeps one door per boundary");
        assertEquals(index, cluster.doorIndex(), "room cluster composes the door owner");
        assertEquals(first, index.doorAt(42L, new Cell(2, 3, 1), Direction.EAST).orElseThrow(),
                "door index returns stable identity for boundary lookup");
        assertTrue(index.doorAt(42L, new Cell(2, 3, 1), Direction.NORTH).isEmpty(),
                "door index lookup includes direction in the boundary key");
        assertEquals(index, index.withDoor(duplicate), "door index rejects duplicate boundary insertion");
        assertEquals(new DoorIndex(List.of(first, later, new Door(10L, 14L, 42L, new Cell(3, 4, 1), Direction.WEST))),
                index.withDoor(new Door(10L, 14L, 42L, new Cell(3, 4, 1), Direction.WEST)),
                "door index accepts distinct boundary insertion");
    }

    private static void assertDoorMaterialization() {
        Map<Long, List<Cell>> singleRoomCells = Map.of(
                1L,
                List.of(new Cell(0, 0, 0)));
        Map<Long, List<Cell>> splitRoomCells = Map.of(
                1L,
                List.of(new Cell(0, 0, 0)),
                2L,
                List.of(new Cell(1, 0, 0)));
        Edge northEdge = Edge.sideOf(new Cell(0, 0, 0), Direction.NORTH);
        Edge eastEdge = Edge.sideOf(new Cell(0, 0, 0), Direction.EAST);

        assertTrue(DoorBoundaryMaterialization.forEdge(
                        northEdge,
                        singleRoomCells,
                        DoorBoundaryMaterialization.ExistingBoundaryKind.NONE)
                .materializesDoor(), "door owner allows single-room wall door creation");
        assertFalse(DoorBoundaryMaterialization.forEdge(
                        northEdge,
                        singleRoomCells,
                        DoorBoundaryMaterialization.ExistingBoundaryKind.DOOR)
                .materializesDoor(), "door owner rejects existing door materialization");
        assertFalse(DoorBoundaryMaterialization.forEdge(
                        eastEdge,
                        splitRoomCells,
                        DoorBoundaryMaterialization.ExistingBoundaryKind.NONE)
                .materializesDoor(), "door owner rejects split-room edge without boundary");
        assertTrue(DoorBoundaryMaterialization.forEdge(
                        eastEdge,
                        splitRoomCells,
                        DoorBoundaryMaterialization.ExistingBoundaryKind.NON_DOOR)
                .materializesDoor(), "door owner converts split-room non-door boundary");
        assertFalse(DoorBoundaryMaterialization.forEdge(
                        Edge.sideOf(new Cell(8, 8, 0), Direction.NORTH),
                        singleRoomCells,
                        DoorBoundaryMaterialization.ExistingBoundaryKind.NONE)
                .materializesDoor(), "door owner rejects untouched room edge");
    }

    private static void assertDoorDeletePolicy() {
        Door door = new Door(7L, 11L, 42L, new Cell(2, 3, 1), Direction.EAST);
        Door sameBoundaryDifferentIdentity = new Door(17L, 11L, 42L, new Cell(2, 3, 1), Direction.EAST);
        Door unbound = new Door(8L, 12L, 42L, new Cell(2, 4, 1), Direction.SOUTH);
        DoorIndex index = new DoorIndex(List.of(door, unbound));

        assertFalse(index.canDelete(door, true),
                "door index rejects corridor-bound door delete");
        assertEquals(index, index.withoutDoor(door, true),
                "door index preserves corridor-bound door");
        assertTrue(index.canDelete(unbound, false),
                "door index allows unbound door delete");
        assertFalse(index.canDelete(sameBoundaryDifferentIdentity, false),
                "door index rejects delete by boundary-matching but different local door identity");
        assertFalse(index.canDelete(new Door(19L, 12L, 42L, new Cell(9, 9, 1), Direction.NORTH), false),
                "door index rejects missing boundary delete without throwing");
        assertEquals(new DoorIndex(List.of(door)), index.withoutDoor(unbound, false),
                "door index removes only unbound door");
        assertEquals(Door.BoundaryState.Kind.WALL, unbound.restoredWallState().kind(),
                "door owner restores unbound delete to wall boundary state");
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

    private static void assertThrows(Runnable action, String message) {
        try {
            action.run();
        } catch (NullPointerException expected) {
            return;
        }
        throw new IllegalStateException(message);
    }
}
