package features.dungeon.application.editor.helper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Boundary;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.geometry.EdgeKey;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.component.boundary.BoundaryKind;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

final class PreviewDungeonEditorSurfaceBoundaryMoveHelperTest {

    @Test
    void splitRunMovedTwoCellsPublishesUnitConnectorsToStationaryJunction() {
        PreviewDungeonEditorSurfaceBoundaryMoveHelper helper =
                new PreviewDungeonEditorSurfaceBoundaryMoveHelper();
        List<Boundary> boundaries = List.of(
                wall(1L, edge(3, 1, 3, 2)),
                wall(2L, edge(3, 2, 3, 3)),
                wall(3L, edge(3, 3, 3, 4)));

        List<Boundary> preview = helper.movedSourceEdgeBoundaries(
                boundaries,
                List.of(edge(3, 1, 3, 2), edge(3, 2, 3, 3)),
                -2,
                0,
                0);

        Set<EdgeKey> keys = preview.stream()
                .map(Boundary::edge)
                .map(EdgeKey::from)
                .collect(Collectors.toSet());
        assertTrue(keys.contains(EdgeKey.from(edge(1, 3, 2, 3))));
        assertTrue(keys.contains(EdgeKey.from(edge(2, 3, 3, 3))));
        assertTrue(preview.stream().allMatch(boundary -> unit(boundary.edge())));
        assertEquals(preview.size(), keys.size(), "preview edges remain deterministically unique");
    }

    private static Boundary wall(long id, Edge edge) {
        return new Boundary(BoundaryKind.WALL, id, "Wall", edge, DungeonTopologyRef.empty());
    }

    private static Edge edge(int fromQ, int fromR, int toQ, int toR) {
        return new Edge(new Cell(fromQ, fromR, 0), new Cell(toQ, toR, 0));
    }

    private static boolean unit(Edge edge) {
        return edge.from().level() == edge.to().level()
                && Math.abs(edge.from().q() - edge.to().q())
                        + Math.abs(edge.from().r() - edge.to().r()) == 1;
    }
}
