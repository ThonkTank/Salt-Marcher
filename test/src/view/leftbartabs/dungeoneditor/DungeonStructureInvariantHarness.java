package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import src.domain.dungeon.model.core.model.component.CorridorAnchor;
import src.domain.dungeon.model.core.model.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.model.component.CorridorDoorBinding;
import src.domain.dungeon.model.core.model.component.CorridorWaypoint;
import src.domain.dungeon.model.core.model.geometry.Cell;
import src.domain.dungeon.model.core.model.geometry.Direction;
import src.domain.dungeon.model.core.model.structure.CorridorBindings;
import src.domain.dungeon.model.core.model.structure.CorridorRoomSet;
import src.domain.dungeon.model.worldspace.model.DungeonCell;
import src.domain.dungeon.model.worldspace.model.DungeonCorridor;
import src.domain.dungeon.model.worldspace.model.DungeonCorridorBindings;
import src.domain.dungeon.model.worldspace.model.DungeonCorridorDoorBinding;
import src.domain.dungeon.model.worldspace.model.DungeonEdgeDirection;

final class DungeonStructureInvariantHarness {

    private static final String OWNER = "DungeonStructureInvariantHarness";

    private DungeonStructureInvariantHarness() {
    }

    static void run(List<String> results) {
        assertCorridorStructureInvariants();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-STR-001",
                "Corridor structure owns room-set, binding container, and target-local removal rules");
    }

    private static void assertCorridorStructureInvariants() {
        List<Long> mixedRoomIds = new java.util.ArrayList<>(List.of(4L, 2L, 4L, -1L, 8L));
        mixedRoomIds.add(1, null);
        CorridorRoomSet rooms = new CorridorRoomSet(mixedRoomIds);
        assertEquals(List.of(4L, 2L, 8L), rooms.roomIds(), "room id normalization");
        assertTrue(rooms.connects(2L), "room set connects positive room");
        assertFalse(rooms.connects(0L), "room set rejects non-positive room");
        assertEquals(List.of(4L, 2L, 8L, 9L), rooms.withAdded(9L).roomIds(), "room set adds new room");
        assertEquals(rooms, rooms.withAdded(2L), "room set ignores duplicate room");

        CorridorWaypoint waypoint = new CorridorWaypoint(7L, new Cell(1, 2, 0), 0);
        CorridorDoorBinding firstDoor = new CorridorDoorBinding(4L, 10L, new Cell(0, 1, 0), Direction.NORTH);
        CorridorDoorBinding secondDoor = new CorridorDoorBinding(6L, 11L, new Cell(2, 3, 0), Direction.EAST);
        CorridorAnchor firstAnchor = new CorridorAnchor(3L, 12L, new Cell(4, 5, 0));
        CorridorAnchor secondAnchor = new CorridorAnchor(5L, 12L, new Cell(6, 7, 0));
        CorridorAnchorRef firstRef = new CorridorAnchorRef(12L, 3L);
        CorridorAnchorRef secondRef = new CorridorAnchorRef(12L, 5L);
        CorridorBindings bindings = new CorridorBindings(
                List.of(waypoint),
                List.of(firstDoor, secondDoor),
                List.of(firstAnchor),
                List.of(firstRef));
        CorridorDoorBinding replacement = new CorridorDoorBinding(4L, 12L, new Cell(5, 6, 0), Direction.SOUTH);
        CorridorBindings replaced = bindings.withDoorBinding(replacement);
        assertEquals(List.of(secondDoor, replacement), replaced.doorBindings(), "door replacement by room");
        assertEquals(List.of(waypoint), replaced.waypoints(), "door replacement keeps waypoints");
        assertEquals(List.of(firstAnchor), replaced.anchorBindings(), "door replacement keeps anchors");
        assertEquals(List.of(firstRef), replaced.anchorRefs(), "door replacement keeps anchor refs");

        CorridorBindings withAnchors = replaced
                .withAnchorBinding(secondAnchor)
                .withAnchorRef(secondRef);
        assertEquals(List.of(firstAnchor, secondAnchor), withAnchors.anchorBindings(), "anchors append by id");
        assertEquals(List.of(firstRef, secondRef), withAnchors.anchorRefs(), "anchor refs append by id");
        assertEquals(List.of(firstRef), withAnchors.withoutAnchorRef(5L).anchorRefs(), "anchor ref delete by id");
        assertEquals(List.of(), withAnchors.withoutAnchorRefAndRouteWaypoints(5L).waypoints(),
                "anchor target delete clears route waypoints");
        assertEquals(List.of(), withAnchors.withoutWaypoint(0).waypoints(), "waypoint delete by index");

        assertWorldspaceAdapterPreservesTopologyRefIdentity();
        CorridorBindings sanitized = replaced.sanitizedForRooms(new CorridorRoomSet(List.of(4L)));
        assertEquals(List.of(replacement), sanitized.doorBindings(), "sanitized door bindings follow room set");
        assertEquals(List.of(waypoint), sanitized.waypoints(), "sanitized bindings keep route waypoints");
        assertEquals(CorridorBindings.empty(), replaced.sanitizedForRooms(new CorridorRoomSet(List.of())),
                "empty room set clears corridor bindings");

        assertWorldspaceCorridorRoomSetAdapterCompatibility();
    }

    private static void assertWorldspaceAdapterPreservesTopologyRefIdentity() {
        src.domain.dungeon.model.worldspace.model.DungeonTopologyRef stableRef =
                src.domain.dungeon.model.worldspace.model.DungeonTopologyRef.corridorAnchor(30L);
        src.domain.dungeon.model.worldspace.model.DungeonCorridorAnchorBinding first =
                new src.domain.dungeon.model.worldspace.model.DungeonCorridorAnchorBinding(
                        3L,
                        12L,
                        new DungeonCell(1, 1, 0),
                        stableRef);
        src.domain.dungeon.model.worldspace.model.DungeonCorridorAnchorBinding replacement =
                new src.domain.dungeon.model.worldspace.model.DungeonCorridorAnchorBinding(
                        5L,
                        12L,
                        new DungeonCell(2, 2, 0),
                        stableRef);
        DungeonCorridorBindings bindings = new DungeonCorridorBindings(List.of(), List.of(), List.of(first), List.of());

        DungeonCorridorBindings replaced = bindings.withAnchorBinding(replacement);
        assertEquals(List.of(replacement), replaced.anchorBindings(),
                "adapter anchor replacement follows topology ref when anchor id differs");

        src.domain.dungeon.model.worldspace.model.DungeonCorridorAnchorRef firstRef =
                new src.domain.dungeon.model.worldspace.model.DungeonCorridorAnchorRef(12L, stableRef);
        src.domain.dungeon.model.worldspace.model.DungeonCorridorAnchorRef replacementRef =
                new src.domain.dungeon.model.worldspace.model.DungeonCorridorAnchorRef(20L, stableRef);
        DungeonCorridorBindings refBindings =
                new DungeonCorridorBindings(List.of(), List.of(), List.of(), List.of(firstRef));
        assertEquals(List.of(replacementRef), refBindings.withAnchorRef(replacementRef).anchorRefs(),
                "adapter anchor ref replacement follows topology ref when host id differs");
    }

    private static void assertWorldspaceCorridorRoomSetAdapterCompatibility() {
        DungeonCorridorDoorBinding secondDoor = new DungeonCorridorDoorBinding(
                6L, 11L, new DungeonCell(2, 3, 0), DungeonEdgeDirection.EAST, null);
        DungeonCorridorBindings bindings = new DungeonCorridorBindings(
                List.of(),
                List.of(new DungeonCorridorDoorBinding(
                        4L, 10L, new DungeonCell(0, 1, 0), DungeonEdgeDirection.NORTH, null)),
                List.of(),
                List.of());

        List<Long> adapterRoomIds = new java.util.ArrayList<>(List.of(4L, 4L, -1L));
        adapterRoomIds.add(1, null);
        DungeonCorridor corridor = new DungeonCorridor(3L, 5L, 0, adapterRoomIds, bindings);
        assertEquals(List.of(4L), corridor.roomIds(), "adapter corridor delegates room set normalization");
        assertTrue(corridor.connectsRoom(4L), "adapter corridor connects normalized room");
        assertEquals(List.of(4L, 6L), corridor.withDoorBinding(secondDoor).roomIds(),
                "adapter corridor adds door room through core room set");
    }

    private static void assertTrue(boolean condition, String label) {
        if (!condition) {
            throw new IllegalStateException(label + " expected true");
        }
    }

    private static void assertFalse(boolean condition, String label) {
        if (condition) {
            throw new IllegalStateException(label + " expected false");
        }
    }

    private static void assertEquals(Object expected, Object actual, String label) {
        if (!expected.equals(actual)) {
            throw new IllegalStateException(label + " expected " + expected + " but was " + actual);
        }
    }
}
