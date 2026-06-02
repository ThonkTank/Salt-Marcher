package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import src.domain.dungeon.model.core.model.component.CorridorAnchor;
import src.domain.dungeon.model.core.model.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.model.component.CorridorDoorBinding;
import src.domain.dungeon.model.core.model.component.CorridorWaypoint;
import src.domain.dungeon.model.core.model.geometry.Cell;
import src.domain.dungeon.model.core.model.geometry.Direction;
import src.domain.dungeon.model.core.model.structure.Corridor;
import src.domain.dungeon.model.core.model.structure.CorridorBindings;
import src.domain.dungeon.model.core.model.structure.CorridorRoomSet;
import src.domain.dungeon.model.core.model.structure.CorridorRoutePlan;
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
                "Corridor structure owns room-set normalization/removal, binding container rules, "
                        + "door removal by room, anchor binding/ref replacement by local anchor id, "
                        + "and target-local waypoint or anchor-ref removal rules");
        assertWorldspaceAdapterPreservesTopologyRefIdentity();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-STR-002",
                "Transitional corridor bindings adapter preserves anchor and surviving door topology-ref identity "
                        + "without moving topology ownership into core structure");
        assertCorridorRoutePlanInvariants();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-STR-003",
                "Corridor structure owns interior route-anchor selection and waypoint planning while topology "
                        + "identity remains adapter-owned");
        assertCorridorTargetDeleteInvariants();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-STR-004",
                "Corridor structure owns target-local door, anchor, and waypoint delete behavior while topology "
                        + "identity remains adapter-owned");
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
        assertEquals(List.of(4L, 8L), rooms.without(2L).roomIds(), "room set removes room");
        assertEquals(rooms, rooms.without(0L), "room set ignores missing room removal");

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
        assertEquals(List.of(secondDoor), replaced.withoutDoorBindingForRoom(4L).doorBindings(),
                "door delete by room");
        assertEquals(List.of(waypoint), replaced.waypoints(), "door replacement keeps waypoints");
        assertEquals(List.of(firstAnchor), replaced.anchorBindings(), "door replacement keeps anchors");
        assertEquals(List.of(firstRef), replaced.anchorRefs(), "door replacement keeps anchor refs");

        CorridorBindings withAnchors = replaced
                .withAnchorBinding(secondAnchor)
                .withAnchorRef(secondRef);
        assertEquals(List.of(firstAnchor, secondAnchor), withAnchors.anchorBindings(), "anchors append by id");
        assertEquals(List.of(firstRef, secondRef), withAnchors.anchorRefs(), "anchor refs append by id");
        CorridorAnchor replacementAnchor = new CorridorAnchor(3L, 20L, new Cell(8, 9, 0));
        assertEquals(List.of(secondAnchor, replacementAnchor),
                withAnchors.withAnchorBinding(replacementAnchor).anchorBindings(),
                "anchor binding replacement by anchor id");
        CorridorAnchorRef replacementRef = new CorridorAnchorRef(20L, 3L);
        assertEquals(List.of(secondRef, replacementRef), withAnchors.withAnchorRef(replacementRef).anchorRefs(),
                "anchor ref replacement by anchor id");
        assertEquals(List.of(firstRef), withAnchors.withoutAnchorRef(5L).anchorRefs(), "anchor ref delete by id");
        assertEquals(List.of(), withAnchors.withoutAnchorRefAndRouteWaypoints(5L).waypoints(),
                "anchor target delete clears route waypoints");
        assertEquals(List.of(), withAnchors.withoutWaypoint(0).waypoints(), "waypoint delete by index");
        assertEquals(List.of(), withAnchors.waypointsBetweenEndpointIndexes(-1, 2),
                "invalid endpoint indexes keep no pruned waypoints");
        assertEquals(List.of(), withAnchors.waypointsBetweenEndpointIndexes(0, 1),
                "adjacent endpoint indexes keep no pruned waypoints");
        CorridorWaypoint secondWaypoint = new CorridorWaypoint(8L, new Cell(3, 4, 0), 1);
        CorridorWaypoint thirdWaypoint = new CorridorWaypoint(9L, new Cell(4, 5, 0), 2);
        CorridorBindings twoWaypointBindings = withAnchors.withWaypoints(List.of(waypoint, secondWaypoint));
        assertEquals(List.of(), twoWaypointBindings.waypointsBetweenEndpointIndexes(0, 2),
                "one-past non-adjacent endpoint index keeps no pruned waypoints");
        CorridorBindings threeWaypointBindings =
                withAnchors.withWaypoints(List.of(waypoint, secondWaypoint, thirdWaypoint));
        assertEquals(List.of(secondWaypoint), threeWaypointBindings.waypointsBetweenEndpointIndexes(0, 2),
                "non-adjacent endpoint indexes prune interior waypoints");

        assertWorldspaceCorridorRoomSetAdapterCompatibility();
    }

    private static void assertCorridorRoutePlanInvariants() {
        CorridorRoutePlan plan = new CorridorRoutePlan(
                List.of(new Cell(0, 0, 0), new Cell(1, 0, 0), new Cell(2, 0, 0)),
                10L,
                new Cell(0, 0, 0));
        CorridorAnchor higherHostAnchor = new CorridorAnchor(9L, 30L, new Cell(1, 0, 0));
        CorridorAnchor selectedAnchor = new CorridorAnchor(5L, 20L, new Cell(1, 0, 0));
        CorridorBindings planned = plan.bindInteriorAnchors(
                CorridorBindings.empty(),
                List.of(higherHostAnchor, selectedAnchor));
        assertEquals(List.of(new CorridorAnchorRef(20L, 5L)), planned.anchorRefs(),
                "route plan selects lowest host/anchor at interior cell");
        assertEquals(List.of(new CorridorWaypoint(10L, new Cell(1, 0, 0), 0)), planned.waypoints(),
                "route plan creates relative interior waypoint");
        assertEquals(CorridorBindings.empty(),
                new CorridorRoutePlan(
                        List.of(new Cell(0, 0, 0), new Cell(1, 0, 0)),
                        10L,
                        new Cell(0, 0, 0))
                        .bindInteriorAnchors(CorridorBindings.empty(), List.of(selectedAnchor)),
                "short route plan leaves bindings unchanged");
        assertEquals(CorridorBindings.empty(),
                new CorridorRoutePlan(
                        List.of(new Cell(0, 0, 0), new Cell(1, 0, 0), new Cell(2, 0, 0)),
                        0L,
                        new Cell(0, 0, 0))
                        .bindInteriorAnchors(CorridorBindings.empty(), List.of(selectedAnchor)),
                "missing waypoint cluster leaves bindings unchanged");
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

        DungeonCorridorDoorBinding removedDoor = new DungeonCorridorDoorBinding(
                4L,
                10L,
                new DungeonCell(0, 1, 0),
                DungeonEdgeDirection.NORTH,
                src.domain.dungeon.model.worldspace.model.DungeonTopologyRef.door(40L));
        DungeonCorridorDoorBinding survivingDoor = new DungeonCorridorDoorBinding(
                6L,
                11L,
                new DungeonCell(2, 3, 0),
                DungeonEdgeDirection.EAST,
                src.domain.dungeon.model.worldspace.model.DungeonTopologyRef.door(60L));
        DungeonCorridorBindings doorBindings =
                new DungeonCorridorBindings(List.of(), List.of(removedDoor, survivingDoor), List.of(), List.of());
        DungeonCorridorBindings afterDoorRemoval = new DungeonCorridor(
                3L,
                5L,
                0,
                List.of(4L, 6L),
                doorBindings)
                .withoutDoorTarget(removedDoor, false, -1, -1)
                .bindings();
        assertEquals(List.of(survivingDoor), afterDoorRemoval.doorBindings(),
                "adapter door removal preserves surviving door topology ref");

        src.domain.dungeon.model.worldspace.model.DungeonTopologyRef splitAnchorRef =
                src.domain.dungeon.model.worldspace.model.DungeonTopologyRef.corridorAnchor(70L);
        src.domain.dungeon.model.worldspace.model.DungeonCorridorAnchorBinding splitAnchor =
                new src.domain.dungeon.model.worldspace.model.DungeonCorridorAnchorBinding(
                        7L,
                        40L,
                        new DungeonCell(1, 0, 0),
                        splitAnchorRef);
        DungeonCorridorBindings splitBindings = DungeonCorridorBindings.empty().withInteriorRouteAnchors(
                new CorridorRoutePlan(
                        List.of(new Cell(0, 0, 0), new Cell(1, 0, 0), new Cell(2, 0, 0)),
                        10L,
                        new Cell(0, 0, 0)),
                List.of(splitAnchor));
        assertEquals(List.of(new src.domain.dungeon.model.worldspace.model.DungeonCorridorAnchorRef(40L, splitAnchorRef)),
                splitBindings.anchorRefs(),
                "adapter route split preserves selected anchor topology ref");
        DungeonCorridorBindings existingCustomRef = DungeonCorridorBindings.empty().withAnchorRef(
                new src.domain.dungeon.model.worldspace.model.DungeonCorridorAnchorRef(40L, splitAnchorRef));
        DungeonCorridorBindings deduplicatedSplitBindings = existingCustomRef.withInteriorRouteAnchors(
                new CorridorRoutePlan(
                        List.of(new Cell(0, 0, 0), new Cell(1, 0, 0), new Cell(2, 0, 0)),
                        10L,
                        new Cell(0, 0, 0)),
                List.of(splitAnchor));
        assertEquals(List.of(new src.domain.dungeon.model.worldspace.model.DungeonCorridorAnchorRef(40L, splitAnchorRef)),
                deduplicatedSplitBindings.anchorRefs(),
                "adapter route split deduplicates existing custom topology ref");
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
        assertEquals(List.of(4L, 6L), corridor.withDoorBinding(secondDoor).roomIds(),
                "adapter corridor adds door room through core room set");
    }

    private static void assertCorridorTargetDeleteInvariants() {
        CorridorWaypoint firstWaypoint = new CorridorWaypoint(7L, new Cell(1, 2, 0), 0);
        CorridorWaypoint secondWaypoint = new CorridorWaypoint(7L, new Cell(2, 2, 0), 0);
        CorridorWaypoint thirdWaypoint = new CorridorWaypoint(7L, new Cell(3, 2, 0), 0);
        CorridorDoorBinding firstDoor = new CorridorDoorBinding(4L, 10L, new Cell(0, 1, 0), Direction.NORTH);
        CorridorDoorBinding secondDoor = new CorridorDoorBinding(6L, 11L, new Cell(2, 3, 0), Direction.EAST);
        CorridorAnchorRef anchorRef = new CorridorAnchorRef(12L, 5L);
        Corridor corridor = new Corridor(
                3L,
                9L,
                0,
                List.of(4L, 6L),
                new CorridorBindings(
                        List.of(firstWaypoint, secondWaypoint, thirdWaypoint),
                        List.of(firstDoor, secondDoor),
                        List.of(),
                        List.of(anchorRef)));

        Corridor withoutDoor = corridor.withoutDoorTarget(firstDoor, true, 0, 2);
        assertEquals(List.of(6L), withoutDoor.roomIds(), "core door target delete removes room");
        assertEquals(List.of(secondDoor), withoutDoor.bindings().doorBindings(),
                "core door target delete removes door binding");
        assertEquals(List.of(secondWaypoint), withoutDoor.bindings().waypoints(),
                "core door target delete prunes branch waypoints");

        Corridor withoutDoorWithoutEndpointFacts = corridor.withoutDoorTarget(firstDoor, false, -1, -1);
        assertEquals(List.of(firstWaypoint, secondWaypoint, thirdWaypoint),
                withoutDoorWithoutEndpointFacts.bindings().waypoints(),
                "core door target delete preserves waypoints when adapter lacks endpoint facts");

        Corridor withoutAnchor = corridor.withoutAnchorTarget(5L);
        assertEquals(List.of(), withoutAnchor.bindings().anchorRefs(), "core anchor target delete removes anchor ref");
        assertEquals(List.of(), withoutAnchor.bindings().waypoints(), "core anchor target delete clears route waypoints");
        assertEquals(List.of(firstWaypoint, thirdWaypoint),
                corridor.withoutWaypointTarget(1).bindings().waypoints(),
                "core waypoint target delete removes selected waypoint");

        assertWorldspaceCorridorTargetDeleteAdapterCompatibility();
    }

    private static void assertWorldspaceCorridorTargetDeleteAdapterCompatibility() {
        src.domain.dungeon.model.worldspace.model.DungeonTopologyRef customAnchorRef =
                src.domain.dungeon.model.worldspace.model.DungeonTopologyRef.corridorAnchor(70L);
        DungeonCorridorBindings bindings = new DungeonCorridorBindings(
                List.of(new src.domain.dungeon.model.worldspace.model.DungeonCorridorWaypoint(
                        7L,
                        new DungeonCell(1, 2, 0),
                        0)),
                List.of(),
                List.of(),
                List.of(new src.domain.dungeon.model.worldspace.model.DungeonCorridorAnchorRef(12L, customAnchorRef)));
        DungeonCorridor corridor = new DungeonCorridor(3L, 9L, 0, List.of(), bindings);
        DungeonCorridor withoutAnchor = corridor.withoutAnchorTarget(customAnchorRef.id());
        assertEquals(List.of(), withoutAnchor.bindings().anchorRefs(),
                "adapter anchor target delete follows topology ref id");
        assertEquals(List.of(), withoutAnchor.bindings().waypoints(),
                "adapter anchor target delete clears route waypoints through core");

        DungeonCorridorDoorBinding firstDoor = new DungeonCorridorDoorBinding(
                4L,
                10L,
                new DungeonCell(0, 1, 0),
                DungeonEdgeDirection.NORTH,
                src.domain.dungeon.model.worldspace.model.DungeonTopologyRef.door(40L));
        DungeonCorridorDoorBinding secondDoor = new DungeonCorridorDoorBinding(
                6L,
                11L,
                new DungeonCell(2, 3, 0),
                DungeonEdgeDirection.EAST,
                src.domain.dungeon.model.worldspace.model.DungeonTopologyRef.door(60L));
        DungeonCorridor doorCorridor = new DungeonCorridor(
                4L,
                9L,
                0,
                List.of(4L, 6L),
                new DungeonCorridorBindings(List.of(), List.of(firstDoor, secondDoor), List.of(), List.of()));
        assertEquals(List.of(secondDoor),
                doorCorridor.withoutDoorTarget(firstDoor, false, -1, -1).bindings().doorBindings(),
                "adapter door target delete preserves surviving topology ref");
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
