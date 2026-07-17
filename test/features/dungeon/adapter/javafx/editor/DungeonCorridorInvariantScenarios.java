package features.dungeon.adapter.javafx.editor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.component.CorridorAnchorRef;
import features.dungeon.domain.core.component.CorridorDoorBinding;
import features.dungeon.domain.core.component.CorridorWaypoint;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.DungeonMapMetadata;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.corridor.CorridorAnchorEndpointMaterialization;
import features.dungeon.domain.core.structure.corridor.CorridorBindings;
import features.dungeon.domain.core.structure.corridor.CorridorDeletionTarget;
import features.dungeon.domain.core.structure.corridor.CorridorEndpointSemantics;
import features.dungeon.domain.core.structure.corridor.CorridorHostCells;
import features.dungeon.domain.core.structure.corridor.CorridorNetwork;
import features.dungeon.domain.core.structure.corridor.CorridorResolvedEndpoint;
import features.dungeon.domain.core.structure.corridor.CorridorRoomSet;
import features.dungeon.domain.core.structure.corridor.CorridorRoute;
import features.dungeon.domain.core.structure.corridor.CorridorRoutePlan;
import features.dungeon.domain.core.structure.corridor.CorridorTargetDeletion;
import features.dungeon.domain.core.structure.corridor.DungeonCorridorDeletionOwnerProbe;
import features.dungeon.domain.core.structure.room.RoomCatalog;
import features.dungeon.domain.core.structure.stair.StairCollection;
import features.dungeon.domain.core.structure.topology.SpatialTopology;
import features.dungeon.domain.core.structure.transition.TransitionCatalog;
import features.dungeon.application.editor.DungeonEditorRuntimeDraftOwnerProbe;
import static features.dungeon.adapter.javafx.editor.DungeonEditorTestSupport.*;

final class DungeonCorridorInvariantScenarios {


    private DungeonCorridorInvariantScenarios() {
    }

    static void run() {
        assertEndpointMaterializationOwner();

        assertRouteOwner();

        assertDeleteOwner();

        assertNetworkMovementOwner();

        DungeonEditorRuntimeDraftOwnerProbe.assertCorridorDraftSessionOwner();

    }

    private static void assertEndpointMaterializationOwner() {
        CorridorDoorBinding door = new CorridorDoorBinding(4L, 40L, new Cell(1, 0, 0), Direction.EAST);
        Corridor doorBound = CorridorResolvedEndpoint
                .forDoor(door, CorridorEndpointSemantics.forDoor(door))
                .applyTo(emptyCorridor(1L));
        assertEquals(List.of(4L), doorBound.roomIds(), "corridor endpoint owner adds door room id");
        assertEquals(List.of(door), doorBound.bindings().doorBindings(),
                "corridor endpoint owner applies concrete door binding");

        CorridorAnchorRef anchorRef = new CorridorAnchorRef(10L, 1L);
        Corridor anchorBound = CorridorResolvedEndpoint.forAnchor(anchorRef).applyTo(emptyCorridor(2L));
        assertEquals(List.of(anchorRef), anchorBound.bindings().anchorRefs(),
                "corridor endpoint owner applies concrete anchor ref");

        Corridor host = emptyCorridor(10L);
        CorridorHostCells hostCells = new CorridorHostCells(Map.of(
                10L,
                List.of(new Cell(2, 0, 0), new Cell(4, 0, 0))));
        CorridorAnchorEndpointMaterialization created = CorridorAnchorEndpointMaterialization.materialize(
                List.of(host),
                10L,
                new Cell(3, 0, 0),
                0L,
                hostCells);
        assertTrue(created != null, "corridor anchor endpoint owner materializes known host corridor");
        created = java.util.Objects.requireNonNull(created);
        assertTrue(created.changed(), "corridor anchor endpoint owner reports new anchor materialization");
        assertEquals(new CorridorAnchor(1L, 10L, new Cell(2, 0, 0)), created.anchor(),
                "corridor anchor endpoint owner snaps created anchor to deterministic host cell");

        CorridorAnchorEndpointMaterialization reused = CorridorAnchorEndpointMaterialization.materialize(
                created.corridors(),
                10L,
                new Cell(4, 0, 0),
                1L,
                hostCells);
        assertTrue(reused != null, "corridor anchor endpoint owner reuses preferred anchor");
        reused = java.util.Objects.requireNonNull(reused);
        assertTrue(!reused.changed(), "corridor anchor endpoint owner reports preferred-id reuse without mutation");
        assertEquals(created.anchor(), reused.anchor(),
                "corridor anchor endpoint owner keeps preferred anchor identity stable");
        assertTrue(CorridorAnchorEndpointMaterialization.materialize(
                        List.of(host),
                        99L,
                        new Cell(3, 0, 0),
                        0L,
                        hostCells) == null,
                "corridor anchor endpoint owner rejects missing host without materialization");
    }

    private static void assertRouteOwner() {
        CorridorRoute straight = CorridorRoute.unblockedBetween(new Cell(0, 0, 0), new Cell(3, 0, 0), Set.of());
        assertEquals(List.of(new Cell(0, 0, 0), new Cell(1, 0, 0), new Cell(2, 0, 0), new Cell(3, 0, 0)),
                straight.cells(),
                "corridor route owner derives deterministic straight route");
        CorridorRoute turned = CorridorRoute.unblockedBetween(new Cell(0, 0, 0), new Cell(2, 2, 1), Set.of());
        assertEquals(List.of(new Cell(0, 0, 0), new Cell(1, 0, 0), new Cell(2, 0, 0),
                        new Cell(2, 1, 0), new Cell(2, 2, 0)),
                turned.cells(),
                "corridor route owner derives horizontal-first turned route on start level");
        assertTrue(turned.blockedBy(Set.of(new Cell(2, 1, 0))),
                "corridor route owner detects blocked route cell");
        assertTrue(!turned.blockedBy(Set.of(new Cell(9, 9, 0))),
                "corridor route owner ignores unrelated blocked cells");
        assertEquals(List.of(new Cell(0, 0, 0), new Cell(0, 1, 0), new Cell(0, 2, 0),
                        new Cell(1, 2, 0), new Cell(2, 2, 0)),
                CorridorRoute.unblockedBetween(
                                new Cell(0, 0, 0),
                                new Cell(2, 2, 1),
                                Set.of(new Cell(1, 0, 0)))
                        .cells(),
                "corridor route owner uses vertical-first fallback when horizontal-first is blocked");
        assertTrue(!CorridorRoute.unblockedBetween(
                        new Cell(0, 0, 0),
                        new Cell(2, 2, 1),
                        Set.of(new Cell(1, 0, 0), new Cell(0, 1, 0)))
                .present(),
                "corridor route owner rejects when neither orthogonal route is valid");

        CorridorRoutePlan crossingPlan = new CorridorRoutePlan(
                List.of(new Cell(0, 0, 0), new Cell(1, 0, 0), new Cell(2, 0, 0)),
                30L,
                new Cell(0, 0, 0));
        CorridorAnchor laterHost = new CorridorAnchor(9L, 99L, new Cell(1, 0, 0));
        CorridorAnchor selected = new CorridorAnchor(4L, 10L, new Cell(1, 0, 0));
        CorridorBindings planned = crossingPlan.bindInteriorAnchors(CorridorBindings.empty(), List.of(laterHost, selected));
        assertEquals(List.of(new CorridorAnchorRef(10L, 4L)), planned.anchorRefs(),
                "corridor route owner chooses deterministic crossing anchor by host and anchor id");
        assertEquals(List.of(new CorridorWaypoint(30L, new Cell(1, 0, 0), 0)), planned.waypoints(),
                "corridor route owner creates the deterministic crossing waypoint");
    }

    private static void assertDeleteOwner() {
        CorridorDoorBinding removedDoor = new CorridorDoorBinding(4L, 40L, new Cell(0, 0, 0), Direction.EAST);
        CorridorDoorBinding survivingDoor = new CorridorDoorBinding(5L, 50L, new Cell(4, 0, 0), Direction.WEST);
        CorridorWaypoint first = new CorridorWaypoint(30L, new Cell(1, 0, 0), 0);
        CorridorWaypoint second = new CorridorWaypoint(30L, new Cell(2, 0, 0), 1);
        CorridorWaypoint third = new CorridorWaypoint(30L, new Cell(3, 0, 0), 2);
        CorridorAnchorRef survivingAnchor = new CorridorAnchorRef(7L, 70L);
        Corridor branch = new Corridor(
                20L,
                1L,
                0,
                new CorridorRoomSet(List.of(4L, 5L)),
                new CorridorBindings(
                        List.of(first, second, third),
                        List.of(removedDoor, survivingDoor),
                        List.of(),
                        List.of(survivingAnchor)));
        CorridorTargetDeletion deletion = new CorridorTargetDeletion();
        Corridor withoutDoor = deletion.deleteTarget(
                branch,
                CorridorDeletionTarget.doorBinding(20L, 400L, 0L),
                List.of(
                        new CorridorTargetDeletion.DoorBindingTarget(removedDoor, 400L, new Cell(0, 0, 0)),
                        new CorridorTargetDeletion.DoorBindingTarget(survivingDoor, 500L, new Cell(4, 0, 0))),
                List.of(new CorridorTargetDeletion.AnchorTarget(new Cell(0, 0, 0))),
                List.of(
                        new CorridorTargetDeletion.WaypointTarget(new Cell(0, 0, 0)),
                        new CorridorTargetDeletion.WaypointTarget(new Cell(2, 0, 0)),
                        new CorridorTargetDeletion.WaypointTarget(new Cell(4, 0, 0))));
        assertEquals(List.of(survivingDoor), withoutDoor.bindings().doorBindings(),
                "corridor delete owner removes only the targeted door branch");
        assertEquals(List.of(second), withoutDoor.bindings().waypoints(),
                "corridor delete owner preserves the interior branch span between remaining endpoints");

        Corridor withoutPoint = deletion.deleteTarget(
                branch,
                CorridorDeletionTarget.corridorWaypoint(20L, 1),
                List.of(),
                List.of(),
                List.of());
        assertEquals(List.of(first, third), withoutPoint.bindings().waypoints(),
                "corridor delete owner removes only the targeted waypoint");

        Corridor protectedOwner = new Corridor(
                10L,
                1L,
                0,
                new CorridorRoomSet(List.of()),
                new CorridorBindings(
                        List.of(),
                        List.of(),
                        List.of(new CorridorAnchor(1L, 10L, new Cell(1, 0, 0))),
                        List.of()));
        Corridor dependent = new Corridor(
                11L,
                1L,
                0,
                new CorridorRoomSet(List.of()),
                new CorridorBindings(
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(new CorridorAnchorRef(10L, 1L))));
        CorridorNetwork network = new CorridorNetwork(List.of(protectedOwner, dependent));
        assertTrue(!network.canDeleteCorridor(10L), "corridor network protects referenced owner corridor");
        assertEquals(List.of(10L, 11L), corridorIds(network.withoutCorridor(10L)),
                "corridor network keeps protected owner corridor");
        assertTrue(network.canDeleteCorridor(11L), "corridor network allows deleting dependent branch corridor");
        assertEquals(List.of(10L), corridorIds(network.withoutCorridor(11L)),
                "corridor network deletes the unreferenced branch corridor");
        DungeonCorridorDeletionOwnerProbe.assertInvalidReplacementRouteRejectedBeforeMutation();
    }

    private static void assertNetworkMovementOwner() {
        Corridor host = anchorMoveMapWithSingleAnchorTarget().corridors().getFirst();
        Corridor dependent = new Corridor(
                11L,
                1L,
                0,
                new CorridorRoomSet(List.of()),
                new CorridorBindings(
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(new CorridorAnchorRef(10L, 1L))));
        CorridorNetwork network = new CorridorNetwork(List.of(host, dependent));
        assertTrue(!network.canDeleteCorridor(10L),
                "corridor network owner identifies dependent corridors by hosted anchor ref");

        DungeonMap duplicateSource = anchorMoveMapWithDuplicateAnchorTarget();
        DungeonMap rejected = duplicateSource.moveCorridorAnchor(
                10L,
                0,
                DungeonTopologyRef.corridorAnchor(1L),
                1,
                0,
                0);
        assertEquals(duplicateSource, rejected,
                "corridor network movement rejects a host move that would duplicate owned anchor cells");
    }

    private static DungeonMap anchorMoveMapWithSingleAnchorTarget() {
        return anchorMoveMap(false);
    }

    private static DungeonMap anchorMoveMapWithDuplicateAnchorTarget() {
        return anchorMoveMap(true);
    }

    private static DungeonMap anchorMoveMap(boolean duplicateTarget) {
        CorridorAnchor movedAnchor = new CorridorAnchor(
                1L,
                10L,
                new Cell(1, 0, 0));
        List<CorridorAnchor> anchors = duplicateTarget
                ? List.of(
                        movedAnchor,
                        new CorridorAnchor(2L, 10L, new Cell(2, 0, 0)))
                : List.of(movedAnchor);
        Corridor host = new Corridor(
                10L,
                1L,
                0,
                new CorridorRoomSet(List.of()),
                new CorridorBindings(
                        List.of(
                                new CorridorWaypoint(0L, new Cell(0, 0, 0), 0),
                                new CorridorWaypoint(0L, new Cell(1, 0, 0), 0),
                                new CorridorWaypoint(0L, new Cell(2, 0, 0), 0)),
                        List.of(),
                        anchors,
                        List.of(new CorridorAnchorRef(10L, 1L))));
        return new DungeonMap(
                new DungeonMapMetadata(new DungeonMapIdentity(1L), "Corridor Network Invariant"),
                SpatialTopology.defaultGrid(),
                RoomCatalog.empty(),
                List.of(host),
                new StairCollection(List.of()),
                new TransitionCatalog(List.of()),
                0L);
    }

    private static Corridor emptyCorridor(long corridorId) {
        return new Corridor(corridorId, 1L, 0, new CorridorRoomSet(List.of()), CorridorBindings.empty());
    }

    private static List<Long> corridorIds(CorridorNetwork network) {
        List<Long> result = new ArrayList<>();
        for (Corridor corridor : network.corridors()) {
            result.add(corridor.corridorId());
        }
        return List.copyOf(result);
    }
}
