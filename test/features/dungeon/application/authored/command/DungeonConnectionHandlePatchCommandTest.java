package features.dungeon.application.authored.command;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.corridor.DungeonCorridorEndpoint;
import features.dungeon.domain.core.structure.corridor.OrthogonalCorridorRoutingPolicy;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.stair.StairGeometrySpec;
import features.dungeon.domain.core.structure.stair.StairShape;
import java.util.Comparator;
import org.junit.jupiter.api.Test;

final class DungeonConnectionHandlePatchCommandTest {
    private static final long MAP_ID = 81L;

    @Test
    void clusterMoveCarriesExactRoomAndBoundaryChangesAcrossChunks() {
        DungeonMap current = corridorMap();
        long clusterId = current.rooms().rooms().getFirst().clusterId();
        MoveConnectionHandleCommand command = new MoveConnectionHandleCommand();

        DungeonCommandResult.Accepted result = accepted(command.planCluster(current, clusterId, -260, 2, 0));

        assertTrue(result.patch().changes().stream().anyMatch(RoomRegionChange.class::isInstance));
        assertTrue(result.patch().changes().stream().anyMatch(RoomClusterChange.class::isInstance));
        assertTrue(result.patch().touchedChunks().stream().anyMatch(chunk -> chunk.chunkQ() == -3));
        DungeonMap moved = result.patch().applyTo(current);
        assertEquals(
                DungeonMapAuthoring.committedContent(
                        current.moveCluster(clusterId, -260, 2, 0),
                        current.revision() + 1L),
                moved);
        assertEquals(current, contentAtRevision(result.inverse().applyTo(moved), current.revision()));
    }

    @Test
    void stairAnchorMoveUsesExactStairChangeAndRejectsNoEffect() {
        StairGeometrySpec spec = new StairGeometrySpec(
                StairShape.STRAIGHT,
                new Cell(2, 2, 0),
                Direction.NORTH,
                1,
                2);
        DungeonMap empty = emptyMap();
        DungeonMap current = accepted(new CreateStairCommand().plan(empty, 17L, spec)).patch().applyTo(empty);
        MoveConnectionHandleCommand command = new MoveConnectionHandleCommand();

        DungeonCommandResult.Accepted result = accepted(command.planStairAnchor(current, 17L, 0, 1, 0, 0));
        DungeonMap moved = result.patch().applyTo(current);
        assertTrue(result.patch().changes().stream().allMatch(StairChange.class::isInstance));
        assertEquals(current.revision() + 1L, moved.revision());
        assertEquals(current, contentAtRevision(result.inverse().applyTo(moved), current.revision()));

        DungeonCommandResult.Rejected noEffect = assertInstanceOf(
                DungeonCommandResult.Rejected.class,
                command.planStairAnchor(current, 17L, 0, 0, 0, 0));
        DungeonCommandResult.Rejected invalid = assertInstanceOf(
                DungeonCommandResult.Rejected.class,
                command.planCorridorWaypoint(current, 0L, 0, 1, 0, 0));
        assertEquals(DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT, noEffect.reason());
        assertEquals(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET, invalid.reason());
    }

    private static DungeonMap corridorMap() {
        DungeonMap rooms = emptyMap()
                .paintRoomRectangle(new Cell(1, 1, 0), new Cell(2, 2, 0))
                .paintRoomRectangle(new Cell(7, 1, 0), new Cell(8, 2, 0));
        RoomRegion startRoom = rooms.rooms().rooms().getFirst();
        RoomRegion endRoom = rooms.rooms().rooms().getLast();
        Cell startCell = startRoom.floorCells().stream().max(Comparator.comparingInt(Cell::q)).orElseThrow();
        Cell endCell = endRoom.floorCells().stream().min(Comparator.comparingInt(Cell::q)).orElseThrow();
        DungeonCorridorEndpoint start = DungeonCorridorEndpoint.door(
                startRoom.roomId(),
                startRoom.clusterId(),
                startCell,
                Direction.EAST,
                DungeonTopologyRef.empty());
        DungeonCorridorEndpoint end = DungeonCorridorEndpoint.door(
                endRoom.roomId(),
                endRoom.clusterId(),
                endCell,
                Direction.WEST,
                DungeonTopologyRef.empty());
        return accepted(new CreateCorridorCommand(new OrthogonalCorridorRoutingPolicy()).plan(
                rooms,
                91L,
                start,
                end)).patch().applyTo(rooms);
    }

    private static DungeonMap emptyMap() {
        return DungeonMapAuthoring.empty(new DungeonMapIdentity(MAP_ID), "Connection Handle Patches");
    }

    private static DungeonCommandResult.Accepted accepted(DungeonCommandResult result) {
        return assertInstanceOf(DungeonCommandResult.Accepted.class, result);
    }

    private static DungeonMap contentAtRevision(DungeonMap map, long revision) {
        assertTrue(map.revision() > revision);
        return DungeonMapAuthoring.committedContent(map, revision);
    }
}
