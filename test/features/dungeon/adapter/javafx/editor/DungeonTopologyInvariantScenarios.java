package features.dungeon.adapter.javafx.editor;

import java.util.List;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyElementKind;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.corridor.DungeonCorridorEndpoint;
import features.dungeon.domain.core.structure.room.DungeonClusterBoundary;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import features.dungeon.domain.core.structure.transition.Transition;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.domain.core.structure.transition.TransitionCatalog.AuthoredTransitionLink;
import features.dungeon.domain.core.structure.transition.TransitionCatalog.TransitionEndpoint;
import features.dungeon.domain.core.structure.transition.TransitionCatalog.TransitionLinkDirectionality;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;

final class DungeonTopologyInvariantScenarios {


    private DungeonTopologyInvariantScenarios() {
    }

    static void run() {
        assertDoorTopologyIdentity();

        assertTransitionTopologyIdentity();

    }

    private static void assertDoorTopologyIdentity() {
        DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(70L), "Door Topology Identity");
        map = map.paintRoomRectangle(new Cell(1, 1, 0), new Cell(3, 3, 0));
        RoomCluster cluster = clusterContainingAnchor(map, new Cell(1, 1, 0));
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
                clusterContainingAnchor(corridorBound, new Cell(8, 1, 0)).clusterId(),
                new Cell(8, 2, 0),
                Direction.WEST);
        assertTrue(
                hasDoorBoundary(corridorBound, boundDoor.clusterId(), boundDoor.edge()),
                "corridor-bound setup contains authored door boundary");
        assertTrue(!corridorBound.corridors().isEmpty(), "corridor-bound setup contains authored corridor");
        assertTrue(
                !corridorBound.corridors().getFirst().bindings().doorBindings().isEmpty(),
                "corridor-bound setup contains corridor door bindings");
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
        map = withDoorBoundary(map, leftDoor);
        leftDoor = doorFixture(
                map,
                clusterContainingAnchor(map, new Cell(1, 1, 0)).clusterId(),
                leftDoor.cell(),
                leftDoor.direction());
        DoorFixture rightDoor = doorFixture(
                map,
                clusterContainingAnchor(map, new Cell(8, 1, 0)).clusterId(),
                new Cell(8, 2, 0),
                Direction.WEST);
        map = withDoorBoundary(map, rightDoor);
        rightDoor = doorFixture(
                map,
                clusterContainingAnchor(map, new Cell(8, 1, 0)).clusterId(),
                rightDoor.cell(),
                rightDoor.direction());
        RoomRegion leftRoom = roomInCluster(map, leftDoor.clusterId());
        RoomRegion rightRoom = roomInCluster(map, rightDoor.clusterId());
        return map.createCorridor(
                new features.dungeon.domain.core.structure.corridor.OrthogonalCorridorRoutingPolicy(),
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

    private static DungeonMap withDoorBoundary(DungeonMap map, DoorFixture door) {
        return map.editClusterBoundaries(
                door.clusterId(),
                List.of(door.edge()),
                BoundaryKind.DOOR,
                false);
    }

    private static void assertTransitionTopologyIdentity() {
        DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(72L), "Transition Topology Identity");
        map = withAuthoredTransition(map, 40L, new Cell(2, 0, 0), TransitionDestination.overworldTile(500L, 9L));
        map = withAuthoredTransition(map, 41L, new Cell(3, 0, 0), TransitionDestination.overworldTile(500L, 10L));
        map = withAuthoredTransition(map, 42L, new Cell(4, 0, 0), TransitionDestination.overworldTile(500L, 11L));
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

        DungeonMap linked = described.withTransitionCatalog(described.transitionCatalog().withMapLocalAuthoredTransitionLink(
                new AuthoredTransitionLink(
                        new TransitionEndpoint(72L, 40L),
                        new TransitionEndpoint(72L, 41L),
                        TransitionLinkDirectionality.BIDIRECTIONAL)));
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

    private static RoomCluster clusterContainingAnchor(DungeonMap map, Cell cell) {
        for (RoomRegion room : map.rooms().rooms()) {
            if (room.primaryAnchor().equals(cell)) {
                return clusterById(map, room.clusterId());
            }
        }
        throw new IllegalStateException("No room cluster contains anchor cell " + cell);
    }

    private static RoomCluster clusterById(DungeonMap map, long clusterId) {
        for (RoomCluster cluster : map.topology().roomClusters()) {
            if (cluster.clusterId() == clusterId) {
                return cluster;
            }
        }
        throw new IllegalStateException("No room cluster found for clusterId=" + clusterId);
    }

    private static RoomRegion roomInCluster(DungeonMap map, long clusterId) {
        for (RoomRegion room : map.rooms().rooms()) {
            if (room.clusterId() == clusterId) {
                return room;
            }
        }
        throw new IllegalStateException("No room found for clusterId=" + clusterId);
    }

    private static boolean hasDoorBoundary(DungeonMap map, long clusterId, Edge edge) {
        RoomCluster cluster = clusterById(map, clusterId);
        DungeonClusterBoundary boundary = cluster.boundaryAt(edge);
        return boundary != null && boundary.isDoor();
    }

    private static void assertPresent(DungeonMap map, DungeonTopologyRef ref, String message) {
        if (map.topologyIndex().binding(ref) == null) {
            throw new IllegalStateException(message + " missing ref=" + ref);
        }
    }

    private static void assertAbsent(DungeonMap map, DungeonTopologyRef ref, String message) {
        if (map.topologyIndex().binding(ref) != null) {
            throw new IllegalStateException(message + " unexpected ref=" + ref);
        }
    }

    private static DungeonMap withAuthoredTransition(
            DungeonMap map,
            long transitionId,
            Cell anchor,
            TransitionDestination destination
    ) {
        return map.withTransitionCatalog(map.transitionCatalog().withCreated(
                transitionId,
                map.metadata().mapId().value(),
                TransitionAnchor.cell(anchor),
                destination));
    }

    private static Transition transitionById(DungeonMap map, long transitionId) {
        for (Transition transition : map.transitionCatalog().transitions()) {
            if (transition.transitionId() == transitionId) {
                return transition;
            }
        }
        throw new IllegalStateException("Missing transition transitionId=" + transitionId);
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
