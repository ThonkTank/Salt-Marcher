package features.dungeon.application.authored.command;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.component.CorridorAnchorRef;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapAuthoring.AuthoredContent;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.corridor.CorridorBindings;
import features.dungeon.domain.core.structure.corridor.CorridorDeletionTarget;
import features.dungeon.domain.core.structure.corridor.CorridorMapAuthoring;
import features.dungeon.domain.core.structure.corridor.CorridorRoomSet;
import features.dungeon.domain.core.structure.corridor.DungeonCorridorEndpoint;
import features.dungeon.domain.core.structure.corridor.OrthogonalCorridorRoutingPolicy;
import features.dungeon.domain.core.structure.room.RoomRegion;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

final class DungeonCorridorPatchCommandsTest {

    @Test
    void sameLevelCreateAndDeleteUseExactCorridorAndBoundaryChanges() {
        DungeonMap current = endpointMap(0, 0);
        Endpoints endpoints = endpoints(current, 0, 0);
        CreateCorridorCommand create = new CreateCorridorCommand(new OrthogonalCorridorRoutingPolicy());
        CreateCorridorCommand.ReservedIdentities identities = DungeonCommandTestIdentities.corridor(
                91L, 100L, 0L, null, 80L, 80L);

        DungeonCommandResult.Accepted createdResult = accepted(create.plan(
                current,
                identities,
                endpoints.start(),
                endpoints.end()));
        assertTrue(createdResult.patch().changes().stream()
                .anyMatch(change -> change instanceof CorridorChange corridor
                        && corridor.before() == null
                        && corridor.after() != null));
        assertTrue(createdResult.patch().changes().stream()
                .anyMatch(RoomClusterChange.class::isInstance));
        CorridorChange corridorChange = createdResult.patch().changes().stream()
                .filter(CorridorChange.class::isInstance)
                .map(CorridorChange.class::cast)
                .findFirst()
                .orElseThrow();
        assertEquals(
                DungeonPatchEntityRef.corridor(corridorChange.after().corridorId()),
                corridorChange.entityRef());
        assertTrue(!createdResult.patch().touchedChunks().isEmpty());
        DungeonMap created = createdResult.patch().applyTo(current);
        DungeonMap domainResult = new CorridorMapAuthoring(
                new OrthogonalCorridorRoutingPolicy()).createCorridor(
                current,
                identities.toDomainReservation(),
                endpoints.start(),
                endpoints.end());
        assertEquals(
                DungeonMapAuthoring.committedContent(domainResult, current.revision() + 1L),
                created);
        assertEquals(current.revision() + 1L, created.revision());
        assertTrue(created.corridors().getLast().bindings().doorBindings().stream().allMatch(door ->
                created.topologyIndex().binding(door.topologyRef()).corridorId()
                        == created.corridors().getLast().corridorId()));
        assertEquals(current, contentAtRevision(createdResult.inverse().applyTo(created), current.revision()));

        long corridorId = created.corridors().getLast().corridorId();
        DungeonCommandResult.Accepted deletedResult = accepted(new DeleteCorridorCommand(
                new OrthogonalCorridorRoutingPolicy()).plan(
                        created,
                        CorridorDeletionTarget.wholeCorridor(corridorId)));
        CorridorChange deletedCorridor = deletedResult.patch().changes().stream()
                .filter(CorridorChange.class::isInstance)
                .map(CorridorChange.class::cast)
                .filter(change -> change.entityRef().id() == corridorId)
                .findFirst()
                .orElseThrow();
        assertNull(deletedCorridor.after());
        DungeonMap deleted = deletedResult.patch().applyTo(created);
        assertTrue(deleted.corridors().stream().noneMatch(corridor -> corridor.corridorId() == corridorId));
        assertEquals(created, contentAtRevision(deletedResult.inverse().applyTo(deleted), created.revision()));
    }

    @Test
    void crossLevelCreateAndOwnerDeleteCarryBoundStairInSamePatch() {
        DungeonMap current = endpointMap(0, 1);
        Endpoints endpoints = endpoints(current, 0, 1);
        DungeonCommandResult.Accepted createdResult = accepted(new CreateCorridorCommand(
                new OrthogonalCorridorRoutingPolicy()).plan(
                        current,
                        DungeonCommandTestIdentities.corridor(
                                201L,
                                210L,
                                92L,
                                DungeonCommandTestIdentities.range(220L, 4),
                                240L,
                                240L),
                        endpoints.start(),
                        endpoints.end()));
        StairChange stairCreated = createdResult.patch().changes().stream()
                .filter(StairChange.class::isInstance)
                .map(StairChange.class::cast)
                .findFirst()
                .orElseThrow();
        assertNull(stairCreated.before());
        assertEquals(92L, stairCreated.after().stairId());
        assertTrue(stairCreated.after().corridorId() > 0L);
        DungeonMap created = createdResult.patch().applyTo(current);
        assertEquals(92L, created.stairs().stairs().getFirst().stairId());

        long corridorId = created.corridors().getLast().corridorId();
        DungeonCommandResult.Accepted deletedResult = accepted(new DeleteCorridorCommand(
                new OrthogonalCorridorRoutingPolicy()).plan(
                        created,
                        CorridorDeletionTarget.wholeCorridor(corridorId)));
        StairChange stairDeleted = deletedResult.patch().changes().stream()
                .filter(StairChange.class::isInstance)
                .map(StairChange.class::cast)
                .findFirst()
                .orElseThrow();
        assertEquals(92L, stairDeleted.before().stairId());
        assertNull(stairDeleted.after());
        DungeonMap deleted = deletedResult.patch().applyTo(created);
        assertTrue(deleted.stairs().stairs().isEmpty());
        assertEquals(created, contentAtRevision(deletedResult.inverse().applyTo(deleted), created.revision()));
    }

    @Test
    void negativeCoordinatesUseFloorDividedTouchedChunks() {
        DungeonMap current = DungeonCommandTestIdentities.paint(
                emptyMap(), new Cell(-130, -2, 0), new Cell(-129, -1, 0), 1L, 1L);
        current = DungeonCommandTestIdentities.paint(
                current, new Cell(-124, -2, 0), new Cell(-123, -1, 0), 40L, 40L);
        Endpoints endpoints = endpoints(current, 0, 0);

        DungeonCommandResult.Accepted created = accepted(new CreateCorridorCommand(
                new OrthogonalCorridorRoutingPolicy()).plan(
                        current,
                        DungeonCommandTestIdentities.corridor(
                                301L, 310L, 0L, null, 340L, 340L),
                        endpoints.start(),
                        endpoints.end()));

        assertTrue(created.patch().touchedChunks().stream().anyMatch(chunk -> chunk.chunkQ() == -3));
        assertTrue(created.patch().touchedChunks().stream().anyMatch(chunk -> chunk.chunkQ() == -2));
        assertEquals(
                Set.of(-1, 0),
                created.patch().touchedChunks().stream()
                        .map(DungeonChunkKey::chunkR)
                        .collect(Collectors.toSet()),
                "canonical boundary edges touch their adjacent exterior chunk as well as the negative room chunk");
    }

    @Test
    void referencedOwnerDeleteAndInvalidCreateRejectWithStableReasons() {
        Corridor owner = new Corridor(
                10L,
                73L,
                0,
                new CorridorRoomSet(List.of()),
                new CorridorBindings(
                        List.of(),
                        List.of(),
                        List.of(new CorridorAnchor(1L, 10L, new Cell(1, 0, 0))),
                        List.of()));
        Corridor dependent = new Corridor(
                11L,
                73L,
                0,
                new CorridorRoomSet(List.of()),
                new CorridorBindings(
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(new CorridorAnchorRef(10L, 1L))));
        DungeonMap empty = emptyMap();
        DungeonMap protectedMap = DungeonMapAuthoring.authored(
                empty.metadata().mapId(),
                empty.metadata().mapName(),
                new AuthoredContent(
                        empty.topology(),
                        empty.topologyIndex(),
                        empty.rooms(),
                        List.of(owner, dependent),
                        empty.stairs(),
                        empty.transitionCatalog().transitions(),
                        empty.featureMarkers()),
                empty.revision());
        long protectedRevision = protectedMap.revision();
        List<Corridor> protectedCorridors = protectedMap.corridors();

        DungeonCommandResult.Rejected protectedDelete = assertInstanceOf(
                DungeonCommandResult.Rejected.class,
                new DeleteCorridorCommand(new OrthogonalCorridorRoutingPolicy()).plan(
                        protectedMap,
                        CorridorDeletionTarget.wholeCorridor(10L)));
        DungeonCommandResult.Rejected invalidCreate = assertInstanceOf(
                DungeonCommandResult.Rejected.class,
                new CreateCorridorCommand(new OrthogonalCorridorRoutingPolicy()).plan(
                        empty,
                        null,
                        null,
                        null));
        assertEquals(DungeonEditorCommandOutcome.RejectionReason.BLOCKED_ROUTE, protectedDelete.reason());
        assertEquals(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET, invalidCreate.reason());
        assertEquals(protectedRevision, protectedMap.revision());
        assertEquals(protectedCorridors, protectedMap.corridors());
    }

    private static Endpoints endpoints(DungeonMap map, int startLevel, int endLevel) {
        RoomRegion startRoom = roomAtLevel(map, startLevel);
        RoomRegion endRoom = map.rooms().rooms().stream()
                .filter(room -> room.primaryLevel() == endLevel && room.roomId() != startRoom.roomId())
                .findFirst()
                .orElseThrow();
        Cell startCell = startRoom.floorCells().stream()
                .max(java.util.Comparator.comparingInt(Cell::q))
                .orElseThrow();
        Cell endCell = endRoom.floorCells().stream()
                .min(java.util.Comparator.comparingInt(Cell::q))
                .orElseThrow();
        return new Endpoints(
                DungeonCorridorEndpoint.door(
                        startRoom.roomId(),
                        startRoom.clusterId(),
                        startCell,
                        Direction.EAST,
                        DungeonTopologyRef.empty()),
                DungeonCorridorEndpoint.door(
                        endRoom.roomId(),
                        endRoom.clusterId(),
                        endCell,
                        Direction.WEST,
                        DungeonTopologyRef.empty()));
    }

    private static DungeonMap endpointMap(int startLevel, int endLevel) {
        DungeonMap map = DungeonCommandTestIdentities.paint(
                emptyMap(),
                new Cell(1, 1, startLevel),
                new Cell(2, 2, startLevel),
                1L,
                1L);
        return DungeonCommandTestIdentities.paint(
                map,
                new Cell(7, 1, endLevel),
                new Cell(8, 2, endLevel),
                40L,
                40L);
    }

    private static RoomRegion roomAtLevel(DungeonMap map, int level) {
        return map.rooms().rooms().stream()
                .filter(room -> room.primaryLevel() == level)
                .findFirst()
                .orElseThrow();
    }

    private static DungeonCommandResult.Accepted accepted(DungeonCommandResult result) {
        return assertInstanceOf(DungeonCommandResult.Accepted.class, result);
    }

    private static DungeonMap emptyMap() {
        return DungeonMapAuthoring.empty(new DungeonMapIdentity(73L), "Corridor Patches");
    }

    private static DungeonMap contentAtRevision(DungeonMap map, long revision) {
        assertTrue(map.revision() > revision);
        return DungeonMapAuthoring.committedContent(map, revision);
    }

    private record Endpoints(DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
    }
}
