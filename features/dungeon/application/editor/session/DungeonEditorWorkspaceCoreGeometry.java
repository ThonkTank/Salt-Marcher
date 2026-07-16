package features.dungeon.application.editor.session;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Cell;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Edge;

public final class DungeonEditorWorkspaceCoreGeometry {
    private DungeonEditorWorkspaceCoreGeometry() {
    }

    public static features.dungeon.domain.core.geometry.Cell cell(Cell cell) {
        Cell safeCell = Objects.requireNonNull(cell, "cell");
        return new features.dungeon.domain.core.geometry.Cell(safeCell.q(), safeCell.r(), safeCell.level());
    }

    public static List<features.dungeon.domain.core.geometry.Edge> edges(List<Edge> edges) {
        Objects.requireNonNull(edges, "edges");
        List<features.dungeon.domain.core.geometry.Edge> result = new ArrayList<>();
        for (Edge edge : edges) {
            Edge safeEdge = Objects.requireNonNull(edge, "edge");
            result.addAll(unitEdges(cell(safeEdge.from()), cell(safeEdge.to())));
        }
        return List.copyOf(result);
    }

    public static features.dungeon.domain.core.geometry.Edge edge(Edge edge) {
        Edge safeEdge = Objects.requireNonNull(edge, "edge");
        return new features.dungeon.domain.core.geometry.Edge(cell(safeEdge.from()), cell(safeEdge.to()));
    }

    public static BoundaryKind boundaryKind(DungeonEditorWorkspaceValues.BoundaryKind boundaryKind) {
        DungeonEditorWorkspaceValues.BoundaryKind safeBoundaryKind =
                Objects.requireNonNull(boundaryKind, "boundaryKind");
        return safeBoundaryKind.isDoor()
                ? BoundaryKind.DOOR
                : BoundaryKind.WALL;
    }

    private static List<features.dungeon.domain.core.geometry.Edge> unitEdges(
            features.dungeon.domain.core.geometry.Cell from,
            features.dungeon.domain.core.geometry.Cell to
    ) {
        if (from.level() != to.level()) {
            return List.of(new features.dungeon.domain.core.geometry.Edge(from, to));
        }
        int deltaQ = Integer.compare(to.q(), from.q());
        int deltaR = Integer.compare(to.r(), from.r());
        if (deltaQ != 0 && deltaR != 0) {
            return List.of(new features.dungeon.domain.core.geometry.Edge(from, to));
        }
        List<features.dungeon.domain.core.geometry.Edge> result = new ArrayList<>();
        for (int q = from.q(), r = from.r(); q != to.q() || r != to.r(); q += deltaQ, r += deltaR) {
            result.add(new features.dungeon.domain.core.geometry.Edge(
                    new features.dungeon.domain.core.geometry.Cell(q, r, from.level()),
                    new features.dungeon.domain.core.geometry.Cell(q + deltaQ, r + deltaR, from.level())));
        }
        return List.copyOf(result);
    }
}
