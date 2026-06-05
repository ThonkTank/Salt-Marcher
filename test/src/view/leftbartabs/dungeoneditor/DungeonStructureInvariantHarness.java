package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import src.domain.dungeon.model.core.component.CorridorAnchor;
import src.domain.dungeon.model.core.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.component.CorridorDoorBinding;
import src.domain.dungeon.model.core.component.CorridorWaypoint;
import src.domain.dungeon.model.core.component.StairExit;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorAnchorEndpointMaterialization;
import src.domain.dungeon.model.core.structure.corridor.CorridorAnchorSnap;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindings;
import src.domain.dungeon.model.core.structure.corridor.CorridorEndpointBinding;
import src.domain.dungeon.model.core.structure.corridor.CorridorEndpointSemantics;
import src.domain.dungeon.model.core.structure.corridor.CorridorHostCells;
import src.domain.dungeon.model.core.structure.corridor.CorridorNetwork;
import src.domain.dungeon.model.core.structure.corridor.CorridorResolvedEndpoint;
import src.domain.dungeon.model.core.structure.corridor.CorridorRoomSet;
import src.domain.dungeon.model.core.structure.corridor.CorridorRoutePlan;
import src.domain.dungeon.model.core.structure.door.DoorBoundaryMaterialization;
import src.domain.dungeon.model.core.structure.room.Room;
import src.domain.dungeon.model.core.structure.room.RoomCluster;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryOrdering;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryStretchPlan;
import src.domain.dungeon.model.core.structure.room.RoomClusterDoorBoundaryMaterialization;
import src.domain.dungeon.model.core.structure.room.RoomClusterRoomPartition;
import src.domain.dungeon.model.core.structure.room.RoomClusterWork;
import src.domain.dungeon.model.core.structure.stair.Stair;
import src.domain.dungeon.model.core.structure.stair.StairGeometrySpec;
import src.domain.dungeon.model.core.structure.stair.StairShape;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.AuthoredTransitionLink;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.TransitionEndpoint;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.TransitionLinkDirectionality;
import src.domain.dungeon.model.worldspace.DungeonCorridor;
import src.domain.dungeon.model.worldspace.DungeonCorridorBindings;
import src.domain.dungeon.model.worldspace.DungeonCorridorDoorBinding;

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
                        + "resolved endpoint shape, door removal by room, anchor binding/ref replacement by local anchor id, "
                        + "anchor snapping/materialization to the nearest host cell with level/row/column tie-breaks "
                        + "and fallback behavior, host-cell lookup by corridor id, "
                        + "plus target-local waypoint or anchor-ref removal rules");
        assertWorldspaceAdapterPreservesTopologyRefIdentity();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-STR-002",
                "Transitional corridor bindings adapter preserves anchor topology-ref identity "
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
                "Corridor structure owns target-local door, anchor, and waypoint delete behavior");
        assertCorridorNetworkDeleteInvariants();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-STR-005",
                "Corridor network owns protected corridor delete and detached-anchor pruning while the transitional "
                        + "adapter preserves topology-ref identity");
        assertStairStructureInvariants();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-STR-006",
                "Stair structure owns editor shape support, dimensions, generated path/exits, readability, "
                        + "recompute, and room-interior geometry predicates");
        assertTransitionStructureInvariants();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-STR-007",
                "Transition structure keeps transition compatibility while Transition owner owns local facts, links, "
                        + "and protected delete policy");
        assertRoomStructureInvariants();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-STR-008",
                "Room structure keeps door-boundary materialization compatibility while Door owner owns "
                        + "door policy");
        assertRoomBoundaryMaterializationInvariants();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-STR-009",
                "Room structure keeps boundary-row materialization compatibility while Wall owner owns wall/open policy");
        assertRoomPartitionInvariants();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-STR-010",
                "Room structure owns closed-boundary room partitioning, room-id reuse, and room-cell assignment");
        assertRoomBoundaryOrderingInvariants();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-STR-011",
                "Room structure keeps boundary-row ordering compatibility while Wall owner owns row normalization");
        assertRoomBoundaryStretchPlanInvariants();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-STR-012",
                "Room structure keeps stretch-plan compatibility while Wall owner owns wall-map stretch behavior");
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
        assertThrowsIllegalArgument(
                () -> new CorridorEndpointBinding(null, null),
                "corridor endpoint rejects empty shape");
        assertThrowsIllegalArgument(
                () -> new CorridorEndpointBinding(firstDoor, firstRef),
                "corridor endpoint rejects combined door and anchor shape");
        assertThrowsIllegalArgument(
                () -> CorridorEndpointBinding.forAnchor(new CorridorAnchorRef(0L, 0L)),
                "corridor endpoint rejects missing anchor ref shape");
        assertThrowsIllegalArgument(
                () -> new CorridorResolvedEndpoint(null,
                        CorridorEndpointBinding.forDoor(firstDoor),
                        CorridorEndpointSemantics.forDoor(firstDoor)),
                "resolved corridor endpoint rejects missing door room id");
        assertThrowsIllegalArgument(
                () -> new CorridorResolvedEndpoint(4L,
                        CorridorEndpointBinding.forAnchor(firstRef),
                        CorridorEndpointSemantics.forAnchor(firstRef)),
                "resolved corridor endpoint rejects anchor room id");
        assertThrowsIllegalArgument(
                () -> new CorridorResolvedEndpoint(4L,
                        CorridorEndpointBinding.forDoor(firstDoor),
                        CorridorEndpointSemantics.forAnchor(firstRef)),
                "resolved corridor endpoint rejects door with anchor semantics");
        assertThrowsIllegalArgument(
                () -> new CorridorResolvedEndpoint(null,
                        CorridorEndpointBinding.forAnchor(firstRef),
                        CorridorEndpointSemantics.forStableDoor(7L)),
                "resolved corridor endpoint rejects anchor with stable door semantics");
        assertEquals(
                firstDoor,
                CorridorResolvedEndpoint.forDoor(firstDoor, CorridorEndpointSemantics.forDoor(firstDoor))
                        .binding()
                        .doorBinding(),
                "resolved corridor endpoint exposes core door binding");
        assertEquals(
                new Cell(1, 2, 1),
                CorridorAnchorSnap.nearestHostCell(
                        new Cell(2, 2, 1),
                        List.of(new Cell(0, 2, 1), new Cell(1, 2, 1))),
                "corridor anchor snap selects nearest host cell");
        assertEquals(
                new Cell(2, 2, 0),
                CorridorAnchorSnap.nearestHostCell(
                        new Cell(2, 2, 1),
                        List.of(new Cell(2, 2, 2), new Cell(2, 2, 0))),
                "corridor anchor snap breaks distance ties by level");
        assertEquals(
                new Cell(2, 1, 1),
                CorridorAnchorSnap.nearestHostCell(
                        new Cell(2, 2, 1),
                        List.of(new Cell(2, 3, 1), new Cell(2, 1, 1))),
                "corridor anchor snap breaks distance ties by row");
        assertEquals(
                new Cell(1, 2, 1),
                CorridorAnchorSnap.nearestHostCell(
                        new Cell(2, 2, 1),
                        List.of(new Cell(3, 2, 1), new Cell(1, 2, 1))),
                "corridor anchor snap breaks distance ties by column");
        assertEquals(
                new Cell(0, 0, 0),
                CorridorAnchorSnap.nearestHostCell(null, List.of()),
                "corridor anchor snap keeps missing desired cell at origin");
        CorridorHostCells hostCells = new CorridorHostCells(java.util.Map.of(
                9L,
                List.of(new Cell(4, 4, 0), new Cell(2, 2, 0))));
        assertEquals(List.of(new Cell(4, 4, 0), new Cell(2, 2, 0)), hostCells.cellsFor(9L),
                "corridor host cells preserve host cell order");
        assertEquals(new Cell(2, 2, 0), hostCells.snapToHostCell(9L, new Cell(3, 2, 0)),
                "corridor host cells snap by host corridor id");
        Corridor hostCorridor = new Corridor(9L, 1L, 0, List.of(), CorridorBindings.empty());
        CorridorAnchorEndpointMaterialization createdAnchor =
                CorridorAnchorEndpointMaterialization.materialize(
                        List.of(hostCorridor),
                        9L,
                        new Cell(3, 2, 0),
                        0L,
                        hostCells);
        assertTrue(createdAnchor != null, "corridor anchor endpoint creates host anchor");
        createdAnchor = Objects.requireNonNull(createdAnchor);
        assertEquals(new CorridorAnchor(1L, 9L, new Cell(2, 2, 0)), createdAnchor.anchor(),
                "corridor anchor endpoint materialization snaps created anchor");
        assertEquals(List.of(new CorridorAnchor(1L, 9L, new Cell(2, 2, 0))),
                createdAnchor.corridors().getFirst().bindings().anchorBindings(),
                "corridor anchor endpoint materialization updates host corridor");
        assertTrue(createdAnchor.changed(), "corridor anchor endpoint reports created anchor change");
        CorridorAnchorEndpointMaterialization reusedById =
                CorridorAnchorEndpointMaterialization.materialize(
                        createdAnchor.corridors(),
                        9L,
                        new Cell(4, 4, 0),
                        1L,
                        hostCells);
        assertTrue(reusedById != null, "corridor anchor endpoint reuses preferred anchor id");
        reusedById = Objects.requireNonNull(reusedById);
        assertEquals(new CorridorAnchor(1L, 9L, new Cell(2, 2, 0)), reusedById.anchor(),
                "corridor anchor endpoint keeps preferred anchor position");
        assertFalse(reusedById.changed(), "corridor anchor endpoint reports preferred anchor reuse as unchanged");
        CorridorAnchorEndpointMaterialization reusedByPosition =
                CorridorAnchorEndpointMaterialization.materialize(
                        createdAnchor.corridors(),
                        9L,
                        new Cell(2, 2, 0),
                        0L,
                        hostCells);
        assertTrue(reusedByPosition != null, "corridor anchor endpoint reuses snapped position");
        reusedByPosition = Objects.requireNonNull(reusedByPosition);
        assertEquals(new CorridorAnchor(1L, 9L, new Cell(2, 2, 0)), reusedByPosition.anchor(),
                "corridor anchor endpoint keeps matching-position anchor");
        assertFalse(reusedByPosition.changed(), "corridor anchor endpoint reports position reuse as unchanged");
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
        src.domain.dungeon.model.core.graph.DungeonTopologyRef stableRef =
                src.domain.dungeon.model.core.graph.DungeonTopologyRef.corridorAnchor(30L);
        src.domain.dungeon.model.worldspace.DungeonCorridorAnchorBinding first =
                new src.domain.dungeon.model.worldspace.DungeonCorridorAnchorBinding(
                        3L,
                        12L,
                        new Cell(1, 1, 0),
                        stableRef);
        src.domain.dungeon.model.worldspace.DungeonCorridorAnchorBinding replacement =
                new src.domain.dungeon.model.worldspace.DungeonCorridorAnchorBinding(
                        5L,
                        12L,
                        new Cell(2, 2, 0),
                        stableRef);
        DungeonCorridorBindings bindings = new DungeonCorridorBindings(List.of(), List.of(), List.of(first), List.of());

        DungeonCorridorBindings replaced = bindings.replaceAnchorBindings(List.of(replacement));
        assertEquals(List.of(replacement), replaced.anchorBindings(),
                "adapter anchor replacement follows topology ref when anchor id differs");

        CorridorAnchorRef firstRef = new CorridorAnchorRef(12L, stableRef.id());
        CorridorAnchorRef replacementRef = new CorridorAnchorRef(20L, stableRef.id());
        CorridorBindings refBindings =
                new CorridorBindings(List.of(), List.of(), List.of(), List.of(firstRef));
        assertEquals(List.of(replacementRef), refBindings.withAnchorRef(replacementRef).anchorRefs(),
                "core anchor ref replacement follows topology ref when host id differs");

        src.domain.dungeon.model.core.graph.DungeonTopologyRef splitAnchorRef =
                src.domain.dungeon.model.core.graph.DungeonTopologyRef.corridorAnchor(70L);
        src.domain.dungeon.model.worldspace.DungeonCorridorAnchorBinding splitAnchor =
                new src.domain.dungeon.model.worldspace.DungeonCorridorAnchorBinding(
                        7L,
                        40L,
                        new Cell(1, 0, 0),
                        splitAnchorRef);
        DungeonCorridorBindings splitBindings = DungeonCorridorBindings.empty().withInteriorRouteAnchors(
                new CorridorRoutePlan(
                        List.of(new Cell(0, 0, 0), new Cell(1, 0, 0), new Cell(2, 0, 0)),
                        10L,
                        new Cell(0, 0, 0)),
                List.of(splitAnchor));
        assertEquals(List.of(new CorridorAnchorRef(40L, splitAnchorRef.id())),
                splitBindings.anchorRefs(),
                "adapter route split preserves selected anchor topology ref");
        DungeonCorridorBindings existingCustomRef = new DungeonCorridorBindings(
                List.of(),
                List.of(),
                List.of(),
                List.of(new CorridorAnchorRef(40L, splitAnchorRef.id())));
        DungeonCorridorBindings deduplicatedSplitBindings = existingCustomRef.withInteriorRouteAnchors(
                new CorridorRoutePlan(
                        List.of(new Cell(0, 0, 0), new Cell(1, 0, 0), new Cell(2, 0, 0)),
                        10L,
                        new Cell(0, 0, 0)),
                List.of(splitAnchor));
        assertEquals(List.of(new CorridorAnchorRef(40L, splitAnchorRef.id())),
                deduplicatedSplitBindings.anchorRefs(),
                "adapter route split deduplicates existing custom topology ref");
    }

    private static void assertWorldspaceCorridorRoomSetAdapterCompatibility() {
        CorridorDoorBinding secondDoor = new CorridorDoorBinding(6L, 11L, new Cell(2, 3, 0), Direction.EAST);
        DungeonCorridorBindings bindings = new DungeonCorridorBindings(
                List.of(),
                List.of(new DungeonCorridorDoorBinding(
                        4L, 10L, new Cell(0, 1, 0), Direction.NORTH, null)),
                List.of(),
                List.of());

        List<Long> adapterRoomIds = new java.util.ArrayList<>(List.of(4L, 4L, -1L));
        adapterRoomIds.add(1, null);
        DungeonCorridor corridor = new DungeonCorridor(3L, 5L, 0, adapterRoomIds, bindings);
        assertEquals(List.of(4L), corridor.roomIds(), "adapter corridor delegates room set normalization");
        Corridor coreCorridor = new Corridor(corridor.corridorId(), corridor.mapId(), corridor.level(), corridor.roomIds(), CorridorBindings.empty());
        assertEquals(List.of(4L, 6L), coreCorridor.withDoorBinding(secondDoor).roomIds(),
                "core corridor adds door room through core room set");
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
    }

    private static void assertCorridorNetworkDeleteInvariants() {
        CorridorAnchor ownedAnchor = new CorridorAnchor(70L, 10L, new Cell(6, 5, 0));
        CorridorAnchor detachedAnchor = new CorridorAnchor(71L, 10L, new Cell(6, 6, 0));
        Corridor owner = new Corridor(
                10L,
                3L,
                0,
                List.of(),
                new CorridorBindings(List.of(), List.of(), List.of(ownedAnchor, detachedAnchor), List.of()));
        Corridor dependent = new Corridor(
                20L,
                3L,
                0,
                List.of(),
                new CorridorBindings(List.of(), List.of(), List.of(), List.of(new CorridorAnchorRef(10L, 70L))));
        Corridor orphanRef = new Corridor(
                30L,
                3L,
                0,
                List.of(),
                new CorridorBindings(List.of(), List.of(), List.of(), List.of(new CorridorAnchorRef(99L, 99L))));
        CorridorNetwork network = new CorridorNetwork(List.of(owner, dependent, orphanRef));

        assertFalse(network.canDeleteCorridor(10L), "core network protects referenced owner corridor");
        assertTrue(network.canDeleteCorridor(20L), "core network allows deleting dependent corridor");
        assertEquals(List.of(10L, 20L, 30L), corridorIds(network.withoutCorridor(10L)),
                "protected owner corridor remains in core network");
        assertEquals(List.of(10L, 30L), corridorIds(network.withoutCorridor(20L)),
                "deletable corridor is removed from core network");
        CorridorNetwork prunedNetwork = network.withoutDetachedAnchors();
        Corridor prunedOwner = prunedNetwork.corridors().getFirst();
        Corridor prunedOrphanRef = prunedNetwork.corridors().get(2);
        assertEquals(List.of(ownedAnchor), prunedOwner.bindings().anchorBindings(),
                "core network prunes detached owned anchors");
        assertEquals(List.of(), prunedOrphanRef.bindings().anchorRefs(),
                "core network prunes refs to missing hosted anchors");

        assertWorldspaceCorridorNetworkAdapterCompatibility();
    }

    private static List<Long> corridorIds(CorridorNetwork network) {
        List<Long> result = new java.util.ArrayList<>();
        for (Corridor corridor : network.corridors()) {
            result.add(corridor.corridorId());
        }
        return List.copyOf(result);
    }

    private static void assertWorldspaceCorridorNetworkAdapterCompatibility() {
        src.domain.dungeon.model.core.graph.DungeonTopologyRef stableRef =
                src.domain.dungeon.model.core.graph.DungeonTopologyRef.corridorAnchor(70L);
        src.domain.dungeon.model.core.graph.DungeonTopologyRef detachedRef =
                src.domain.dungeon.model.core.graph.DungeonTopologyRef.corridorAnchor(71L);
        src.domain.dungeon.model.worldspace.DungeonCorridorAnchorBinding referencedAnchor =
                new src.domain.dungeon.model.worldspace.DungeonCorridorAnchorBinding(
                        7L,
                        10L,
                        new Cell(6, 5, 0),
                        stableRef);
        src.domain.dungeon.model.worldspace.DungeonCorridorAnchorBinding detachedAnchor =
                new src.domain.dungeon.model.worldspace.DungeonCorridorAnchorBinding(
                        8L,
                        10L,
                        new Cell(6, 6, 0),
                        detachedRef);
        DungeonCorridor owner = new DungeonCorridor(
                10L,
                3L,
                0,
                List.of(),
                new DungeonCorridorBindings(List.of(), List.of(), List.of(referencedAnchor, detachedAnchor), List.of()));
        DungeonCorridor dependent = new DungeonCorridor(
                20L,
                3L,
                0,
                List.of(),
                new DungeonCorridorBindings(
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(new CorridorAnchorRef(10L, stableRef.id()))));
        src.domain.dungeon.model.worldspace.DungeonCorridorAnchorPruningRules pruningRules =
                new src.domain.dungeon.model.worldspace.DungeonCorridorAnchorPruningRules();

        assertEquals(List.of(referencedAnchor),
                pruningRules.pruneDetachedAnchors(List.of(owner, dependent)).getFirst().bindings().anchorBindings(),
                "adapter pruning preserves referenced anchor by topology ref");
    }

    private static void assertRoomStructureInvariants() {
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

        assertTrue(RoomClusterDoorBoundaryMaterialization.forEdge(
                        northEdge,
                        singleRoomCells,
                        DoorBoundaryMaterialization.ExistingBoundaryKind.NONE)
                .materializesDoor(), "core room door materialization allows single-room wall creation");
        assertFalse(RoomClusterDoorBoundaryMaterialization.forEdge(
                        northEdge,
                        singleRoomCells,
                        DoorBoundaryMaterialization.ExistingBoundaryKind.DOOR)
                .materializesDoor(), "core room door materialization rejects existing door no-op");
        assertFalse(RoomClusterDoorBoundaryMaterialization.forEdge(
                        eastEdge,
                        splitRoomCells,
                        DoorBoundaryMaterialization.ExistingBoundaryKind.NONE)
                .materializesDoor(), "core room door materialization rejects split-room edge without boundary");
        assertTrue(RoomClusterDoorBoundaryMaterialization.forEdge(
                        eastEdge,
                        splitRoomCells,
                        DoorBoundaryMaterialization.ExistingBoundaryKind.NON_DOOR)
                .materializesDoor(), "core room door materialization converts split-room non-door boundary");
        assertFalse(RoomClusterDoorBoundaryMaterialization.forEdge(
                        Edge.sideOf(new Cell(8, 8, 0), Direction.NORTH),
                        singleRoomCells,
                        DoorBoundaryMaterialization.ExistingBoundaryKind.NONE)
                .materializesDoor(), "core room door materialization rejects untouched room edge");
    }

    private static void assertRoomBoundaryMaterializationInvariants() {
        Set<Cell> clusterCells = Set.of(new Cell(2, 3, 0), new Cell(3, 3, 0));
        Cell center = new Cell(2, 3, 0);
        Edge northEdge = Edge.sideOf(new Cell(2, 3, 0), Direction.NORTH);
        Edge sharedEdge = Edge.sideOf(new Cell(2, 3, 0), Direction.EAST);

        BoundaryRow northBoundary = RoomClusterBoundaryMaterialization.forEdge(
                clusterCells,
                center,
                42L,
                northEdge,
                RoomClusterBoundaryMaterialization.BoundaryKind.WALL);
        assertTrue(northBoundary != null, "core room boundary materializes perimeter wall row");
        assertEquals(42L, northBoundary.clusterId(), "core room boundary keeps cluster id");
        assertEquals(0, northBoundary.level(), "core room boundary uses base-cell level");
        assertEquals(new Cell(0, 0, 0), northBoundary.relativeCell(), "core room boundary stores center-relative cell");
        assertEquals(Direction.NORTH, northBoundary.direction(), "core room boundary derives direction from edge");
        assertEquals(RoomClusterBoundaryMaterialization.BoundaryKind.WALL, northBoundary.kind(),
                "core room boundary preserves requested kind");

        BoundaryRow doorBoundary = RoomClusterBoundaryMaterialization.forEdge(
                clusterCells,
                center,
                42L,
                northEdge,
                RoomClusterBoundaryMaterialization.BoundaryKind.DOOR);
        assertTrue(doorBoundary != null, "core room boundary materializes perimeter door row");
        assertEquals(RoomClusterBoundaryMaterialization.BoundaryKind.DOOR, doorBoundary.kind(),
                "core room boundary preserves requested door kind");

        BoundaryRow openBoundary = RoomClusterBoundaryMaterialization.openForEdge(
                clusterCells,
                center,
                42L,
                northEdge);
        assertTrue(openBoundary != null, "core room boundary materializes perimeter open row");
        assertEquals(null, RoomClusterBoundaryMaterialization.openForEdge(
                        clusterCells,
                        center,
                        42L,
                        sharedEdge),
                "core room open boundary rejects split-room interior edge");
        assertEquals(RoomClusterBoundaryMaterialization.BoundaryKind.OPEN, openBoundary.kind(),
                "core room open boundary accepts perimeter edge");
        assertEquals(null, RoomClusterBoundaryMaterialization.forEdge(
                        clusterCells,
                        center,
                        42L,
                        new Edge(new Cell(1, 1, 0), new Cell(2, 1, 1)),
                        RoomClusterBoundaryMaterialization.BoundaryKind.WALL),
                "core room boundary rejects cross-level edge");
        assertEquals(null, RoomClusterBoundaryMaterialization.forEdge(
                        clusterCells,
                        center,
                        42L,
                        Edge.sideOf(new Cell(8, 8, 0), Direction.NORTH),
                        RoomClusterBoundaryMaterialization.BoundaryKind.WALL),
                "core room boundary rejects untouched edge");
    }

    private static void assertRoomPartitionInvariants() {
        Cell left = new Cell(0, 0, 0);
        Cell middle = new Cell(1, 0, 0);
        Cell right = new Cell(2, 0, 0);
        Edge split = Edge.sideOf(left, Direction.EAST);
        RoomCluster cluster = new RoomCluster(9L, 2L, left, Map.of(0, List.of(left, middle, right)));
        Room existingRoom = new Room(7L, 2L, 9L, "Bestand", Map.of(0, left));
        RoomClusterWork work = new RoomClusterWork(cluster, List.of(existingRoom));

        List<Room> rooms = RoomClusterRoomPartition.roomsForBoundaryEdit(
                work,
                Map.of(0, List.of(split)),
                20L);
        assertEquals(List.of(7L, 20L), roomIds(rooms), "core room partition reuses anchor room and reserves split room");
        assertEquals(Map.of(0, left), rooms.getFirst().floorAnchors(),
                "core room partition preserves existing room anchor");
        assertEquals(Map.of(0, middle), rooms.get(1).floorAnchors(),
                "core room partition anchors new component at sorted first cell");
        assertEquals(Map.of(
                        7L, List.of(left),
                        20L, List.of(middle, right)),
                RoomClusterRoomPartition.cellsByRoom(cluster, rooms, Map.of(0, List.of(split))),
                "core room partition assigns cells behind closed boundaries");
    }

    private static void assertRoomBoundaryOrderingInvariants() {
        Cell center = new Cell(5, 7, 0);
        BoundaryRow south = new BoundaryRow(
                42L,
                0,
                new Cell(0, 1, 0),
                Direction.SOUTH,
                RoomClusterBoundaryMaterialization.BoundaryKind.WALL);
        BoundaryRow north = new BoundaryRow(
                42L,
                0,
                new Cell(0, 0, 0),
                Direction.NORTH,
                RoomClusterBoundaryMaterialization.BoundaryKind.DOOR);
        BoundaryRow east = new BoundaryRow(
                42L,
                0,
                new Cell(0, 0, 0),
                Direction.EAST,
                RoomClusterBoundaryMaterialization.BoundaryKind.OPEN);
        BoundaryRow upper = new BoundaryRow(
                42L,
                1,
                new Cell(-1, 0, 1),
                Direction.WEST,
                RoomClusterBoundaryMaterialization.BoundaryKind.WALL);

        assertEquals(
                List.of(east, north, south, upper),
                RoomClusterBoundaryOrdering.sortedRows(List.of(south, upper, north, east)),
                "core room boundary ordering sorts by level, row, column, direction name");
        Map<Integer, List<BoundaryRow>> rowsByLevel =
                RoomClusterBoundaryOrdering.boundariesByLevel(List.of(south, upper, north, east));
        assertEquals(List.of(east, north, south), rowsByLevel.get(0),
                "core room boundary ordering groups sorted rows by level");
        assertEquals(List.of(upper), rowsByLevel.get(1),
                "core room boundary ordering preserves upper level rows");

        assertEquals(
                EdgeKey.from(Edge.sideOf(new Cell(5, 7, 0), Direction.NORTH)),
                RoomClusterBoundaryOrdering.boundaryKey(center, north),
                "core room boundary ordering keys rows by center-relative absolute edge");
        EdgeKey northKey = EdgeKey.from(Edge.sideOf(new Cell(5, 7, 0), Direction.NORTH));
        assertTrue(northKey.stableId() > 0L,
                "core room boundary ordering produces positive stable edge ids");
        assertEquals(
                northKey,
                new EdgeKey(northKey.upper(), northKey.lower()),
                "core geometry edge key canonicalizes reversed endpoints");
        assertEquals(
                northKey.stableId(),
                new EdgeKey(northKey.upper(), northKey.lower()).stableId(),
                "core geometry edge key keeps stable ids endpoint-order independent");
        assertEquals(
                northKey.stableId(),
                DungeonBoundaryKey.from(
                        src.domain.dungeon.model.core.geometry.Edge.sideOf(
                                new Cell(5, 7, 0),
                                Direction.NORTH))
                        .stableId(),
                "boundary key stable ids match core geometry");
    }

    private static void assertRoomBoundaryStretchPlanInvariants() {
        Cell left = new Cell(0, 0, 0);
        Cell right = new Cell(1, 0, 0);
        Edge northLeft = Edge.sideOf(left, Direction.NORTH);
        Edge northRight = Edge.sideOf(right, Direction.NORTH);
        Map<EdgeKey, BoundaryRow> boundaries = Map.of(
                EdgeKey.from(northLeft),
                new BoundaryRow(
                        42L,
                        0,
                        new Cell(0, 0, 0),
                        Direction.NORTH,
                        RoomClusterBoundaryMaterialization.BoundaryKind.WALL),
                EdgeKey.from(northRight),
                new BoundaryRow(
                        42L,
                        0,
                        new Cell(1, 0, 0),
                        Direction.NORTH,
                        RoomClusterBoundaryMaterialization.BoundaryKind.WALL));

        RoomClusterBoundaryStretchPlan.Selection outward =
                RoomClusterBoundaryStretchPlan.resolve(
                        Set.of(left, right),
                        List.of(northRight, northLeft),
                        boundaries,
                        0,
                        -1,
                        0)
                        .orElseThrow(() -> new IllegalStateException("expected stretch selection"));
        assertEquals(RoomClusterBoundaryStretchPlan.Orientation.HORIZONTAL, outward.orientation(),
                "core room stretch derives horizontal orientation");
        assertTrue(outward.outer(), "core room stretch marks perimeter row as outer");
        assertTrue(outward.movesOutward(), "core room stretch resolves outward movement");
        assertEquals(List.of(
                        EdgeKey.from(northLeft),
                        EdgeKey.from(northRight)),
                new java.util.ArrayList<>(outward.sourceKeys()),
                "core room stretch preserves sorted source keys");
        assertEquals(Set.of(new Cell(0, -1, 0), new Cell(1, -1, 0)),
                outward.stripCells(),
                "core room stretch computes moved strip cells");
        assertEquals(
                List.of(new Edge(new Cell(0, 0, 0), new Cell(0, -1, 0))),
                outward.connectorPath(outward.vertices().getFirst()),
                "core room stretch computes connector path for moved endpoint");
        assertEquals(Optional.empty(),
                RoomClusterBoundaryStretchPlan.resolve(
                        Set.of(left, right),
                        List.of(northLeft, northRight),
                        boundaries,
                        1,
                        0,
                        0),
                "core room stretch rejects movement outside the boundary normal");
    }

    private static List<Long> roomIds(List<Room> rooms) {
        List<Long> result = new java.util.ArrayList<>();
        for (Room room : rooms) {
            result.add(room.roomId());
        }
        return List.copyOf(result);
    }

    private static void assertStairStructureInvariants() {
        assertEquals(StairShape.STRAIGHT, StairShape.supportedEditorShape("straight"),
                "core stair accepts supported editor shape");
        assertEquals(null, StairShape.supportedEditorShape("ladder"),
                "core stair rejects unsupported editor shape");
        assertTrue(StairShape.STRAIGHT.supportsEditorDimensions(1, 1),
                "core stair straight shape accepts minimum editor dimensions");
        assertFalse(StairShape.STRAIGHT.supportsEditorDimensions(0, 1),
                "core stair straight shape rejects missing length");
        assertFalse(StairShape.STRAIGHT.supportsEditorDimensions(1, 0),
                "core stair shape rejects missing level span");
        assertFalse(StairShape.STRAIGHT.supportsEditorDimensions(1, 13),
                "core stair shape rejects oversized level span");
        assertFalse(StairShape.CIRCULAR.supportsEditorDimensions(32, 1),
                "core stair circular shape rejects oversized radius");

        StairGeometrySpec straightSpec =
                new StairGeometrySpec(StairShape.STRAIGHT, new Cell(0, 0, 0), Direction.EAST, 3, 2);
        assertEquals(List.of(new Cell(0, 0, 0), new Cell(1, 0, 0), new Cell(2, 0, 0)),
                straightSpec.generatedPath(),
                "core stair straight path follows direction");
        assertEquals(List.of(
                        new StairExit(11L, new Cell(0, 0, 0), ""),
                        new StairExit(12L, new Cell(1, 0, 1), ""),
                        new StairExit(13L, new Cell(2, 0, 2), "")),
                straightSpec.generatedExits(List.of(
                        new StairExit(11L, new Cell(0, 0, 0), "old"),
                        new StairExit(12L, new Cell(9, 9, 1), "old"),
                        new StairExit(13L, new Cell(9, 9, 2), "old"))),
                "core stair generated exits preserve existing ids by level offset");
        assertFalse(straightSpec.avoidsRoomInteriors(Set.of(new Cell(1, 0, 0))),
                "core stair rejects path through room interior");
        assertTrue(straightSpec.avoidsRoomInteriors(Set.of(new Cell(0, 0, 0))),
                "core stair allows room touch at generated exit");
        assertEquals(5,
                new StairGeometrySpec(StairShape.CIRCULAR, new Cell(5, 5, 0), Direction.NORTH, 4, 1)
                        .dimension1(),
                "core stair circular dimension normalizes to odd value");

        Stair stair = Stair.authored(8L, 2L, straightSpec);
        assertTrue(stair.isReadable(), "core stair with generated exits is readable");
        assertEquals(Set.of(new Cell(0, 0, 0), new Cell(1, 0, 0), new Cell(2, 0, 0),
                        new Cell(1, 0, 1), new Cell(2, 0, 2)),
                stair.occupiedCells(),
                "core stair occupied cells include path and exits");
        assertEquals(new Cell(2, 1, 0),
                stair.withMovedHandle(1, 1, 1, 0).path().get(1),
                "core stair handle movement updates path cell");
        Stair recomputed = stair.withRecomputedGeometry(
                new StairGeometrySpec(StairShape.SQUARE, new Cell(4, 4, 0), Direction.SOUTH, 2, 1));
        assertEquals(StairShape.SQUARE, recomputed.shape(), "core stair recompute replaces shape");
        assertEquals(8L, recomputed.stairId(), "core stair recompute preserves stair id");
        assertEquals(2L, recomputed.mapId(), "core stair recompute preserves map id");
        assertEquals(stair.name(), recomputed.name(), "core stair recompute preserves authored name");
        assertEquals(List.of(new Cell(4, 4, 0), new Cell(4, 5, 0), new Cell(3, 5, 0), new Cell(3, 4, 0)),
                recomputed.path(),
                "core stair recompute replaces generated path");

        Stair corridorBound = Stair.corridorBound(
                9L,
                2L,
                30L,
                List.of(new Cell(0, 0, 0), new Cell(0, 1, 0)),
                new Cell(0, 1, 2));
        assertEquals(30L, corridorBound.corridorId(), "core stair keeps corridor binding");
        assertEquals(List.of(
                        new StairExit(0L, new Cell(0, 0, 0), ""),
                        new StairExit(0L, new Cell(0, 1, 1), ""),
                        new StairExit(0L, new Cell(0, 1, 2), "")),
                corridorBound.exits(),
                "core stair corridor-bound construction creates level-spanning exits");
    }

    private static void assertTransitionStructureInvariants() {
        assertWorldspaceTransitionAdapterCompatibility();
    }

    private static void assertWorldspaceTransitionAdapterCompatibility() {
        src.domain.dungeon.model.worldspace.DungeonTransition source =
                new src.domain.dungeon.model.worldspace.DungeonTransition(
                        1L,
                        4L,
                        " source ",
                        new Cell(0, 0, 0),
                        src.domain.dungeon.model.worldspace.DungeonTransitionDestination.dungeonMapDestination(4L, 2L),
                        null);
        src.domain.dungeon.model.worldspace.DungeonTransition oldTarget =
                new src.domain.dungeon.model.worldspace.DungeonTransition(
                        2L,
                        4L,
                        "",
                        new Cell(1, 0, 0),
                        src.domain.dungeon.model.worldspace.DungeonTransitionDestination.overworldTileDestination(5L, 9L),
                        1L);
        src.domain.dungeon.model.worldspace.DungeonTransition target =
                new src.domain.dungeon.model.worldspace.DungeonTransition(
                        3L,
                        4L,
                        "",
                        new Cell(1, 1, 0),
                        src.domain.dungeon.model.worldspace.DungeonTransitionDestination.overworldTileDestination(5L, 9L),
                        null);
        src.domain.dungeon.model.worldspace.DungeonTransition remoteReference =
                new src.domain.dungeon.model.worldspace.DungeonTransition(
                        4L,
                        4L,
                        "",
                        new Cell(2, 0, 0),
                        src.domain.dungeon.model.worldspace.DungeonTransitionDestination.dungeonMapDestination(14L, 3L),
                        null);
        src.domain.dungeon.model.worldspace.DungeonMap map = transitionMap(source, oldTarget, target, remoteReference);

        assertFalse(map.canDeleteTransition(1L),
                "worldspace transition adapter preserves source reverse-link delete protection");
        assertFalse(map.canDeleteTransition(3L),
                "worldspace transition adapter preserves referenced-transition delete protection");
        assertEquals(List.of(1L, 2L, 3L), worldspaceTransitionIds(map.deleteTransition(4L).connections().transitions()),
                "worldspace transition adapter removes deletable transition through core catalog");
        src.domain.dungeon.model.worldspace.DungeonMap linkedMap =
                map.withTransitionConnections(map.connections().withMapLocalAuthoredTransitionLink(
                        bidirectionalLink(4L, 1L, 4L, 3L)));
        assertEquals(src.domain.dungeon.model.worldspace.DungeonTransitionDestination.dungeonMapDestination(4L, 3L),
                linkedMap
                        .connections()
                        .transitions()
                        .getFirst()
                        .destination(),
                "worldspace transition adapter updates source destination through core catalog");
        assertEquals(null,
                linkedMap
                        .connections()
                        .transitions()
                        .get(1)
                        .linkedTransitionId(),
                "worldspace transition adapter clears previous reverse linked transition through core catalog");
        assertEquals(1L,
                linkedMap
                        .connections()
                        .transitions()
                        .get(2)
                        .linkedTransitionId(),
                "worldspace transition adapter applies new bidirectional target link through core catalog");
    }

    private static AuthoredTransitionLink bidirectionalLink(
            long sourceMapId,
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId
    ) {
        return new AuthoredTransitionLink(
                new TransitionEndpoint(sourceMapId, sourceTransitionId),
                new TransitionEndpoint(targetMapId, targetTransitionId),
                TransitionLinkDirectionality.BIDIRECTIONAL);
    }

    private static List<Long> worldspaceTransitionIds(
            List<src.domain.dungeon.model.worldspace.DungeonTransition> transitions
    ) {
        List<Long> result = new java.util.ArrayList<>();
        for (src.domain.dungeon.model.worldspace.DungeonTransition transition : transitions) {
            result.add(transition.transitionId());
        }
        return List.copyOf(result);
    }

    private static src.domain.dungeon.model.worldspace.DungeonMap transitionMap(
            src.domain.dungeon.model.worldspace.DungeonTransition... transitions
    ) {
        return new src.domain.dungeon.model.worldspace.DungeonMap(
                new src.domain.dungeon.model.core.structure.DungeonMapMetadata(
                        new src.domain.dungeon.model.core.structure.DungeonMapIdentity(4L),
                        "transition proof map"),
                src.domain.dungeon.model.worldspace.SpatialTopology.empty(),
                src.domain.dungeon.model.core.structure.room.RoomCatalog.empty(),
                new src.domain.dungeon.model.worldspace.ConnectionCatalog(
                        List.of(),
                        List.of(),
                        List.of(transitions)),
                0L);
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

    private static void assertThrowsIllegalArgument(Runnable action, String label) {
        try {
            action.run();
        } catch (IllegalArgumentException expected) {
            return;
        }
        throw new IllegalStateException(label + " expected IllegalArgumentException");
    }

    private static void assertEquals(Object expected, Object actual, String label) {
        if (!Objects.equals(expected, actual)) {
            throw new IllegalStateException(label + " expected " + expected + " but was " + actual);
        }
    }
}
