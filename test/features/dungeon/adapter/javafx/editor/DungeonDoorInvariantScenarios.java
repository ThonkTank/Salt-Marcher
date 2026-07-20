package features.dungeon.adapter.javafx.editor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.DungeonMapMetadata;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.corridor.CorridorBindings;
import features.dungeon.domain.core.component.CorridorDoorBinding;
import features.dungeon.domain.core.structure.door.Door;
import features.dungeon.domain.core.structure.door.DoorBoundaryMaterialization;
import features.dungeon.domain.core.structure.door.DoorIndex;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.DungeonRoomNarration;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomCatalog;
import features.dungeon.domain.core.component.boundary.BoundaryKind;
import features.dungeon.domain.core.structure.stair.StairCollection;
import features.dungeon.domain.core.structure.topology.SpatialTopology;
import features.dungeon.domain.core.structure.transition.TransitionCatalog;

final class DungeonDoorInvariantScenarios {


    private DungeonDoorInvariantScenarios() {
    }

    static void run() {
        assertDoorLocalFacts();

        assertDoorIndex();

        assertDoorMaterialization();

        assertDoorDeletePolicy();

        assertDoorMoveAtomicity();

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
        assertEquals(new Cell(2, 3, 1), door.roomCell(), "door owner preserves absolute room cell");
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
        assertEquals(List.of(first, later), index.doors(),
                "door index filters null rows, sorts deterministically, and keeps one door per boundary");
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

    private static void assertDoorMoveAtomicity() {
        DungeonMap source = doorMoveMapWithWallTarget();
        DungeonMap moved = source.moveDoorBinding(20L, 0, 11L, 0, 1, 0);

        assertFalse(source.equals(moved), "door move changes the aggregate for a valid target");
        assertEquals(
                new Cell(1, 1, 0),
                moved.corridors().getFirst().bindings().doorBindings().getFirst().roomCell(),
                "door move updates the corridor door binding to the moved boundary cell");
        assertTrue(boundaryIs(moved, new Cell(1, 0, 0), Direction.EAST, BoundaryKind.WALL),
                "door move restores the old authored room boundary to wall");
        assertTrue(boundaryIs(moved, new Cell(1, 1, 0), Direction.EAST, BoundaryKind.DOOR),
                "door move materializes the target authored room boundary as door");
        assertEquals(
                DungeonTopologyRef.door(200L),
                boundaryRef(moved, new Cell(1, 1, 0), Direction.EAST),
                "door move preserves the stable door topology ref on the moved boundary");

        DungeonMap missingTarget = source.moveDoorBinding(20L, 0, 11L, 0, 4, 0);
        assertEquals(source, missingTarget,
                "invalid door move rejects without moving the corridor binding away from the room boundary");
        DungeonMap duplicateSource = doorMoveMapWithDuplicateTargetDoor();
        DungeonMap duplicateTarget = duplicateSource.moveDoorBinding(20L, 0, 11L, 0, 1, 0);
        assertEquals(duplicateSource, duplicateTarget,
                "duplicate target door move rejects without orphaning the source handle");
    }

    private static DungeonMap doorMoveMapWithWallTarget() {
        return doorMoveMap(false);
    }

    private static DungeonMap doorMoveMapWithDuplicateTargetDoor() {
        return doorMoveMap(true);
    }

    private static DungeonMap doorMoveMap(boolean duplicateDoorAtTarget) {
        long mapId = 1L;
        long clusterId = 42L;
        long roomId = 11L;
        DungeonTopologyRef doorRef = DungeonTopologyRef.door(200L);
        List<BoundarySegment> boundaries = List.of(
                BoundarySegment.fromEdge(
                        Direction.EAST.edgeOf(new Cell(1, 0, 0)),
                        BoundaryKind.DOOR,
                        doorRef),
                BoundarySegment.fromEdge(
                        Direction.EAST.edgeOf(new Cell(1, 1, 0)),
                        duplicateDoorAtTarget ? BoundaryKind.DOOR : BoundaryKind.WALL,
                        duplicateDoorAtTarget ? DungeonTopologyRef.door(201L) : DungeonTopologyRef.wall(201L)));
        RoomCluster cluster = RoomCluster.authored(
                clusterId,
                mapId,
                "R1",
                boundaries);
        RoomRegion room = new RoomRegion(
                roomId, mapId, clusterId, "R1",
                java.util.Set.of(
                        new Cell(0, 0, 0), new Cell(0, 1, 0),
                        new Cell(1, 0, 0), new Cell(1, 1, 0)),
                DungeonRoomNarration.empty());
        Corridor corridor = new Corridor(
                20L,
                mapId,
                0,
                List.of(roomId),
                new CorridorBindings(
                        List.of(),
                        List.of(new CorridorDoorBinding(
                                roomId,
                                clusterId,
                                new Cell(1, 0, 0),
                                Direction.EAST,
                                doorRef)),
                        List.of(),
                        List.of()));
        return new DungeonMap(
                new DungeonMapMetadata(new DungeonMapIdentity(mapId), "Door Move Invariant"),
                SpatialTopology.defaultGrid().withRoomClusters(List.of(cluster)),
                new RoomCatalog(List.of(room)),
                List.of(corridor),
                new StairCollection(List.of()),
                new TransitionCatalog(List.of()),
                0L);
    }

    private static boolean boundaryIs(DungeonMap map, Cell roomCell, Direction direction, BoundaryKind kind) {
        BoundarySegment boundary = map.topology().roomClusters().getFirst()
                .boundaryAt(direction.edgeOf(roomCell));
        return boundary != null && boundary.kind() == kind;
    }

    private static DungeonTopologyRef boundaryRef(DungeonMap map, Cell roomCell, Direction direction) {
        RoomCluster cluster = map.topology().roomClusters().getFirst();
        BoundarySegment boundary = cluster.boundaryAt(direction.edgeOf(roomCell));
        return boundary == null ? DungeonTopologyRef.empty() : boundary.resolvedTopologyRef();
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
