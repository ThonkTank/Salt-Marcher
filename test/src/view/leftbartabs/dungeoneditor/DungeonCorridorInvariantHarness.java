package src.view.leftbartabs.dungeoneditor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.component.CorridorAnchor;
import src.domain.dungeon.model.core.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.component.CorridorDoorBinding;
import src.domain.dungeon.model.core.component.CorridorWaypoint;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.DungeonMapMetadata;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorAnchorEndpointMaterialization;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindings;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindingState;
import src.domain.dungeon.model.core.structure.corridor.CorridorEndpointSemantics;
import src.domain.dungeon.model.core.structure.corridor.CorridorHostCells;
import src.domain.dungeon.model.core.structure.corridor.CorridorNetwork;
import src.domain.dungeon.model.core.structure.corridor.CorridorResolvedEndpoint;
import src.domain.dungeon.model.core.structure.corridor.CorridorRoomSet;
import src.domain.dungeon.model.core.structure.corridor.CorridorRoute;
import src.domain.dungeon.model.core.structure.corridor.CorridorRoutePlan;
import src.domain.dungeon.model.core.structure.corridor.CorridorTargetDeletion;
import src.domain.dungeon.model.core.structure.corridor.DungeonCorridorDeletionOwnerProbe;
import src.domain.dungeon.model.core.structure.room.RoomCatalog;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;
import src.features.dungeon.runtime.DungeonEditorRuntimeDraftOwnerProbe;
import static src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorHarnessSupport.*;

final class DungeonCorridorInvariantHarness {

    private static final String OWNER = "CorridorInvariantHarness";

    private DungeonCorridorInvariantHarness() {
    }

    static void run(List<String> results) {
        assertEndpointMaterializationOwner();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-CORRIDOR-002",
                "Corridor endpoint owner applies concrete door and anchor bindings and materializes generic"
                        + " corridor anchors by host id, snapped host cell, preferred-id reuse, and missing-host rejection");
        assertRouteOwner();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-CORRIDOR-003",
                "Corridor route owner derives deterministic straight and turned route cells, detects blocked cells,"
                        + " and binds crossing anchors into stable waypoint and anchor-ref facts");
        assertDeleteOwner();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-CORRIDOR-004",
                "Corridor deletion owner removes point and door branch targets, protects referenced whole"
                        + " corridors, prunes detached anchors, and rejects invalid replacement routes before mutation");
        assertNetworkMovementOwner();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-CORRIDOR-005",
                "Corridor network movement moves host anchors through the aggregate and rejects duplicate"
                        + " moved anchor cells unchanged");
        DungeonEditorRuntimeDraftOwnerProbe.assertCorridorDraftSessionOwner();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-CORRIDOR-001",
                "Production corridor draft/session owner stores first-click target state without create preview,"
                        + " apply preview, or authored endpoint materialization");
    }

    private static void assertEndpointMaterializationOwner() {
        CorridorDoorBinding door = new CorridorDoorBinding(4L, 40L, new Cell(1, 0, 0), Direction.EAST);
        Corridor doorBound = CorridorResolvedEndpoint
                .forDoor(door, CorridorEndpointSemantics.forDoor(door))
                .applyTo(emptyCorridor(1L));
        assertEquals(List.of(4L), doorBound.roomIds(), "corridor endpoint owner adds door room id");
        assertEquals(List.of(door), doorBound.coreBindings().doorBindings(),
                "corridor endpoint owner applies concrete door binding");

        CorridorAnchorRef anchorRef = new CorridorAnchorRef(10L, 1L);
        Corridor anchorBound = CorridorResolvedEndpoint.forAnchor(anchorRef).applyTo(emptyCorridor(2L));
        assertEquals(List.of(anchorRef), anchorBound.coreBindings().anchorRefs(),
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
                "DOOR",
                400L,
                0L,
                -1,
                List.of(
                        new CorridorTargetDeletion.DoorBindingTarget(removedDoor, 400L, new Cell(0, 0, 0)),
                        new CorridorTargetDeletion.DoorBindingTarget(survivingDoor, 500L, new Cell(4, 0, 0))),
                List.of(new CorridorTargetDeletion.AnchorTarget(new Cell(0, 0, 0))),
                List.of(
                        new CorridorTargetDeletion.WaypointTarget(new Cell(0, 0, 0)),
                        new CorridorTargetDeletion.WaypointTarget(new Cell(2, 0, 0)),
                        new CorridorTargetDeletion.WaypointTarget(new Cell(4, 0, 0))));
        assertEquals(List.of(survivingDoor), withoutDoor.coreBindings().doorBindings(),
                "corridor delete owner removes only the targeted door branch");
        assertEquals(List.of(second), withoutDoor.coreBindings().waypoints(),
                "corridor delete owner preserves the interior branch span between remaining endpoints");

        Corridor withoutPoint = deletion.deleteTarget(
                branch,
                "CORRIDOR_WAYPOINT",
                0L,
                0L,
                1,
                List.of(),
                List.of(),
                List.of());
        assertEquals(List.of(first, third), withoutPoint.coreBindings().waypoints(),
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
                new CorridorBindingState(
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
