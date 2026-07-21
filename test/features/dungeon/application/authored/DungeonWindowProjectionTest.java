package features.dungeon.application.authored;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.api.DungeonEditorHandleKind;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowChunkHeader;
import features.dungeon.application.authored.port.DungeonWindowContinuation;
import features.dungeon.application.authored.port.DungeonWindowEntityFragment;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.List;
import org.junit.jupiter.api.Test;

final class DungeonWindowProjectionTest {

    @Test
    void incompleteClusterKeepsVisibleFactsButSuppressesDerivedHandles() {
        DungeonChunkKey chunk = new DungeonChunkKey(1L, 0, 0, 0);
        var room = new DungeonWindowEntityFragment.Room(
                DungeonPatchEntityRef.room(11L), 12L, "Visible room", "",
                List.of(new Cell(1, 1, 0), new Cell(2, 1, 0)),
                List.of(), List.of(chunk), List.of(DungeonPatchEntityRef.roomCluster(12L)));
        var cluster = new DungeonWindowEntityFragment.RoomCluster(
                DungeonPatchEntityRef.roomCluster(12L),
                "Partial cluster",
                List.of(
                        new DungeonWindowEntityFragment.ClusterMemberCellFact(
                                11L, "Visible room", new Cell(1, 1, 0)),
                        new DungeonWindowEntityFragment.ClusterMemberCellFact(
                                11L, "Visible room", new Cell(2, 1, 0))),
                List.of(
                        new DungeonWindowEntityFragment.ClusterBoundaryFact(
                                new Cell(1, 1, 0), Direction.NORTH,
                                DungeonWindowEntityFragment.BoundaryKind.WALL,
                                DungeonTopologyRef.wall(21L)),
                        new DungeonWindowEntityFragment.ClusterBoundaryFact(
                                new Cell(2, 1, 0), Direction.EAST,
                                DungeonWindowEntityFragment.BoundaryKind.DOOR,
                                DungeonTopologyRef.door(31L))),
                List.of(chunk),
                List.of(DungeonPatchEntityRef.room(11L), DungeonPatchEntityRef.room(99L)));
        DungeonWindow window = window(
                chunk,
                List.of(room, cluster),
                List.of(new DungeonWindowContinuation(
                        DungeonPatchEntityRef.roomCluster(12L),
                        List.of(new DungeonChunkKey(1L, 0, 1, 0)))));

        var map = new DungeonWindowProjection().editorSnapshot(window, 0).map();

        assertTrue(map.areas().stream().anyMatch(area -> area.id() == 11L));
        assertEquals(2, map.boundaries().size());
        assertFalse(map.editorHandles().stream().anyMatch(handle ->
                handle.ref().kind() == DungeonEditorHandleKind.CLUSTER_LABEL
                        || handle.ref().kind() == DungeonEditorHandleKind.CLUSTER_CORNER
                        || handle.ref().kind() == DungeonEditorHandleKind.CLUSTER_WALL_RUN));
        assertEquals(1, map.editorHandles().stream()
                .filter(handle -> handle.ref().kind() == DungeonEditorHandleKind.DOOR)
                .filter(handle -> handle.ref().topologyRef().equals(DungeonTopologyRef.door(31L)))
                .filter(handle -> handle.ref().roomId() == 11L)
                .count());
    }

    @Test
    void corridorProjectionConsumesCanonicalClippedRouteFactsWithoutReroutingPartialControls() {
        DungeonChunkKey chunk = new DungeonChunkKey(1L, 0, 0, 0);
        List<Cell> canonicalClippedRoute = List.of(new Cell(8, 7, 0), new Cell(9, 7, 0));
        var corridor = new DungeonWindowEntityFragment.Corridor(
                DungeonPatchEntityRef.corridor(21L),
                0,
                List.of(11L),
                List.of(new DungeonWindowEntityFragment.CorridorWaypointFact(
                        0, 12L, new Cell(2, 2, 0), new Cell(2, 2, 0))),
                List.of(),
                List.of(),
                List.of(),
                List.of(
                        new DungeonWindowEntityFragment.CorridorRouteCellFact(0, 0, canonicalClippedRoute.get(0)),
                        new DungeonWindowEntityFragment.CorridorRouteCellFact(0, 1, canonicalClippedRoute.get(1))),
                List.of(chunk),
                List.of(DungeonPatchEntityRef.room(11L)));

        var map = new DungeonWindowProjection().editorSnapshot(window(chunk, List.of(corridor), List.of()), 0).map();

        assertEquals(canonicalClippedRoute, map.areas().stream()
                .filter(area -> area.id() == 21L)
                .findFirst()
                .orElseThrow()
                .cells());
    }

    private static DungeonWindow window(
            DungeonChunkKey chunk,
            List<DungeonWindowEntityFragment> fragments,
            List<DungeonWindowContinuation> continuations
    ) {
        return new DungeonWindow(
                new DungeonMapHeader(new DungeonMapIdentity(1L), "Map", 7L),
                1L,
                List.of(new DungeonWindowChunkHeader(chunk, 7L)),
                fragments,
                List.of(),
                List.of(),
                new features.dungeon.application.authored.port.DungeonContinuationPage(
                        continuations, java.util.Optional.empty()));
    }
}
