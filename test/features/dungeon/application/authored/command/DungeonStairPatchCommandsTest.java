package features.dungeon.application.authored.command;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.application.authored.port.DungeonIdentityRange;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapAuthoring.AuthoredContent;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.stair.Stair;
import features.dungeon.domain.core.structure.stair.StairCollection;
import features.dungeon.domain.core.structure.stair.StairGeometrySpec;
import features.dungeon.domain.core.structure.stair.StairShape;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

final class DungeonStairPatchCommandsTest {

    private static final long MAP_ID = 95L;
    private static final long STAIR_ID = 17L;
    private static final DungeonIdentityRange STAIR_EXIT_IDS = new DungeonIdentityRange(100L, 8);

    @Test
    void stairCreateUpdateAndDeleteProduceExactInvertiblePatches() {
        DungeonMap empty = emptyMap();
        StairGeometrySpec initialSpec = new StairGeometrySpec(
                StairShape.STRAIGHT,
                new Cell(1, 1, 0),
                Direction.NORTH,
                1,
                2);

        DungeonCommandResult.Accepted createdResult = assertInstanceOf(
                DungeonCommandResult.Accepted.class,
                new CreateStairCommand().plan(empty, STAIR_ID, STAIR_EXIT_IDS, initialSpec));
        assertEquals(
                DungeonPatchEntityRef.stair(STAIR_ID),
                createdResult.patch().resultFacts().affectedEntities().getFirst());
        assertEquals(Set.of(
                new DungeonChunkKey(MAP_ID, 0, 0, 0),
                new DungeonChunkKey(MAP_ID, 1, 0, 0),
                new DungeonChunkKey(MAP_ID, 2, 0, 0)), createdResult.patch().touchedChunks());
        DungeonMap created = createdResult.patch().applyTo(empty);
        Stair initial = created.stairs().stair(STAIR_ID);
        assertEquals(Stair.authored(
                STAIR_ID,
                MAP_ID,
                initialSpec,
                CreateStairCommand.reservedIds(STAIR_EXIT_IDS)), initial);
        DungeonMap createUndone = createdResult.inverse().applyTo(created);
        assertNull(createUndone.stairs().stair(STAIR_ID));
        assertEquals(empty.revision() + 2L, createUndone.revision());

        StairGeometrySpec updatedSpec = new StairGeometrySpec(
                StairShape.SQUARE,
                new Cell(4, 4, 0),
                Direction.EAST,
                3,
                2);
        DungeonCommandResult.Accepted updatedResult = assertInstanceOf(
                DungeonCommandResult.Accepted.class,
                new UpdateStairGeometryCommand().plan(
                        created,
                        STAIR_ID,
                        new DungeonIdentityRange(200L, 8),
                        updatedSpec));
        DungeonMap updated = updatedResult.patch().applyTo(created);
        Stair recomputed = updated.stairs().stair(STAIR_ID);
        assertEquals(STAIR_ID, recomputed.stairId());
        assertEquals(initial.name(), recomputed.name());
        assertEquals(updatedSpec.generatedPath(), recomputed.path());
        assertEquals(initial.exits().stream().map(exit -> exit.exitId()).toList(),
                recomputed.exits().stream().map(exit -> exit.exitId()).toList());
        DungeonMap updateUndone = updatedResult.inverse().applyTo(updated);
        assertEquals(initial, updateUndone.stairs().stair(STAIR_ID));

        DungeonCommandResult.Accepted deletedResult = assertInstanceOf(
                DungeonCommandResult.Accepted.class,
                new DeleteStairCommand().plan(updated, STAIR_ID));
        DungeonMap deleted = deletedResult.patch().applyTo(updated);
        assertNull(deleted.stairs().stair(STAIR_ID));
        DungeonMap deleteUndone = deletedResult.inverse().applyTo(deleted);
        assertEquals(recomputed, deleteUndone.stairs().stair(STAIR_ID));
        assertThrows(IllegalArgumentException.class, () -> deletedResult.patch().applyTo(deleted));
        assertTrue(deletedResult.patch().encodedBytes() > recomputed.path().size());
    }

    @Test
    void invalidGeometryCollisionAndNoEffectRejectWithoutMutation() {
        DungeonMap empty = emptyMap();
        StairGeometrySpec valid = new StairGeometrySpec(
                StairShape.STRAIGHT,
                new Cell(1, 1, 0),
                Direction.NORTH,
                1,
                2);
        DungeonMap created = assertInstanceOf(
                DungeonCommandResult.Accepted.class,
                new CreateStairCommand().plan(empty, STAIR_ID, STAIR_EXIT_IDS, valid)).patch().applyTo(empty);

        DungeonCommandResult.Rejected collision = assertInstanceOf(
                DungeonCommandResult.Rejected.class,
                new CreateStairCommand().plan(created, STAIR_ID, STAIR_EXIT_IDS, valid));
        DungeonCommandResult.Rejected noEffect = assertInstanceOf(
                DungeonCommandResult.Rejected.class,
                new UpdateStairGeometryCommand().plan(
                        created,
                        STAIR_ID,
                        new DungeonIdentityRange(200L, 8),
                        valid));
        StairGeometrySpec unsupported = new StairGeometrySpec(
                StairShape.LADDER,
                new Cell(8, 8, 0),
                Direction.NORTH,
                3,
                2);
        DungeonCommandResult.Rejected invalid = assertInstanceOf(
                DungeonCommandResult.Rejected.class,
                new CreateStairCommand().plan(
                        empty,
                        STAIR_ID + 1L,
                        new DungeonIdentityRange(300L, 8),
                        unsupported));

        assertEquals(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET, collision.reason());
        assertEquals(DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT, noEffect.reason());
        assertEquals(DungeonEditorCommandOutcome.RejectionReason.INVALID_STAIR_GEOMETRY, invalid.reason());
        assertEquals(1, created.stairs().stairs().size());
    }

    @Test
    void roomInteriorAndCorridorBindingRejectAtomically() {
        DungeonMap roomMap = DungeonCommandTestIdentities.paint(
                emptyMap(), new Cell(1, 1, 0), new Cell(5, 3, 0), 1L, 1L);
        StairGeometrySpec crossing = new StairGeometrySpec(
                StairShape.STRAIGHT,
                new Cell(1, 1, 0),
                Direction.EAST,
                5,
                1);
        DungeonCommandResult.Rejected roomCollision = assertInstanceOf(
                DungeonCommandResult.Rejected.class,
                new CreateStairCommand().plan(roomMap, STAIR_ID, STAIR_EXIT_IDS, crossing));
        DungeonMap boundMap = corridorBoundStairMap();
        DungeonCommandResult.Rejected boundDelete = assertInstanceOf(
                DungeonCommandResult.Rejected.class,
                new DeleteStairCommand().plan(boundMap, STAIR_ID));

        assertEquals(DungeonEditorCommandOutcome.RejectionReason.INVALID_STAIR_GEOMETRY, roomCollision.reason());
        assertEquals(DungeonEditorCommandOutcome.RejectionReason.REFERENCED_CONNECTION, boundDelete.reason());
        assertEquals(boundMap.stairs().stair(STAIR_ID), boundMap.stairs().stairs().getFirst());
    }

    private static DungeonMap emptyMap() {
        return DungeonMapAuthoring.empty(new DungeonMapIdentity(MAP_ID), "Stair Patch Commands");
    }

    private static DungeonMap corridorBoundStairMap() {
        DungeonMap base = emptyMap();
        Stair bound = Stair.corridorBound(
                STAIR_ID,
                MAP_ID,
                44L,
                List.of(new Cell(0, 0, 0), new Cell(0, 1, 0)),
                new Cell(0, 1, 1),
                List.of(401L, 402L));
        return DungeonMapAuthoring.authored(
                base.metadata().mapId(),
                base.metadata().mapName(),
                new AuthoredContent(
                        base.topology(),
                        base.topologyIndex(),
                        base.rooms(),
                        base.corridors(),
                        new StairCollection(List.of(bound)),
                        base.transitionCatalog().transitions(),
                        base.featureMarkers()),
                base.revision());
    }
}
