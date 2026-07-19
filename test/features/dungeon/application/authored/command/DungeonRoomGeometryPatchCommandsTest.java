package features.dungeon.application.authored.command;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.application.authored.port.DungeonIdentityRange;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.corridor.DungeonCorridorEndpoint;
import features.dungeon.domain.core.structure.corridor.OrthogonalCorridorRoutingPolicy;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

final class DungeonRoomGeometryPatchCommandsTest {

    @Test
    void roomPaintCarriesExactDependentCorridorChange() {
        DungeonMap rooms = DungeonCommandTestIdentities.paint(
                emptyMap(), new Cell(1, 1, 0), new Cell(2, 2, 0), 1L, 1L);
        rooms = DungeonCommandTestIdentities.paint(
                rooms, new Cell(7, 1, 0), new Cell(8, 2, 0), 40L, 40L);
        var first = rooms.rooms().rooms().getFirst();
        var second = rooms.rooms().rooms().getLast();
        DungeonMap connected = accepted(new CreateCorridorCommand(
                new OrthogonalCorridorRoutingPolicy()).plan(
                rooms,
                DungeonCommandTestIdentities.corridor(
                        90L, 100L, 0L, null, 80L, 80L),
                DungeonCorridorEndpoint.door(
                        first.roomId(), first.clusterId(), new Cell(2, 1, 0), Direction.EAST,
                        DungeonTopologyRef.empty()),
                DungeonCorridorEndpoint.door(
                        second.roomId(), second.clusterId(), new Cell(7, 1, 0), Direction.WEST,
                        DungeonTopologyRef.empty()))).patch().applyTo(rooms);

        DungeonCommandResult.Accepted result = accepted(new RoomRectangleCommand().plan(
                connected,
                new Cell(3, 1, 0),
                new Cell(3, 1, 0),
                false,
                range(120L),
                range(120L)));

        assertFalse(result.patch().changes().stream().anyMatch(CorridorChange.class::isInstance),
                "a derived route impact must not become an invented authored corridor change");
        assertEquals(
                connected.paintRoomRectangle(
                        new Cell(3, 1, 0),
                        new Cell(3, 1, 0),
                        DungeonCommandTestIdentities.rooms(120L, 120L)),
                result.patch().applyTo(connected));
    }

    @Test
    void roomPaintAndDeleteCarryExactCreateUpdateAndDeleteChanges() {
        DungeonMap empty = emptyMap();
        RoomRectangleCommand command = new RoomRectangleCommand();

        DungeonCommandResult.Accepted paintedResult = assertInstanceOf(
                DungeonCommandResult.Accepted.class,
                command.plan(
                        empty,
                        new Cell(-2, -2, 0),
                        new Cell(-1, -1, 0),
                        false,
                        range(1L),
                        range(1L)));
        assertTrue(paintedResult.patch().changes().stream()
                .anyMatch(change -> change instanceof RoomRegionChange room
                        && room.before() == null
                        && room.after() != null));
        assertTrue(paintedResult.patch().changes().stream()
                .anyMatch(change -> change instanceof RoomClusterChange cluster
                        && cluster.before() == null
                        && cluster.after() != null));
        assertEquals(Set.of(new DungeonChunkKey(73L, 0, -1, -1)), paintedResult.patch().touchedChunks());
        DungeonMap painted = paintedResult.patch().applyTo(empty);
        assertEquals(empty.revision() + 1L, painted.revision());
        assertTrue(painted.topology().roomClusters().getFirst().orderedAuthoredBoundaries().stream()
                .filter(boundary -> boundary.kind().renderable())
                .allMatch(boundary -> boundary.topologyRef().present()));
        assertEquals(empty, contentAtRevision(paintedResult.inverse().applyTo(painted), empty.revision()));

        DungeonCommandResult.Accepted deletedResult = assertInstanceOf(
                DungeonCommandResult.Accepted.class,
                command.plan(
                        painted,
                        new Cell(-2, -2, 0),
                        new Cell(-1, -1, 0),
                        true,
                        range(40L),
                        range(40L)));
        assertTrue(deletedResult.patch().changes().stream()
                .anyMatch(change -> change instanceof RoomRegionChange room
                        && room.before() != null
                        && room.after() == null));
        assertTrue(deletedResult.patch().changes().stream()
                .anyMatch(change -> change instanceof RoomClusterChange cluster
                        && cluster.before() != null
                        && cluster.after() == null));
        DungeonMap deleted = deletedResult.patch().applyTo(painted);
        assertTrue(deleted.rooms().rooms().isEmpty());
        assertTrue(deleted.topology().roomClusters().isEmpty());
        assertEquals(painted, contentAtRevision(deletedResult.inverse().applyTo(deleted), painted.revision()));
    }

    @Test
    void boundaryAndStretchCommandsReproduceAggregateGeometryAndInverse() {
        DungeonMap painted = accepted(new RoomRectangleCommand().plan(
                emptyMap(),
                new Cell(1, 1, 0),
                new Cell(2, 2, 0),
                false,
                range(1L),
                range(1L))).patch().applyTo(emptyMap());
        long clusterId = painted.topology().roomClusters().getFirst().clusterId();
        Edge northWest = Edge.sideOf(new Cell(1, 1, 0), Direction.NORTH);
        Edge northEast = Edge.sideOf(new Cell(2, 1, 0), Direction.NORTH);

        DungeonCommandResult.Accepted doorResult = accepted(new ClusterBoundaryCommand().plan(
                painted,
                clusterId,
                List.of(northWest),
                BoundaryKind.DOOR,
                false,
                range(40L),
                range(40L)));
        DungeonMap withDoor = doorResult.patch().applyTo(painted);
        assertEquals(
                painted.editClusterBoundaries(
                        clusterId,
                        List.of(northWest),
                        BoundaryKind.DOOR,
                        false,
                        DungeonCommandTestIdentities.rooms(40L, 40L)),
                withDoor);
        assertEquals(painted, contentAtRevision(doorResult.inverse().applyTo(withDoor), painted.revision()));

        DungeonCommandResult.Accepted stretchResult = accepted(new ClusterBoundaryStretchCommand().plan(
                painted,
                clusterId,
                List.of(northWest, northEast),
                0,
                -1,
                0,
                range(80L),
                range(80L)));
        DungeonMap stretched = stretchResult.patch().applyTo(painted);
        assertEquals(
                painted.moveBoundaryStretch(
                        clusterId,
                        List.of(northWest, northEast),
                        0,
                        -1,
                        0,
                        DungeonCommandTestIdentities.rooms(80L, 80L)),
                stretched);
        assertEquals(painted, contentAtRevision(stretchResult.inverse().applyTo(stretched), painted.revision()));
        assertTrue(stretchResult.patch().encodedBytes() > 0L);
    }

    @Test
    void cornerMovementIsExactAndInvalidBoundaryDeletionKeepsTypedReason() {
        DungeonMap painted = accepted(new RoomRectangleCommand().plan(
                emptyMap(),
                new Cell(1, 1, 0),
                new Cell(2, 2, 0),
                false,
                range(1L),
                range(1L))).patch().applyTo(emptyMap());
        long clusterId = painted.topology().roomClusters().getFirst().clusterId();
        Cell corner = painted.topology().roomClusters().getFirst().authoredBoundaryVertices(0).getFirst();

        DungeonCommandResult.Accepted cornerResult = accepted(new ClusterCornerCommand().plan(
                painted,
                clusterId,
                corner,
                -1,
                -1,
                0,
                range(40L),
                range(40L)));
        DungeonMap moved = cornerResult.patch().applyTo(painted);
        assertEquals(painted.moveClusterCorner(
                clusterId,
                corner,
                -1,
                -1,
                0,
                DungeonCommandTestIdentities.rooms(40L, 40L)), moved);
        assertEquals(painted, contentAtRevision(cornerResult.inverse().applyTo(moved), painted.revision()));

        DungeonCommandResult.Rejected rejected = assertInstanceOf(
                DungeonCommandResult.Rejected.class,
                new ClusterBoundaryCommand().plan(
                        painted,
                        clusterId,
                        List.of(Edge.sideOf(new Cell(1, 1, 0), Direction.NORTH)),
                        BoundaryKind.WALL,
                        true,
                        range(80L),
                        range(80L)));
        assertEquals(
                DungeonEditorCommandOutcome.RejectionReason.PROTECTED_EXTERIOR_WALL,
                rejected.reason());
    }

    private static DungeonCommandResult.Accepted accepted(DungeonCommandResult result) {
        return assertInstanceOf(DungeonCommandResult.Accepted.class, result);
    }

    private static DungeonMap emptyMap() {
        return DungeonMapAuthoring.empty(new DungeonMapIdentity(73L), "Room Geometry Patches");
    }

    private static DungeonIdentityRange range(long firstId) {
        return DungeonCommandTestIdentities.range(firstId, 32);
    }

    private static DungeonMap contentAtRevision(DungeonMap map, long revision) {
        assertTrue(map.revision() > revision);
        return DungeonMapAuthoring.committedContent(map, revision);
    }
}
