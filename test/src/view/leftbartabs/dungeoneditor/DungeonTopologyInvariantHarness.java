package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.AuthoredTransitionLink;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.TransitionEndpoint;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.TransitionLinkDirectionality;
import src.domain.dungeon.model.worldspace.DungeonClusterBoundary;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.corridor.DungeonCorridorEndpoint;
import src.domain.dungeon.model.worldspace.DungeonMap;
import src.domain.dungeon.model.worldspace.DungeonMapAuthoring;
import src.domain.dungeon.model.worldspace.DungeonRoom;
import src.domain.dungeon.model.worldspace.DungeonRoomCluster;
import src.domain.dungeon.model.worldspace.DungeonTransition;

final class DungeonTopologyInvariantHarness {

    private static final String OWNER = "TopologyInvariantHarness";

    private DungeonTopologyInvariantHarness() {
    }

    static void run(List<String> results) {
        assertDoorTopologyIdentity();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-DOOR-005",
                "Door topology identity survives create, idempotent update, and corridor-bound reject, then releases on delete");
        assertTransitionTopologyIdentity();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-TRANSITION-003",
                "Transition topology identity survives create, description, link, and protected reject, then releases on delete");
    }

    private static void assertDoorTopologyIdentity() {
        DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(70L), "Door Topology Identity");
        map = map.paintRoomRectangle(new Cell(1, 1, 0), new Cell(3, 3, 0));
        DungeonRoomCluster cluster = clusterContainingAnchor(map, new Cell(1, 1, 0));
        Edge doorEdge = Edge.sideOf(new Cell(3, 2, 0), Direction.EAST);
        DungeonTopologyRef doorRef = DungeonTopologyRef.door(DungeonBoundaryKey.from(doorEdge).stableId());

        DungeonMap withDoor = map.editClusterBoundaries(
                cluster.clusterId(),
                List.of(doorEdge),
                BoundaryKind.DOOR,
                false);
        assertPresent(withDoor, doorRef, "door topology identity is published after create");

        DungeonMap updated = withDoor.editClusterBoundaries(
                cluster.clusterId(),
                List.of(doorEdge),
                BoundaryKind.DOOR,
                false);
        assertPresent(updated, doorRef, "door topology identity survives idempotent update");

        DungeonMap corridorBound = corridorBoundDoorMap();
        DoorFixture boundDoor = doorFixture(
                corridorBound,
                clusterContainingAnchor(corridorBound, new Cell(1, 1, 0)).clusterId(),
                new Cell(3, 2, 0),
                Direction.EAST);
        DungeonMap rejectedDelete = corridorBound.editClusterBoundaries(
                boundDoor.clusterId(),
                List.of(boundDoor.edge()),
                BoundaryKind.DOOR,
                true);
        assertTrue(
                hasDoorBoundary(rejectedDelete, boundDoor.clusterId(), boundDoor.edge()),
                "corridor-bound delete reject preserves authored door boundary");
        assertPresent(rejectedDelete, boundDoor.ref(), "door topology identity survives corridor-bound delete reject");

        DungeonMap deleted = updated.editClusterBoundaries(
                cluster.clusterId(),
                List.of(doorEdge),
                BoundaryKind.DOOR,
                true);
        assertAbsent(deleted, doorRef, "door topology identity is released after unbound delete");
    }

    private static DungeonMap corridorBoundDoorMap() {
        DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(71L), "Corridor Bound Door Topology");
        map = map.paintRoomRectangle(new Cell(1, 1, 0), new Cell(3, 3, 0));
        map = map.paintRoomRectangle(new Cell(8, 1, 0), new Cell(10, 3, 0));
        DoorFixture leftDoor = doorFixture(
                map,
                clusterContainingAnchor(map, new Cell(1, 1, 0)).clusterId(),
                new Cell(3, 2, 0),
                Direction.EAST);
        DoorFixture rightDoor = doorFixture(
                map,
                clusterContainingAnchor(map, new Cell(8, 1, 0)).clusterId(),
                new Cell(8, 2, 0),
                Direction.WEST);
        DungeonRoom leftRoom = roomInCluster(map, leftDoor.clusterId());
        DungeonRoom rightRoom = roomInCluster(map, rightDoor.clusterId());
        return map.createCorridor(
                0L,
                DungeonCorridorEndpoint.door(
                        leftRoom.roomId(),
                        leftDoor.clusterId(),
                        leftDoor.cell(),
                        leftDoor.direction(),
                        leftDoor.ref()),
                DungeonCorridorEndpoint.door(
                        rightRoom.roomId(),
                        rightDoor.clusterId(),
                        rightDoor.cell(),
                        rightDoor.direction(),
                        rightDoor.ref()));
    }

    private static DoorFixture doorFixture(
            DungeonMap map,
            long clusterId,
            Cell cell,
            Direction direction
    ) {
        Edge edge = Edge.sideOf(cell, direction);
        DungeonTopologyRef ref = DungeonTopologyRef.door(DungeonBoundaryKey.from(edge).stableId());
        DungeonMap withDoor = map.editClusterBoundaries(
                clusterId,
                List.of(edge),
                BoundaryKind.DOOR,
                false);
        assertPresent(withDoor, ref, "door fixture publishes topology identity");
        return new DoorFixture(clusterId, cell, direction, edge, ref);
    }

    private static void assertTransitionTopologyIdentity() {
        DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(72L), "Transition Topology Identity")
                .createTransition(40L, new Cell(2, 0, 0), false, 500L, 9L, null)
                .createTransition(41L, new Cell(3, 0, 0), false, 500L, 10L, null)
                .createTransition(42L, new Cell(4, 0, 0), false, 500L, 11L, null);
        DungeonTopologyRef firstRef = transitionRef(40L);
        DungeonTopologyRef linkedRef = transitionRef(41L);
        DungeonTopologyRef deletableRef = transitionRef(42L);

        assertPresent(map, firstRef, "transition topology identity is published after create");
        assertPresent(map, linkedRef, "linked transition topology identity is published after create");
        assertPresent(map, deletableRef, "deletable transition topology identity is published after create");

        DungeonMap described = map.saveTransitionDescription(40L, "A linked passage.");
        assertEquals(
                "A linked passage.",
                transitionById(described, 40L).description(),
                "transition description update applies to authored transition");
        assertPresent(described, firstRef, "transition topology identity survives description update");

        DungeonMap linked = described.withMapLocalAuthoredTransitionLink(new AuthoredTransitionLink(
                new TransitionEndpoint(72L, 40L),
                new TransitionEndpoint(72L, 41L),
                TransitionLinkDirectionality.BIDIRECTIONAL));
        assertEquals(
                41L,
                transitionById(linked, 40L).destination().transitionId(),
                "transition link update points source destination at target transition");
        assertEquals(
                40L,
                transitionById(linked, 41L).linkedTransitionId(),
                "transition link update records bidirectional target link");
        assertPresent(linked, firstRef, "transition topology identity survives link source update");
        assertPresent(linked, linkedRef, "transition topology identity survives link target update");

        DungeonMap rejectedDelete = linked.deleteTransition(40L);
        assertPresent(rejectedDelete, firstRef, "transition topology identity survives protected delete reject");

        DungeonMap deleted = rejectedDelete.deleteTransition(42L);
        assertAbsent(deleted, deletableRef, "transition topology identity is released after successful delete");
        assertPresent(deleted, firstRef, "unrelated transition topology identity survives another transition delete");
    }

    private static DungeonTopologyRef transitionRef(long transitionId) {
        return new DungeonTopologyRef(DungeonTopologyElementKind.TRANSITION, transitionId);
    }

    private static DungeonRoomCluster clusterContainingAnchor(DungeonMap map, Cell cell) {
        for (DungeonRoom room : map.rooms().rooms()) {
            if (room.primaryAnchor().equals(cell)) {
                return clusterById(map, room.clusterId());
            }
        }
        throw new IllegalStateException("No room cluster contains anchor cell " + cell);
    }

    private static DungeonRoomCluster clusterById(DungeonMap map, long clusterId) {
        for (DungeonRoomCluster cluster : map.topology().roomClusters()) {
            if (cluster.clusterId() == clusterId) {
                return cluster;
            }
        }
        throw new IllegalStateException("No room cluster found for clusterId=" + clusterId);
    }

    private static DungeonRoom roomInCluster(DungeonMap map, long clusterId) {
        for (DungeonRoom room : map.rooms().rooms()) {
            if (room.clusterId() == clusterId) {
                return room;
            }
        }
        throw new IllegalStateException("No room found for clusterId=" + clusterId);
    }

    private static boolean hasDoorBoundary(DungeonMap map, long clusterId, Edge edge) {
        DungeonRoomCluster cluster = clusterById(map, clusterId);
        for (List<DungeonClusterBoundary> boundaries : cluster.boundariesByLevel().values()) {
            for (DungeonClusterBoundary boundary : boundaries) {
                if (boundary.isDoor() && boundary.matchesAbsoluteEdge(cluster.center(), edge)) {
                    return true;
                }
            }
        }
        return false;
    }

    private static void assertPresent(DungeonMap map, DungeonTopologyRef ref, String message) {
        if (map.topologyIndex().find(ref).isEmpty()) {
            throw new IllegalStateException(message + " missing ref=" + ref);
        }
    }

    private static void assertAbsent(DungeonMap map, DungeonTopologyRef ref, String message) {
        if (map.topologyIndex().find(ref).isPresent()) {
            throw new IllegalStateException(message + " unexpected ref=" + ref);
        }
    }

    private static DungeonTransition transitionById(DungeonMap map, long transitionId) {
        DungeonTransition transition = map.transitionById(transitionId);
        if (transition == null) {
            throw new IllegalStateException("Missing transition transitionId=" + transitionId);
        }
        return transition;
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

    private record DoorFixture(
            long clusterId,
            Cell cell,
            Direction direction,
            Edge edge,
            DungeonTopologyRef ref
    ) {
    }
}
