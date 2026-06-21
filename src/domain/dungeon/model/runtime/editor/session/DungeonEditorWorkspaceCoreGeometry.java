package src.domain.dungeon.model.runtime.editor.session;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Cell;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Edge;

public final class DungeonEditorWorkspaceCoreGeometry {
    private DungeonEditorWorkspaceCoreGeometry() {
    }

    public static src.domain.dungeon.model.core.geometry.Cell cell(Cell cell) {
        Cell safeCell = Objects.requireNonNull(cell, "cell");
        return new src.domain.dungeon.model.core.geometry.Cell(safeCell.q(), safeCell.r(), safeCell.level());
    }

    public static List<src.domain.dungeon.model.core.geometry.Edge> edges(List<Edge> edges) {
        Objects.requireNonNull(edges, "edges");
        List<src.domain.dungeon.model.core.geometry.Edge> result = new ArrayList<>();
        for (Edge edge : edges) {
            Edge safeEdge = Objects.requireNonNull(edge, "edge");
            result.addAll(unitEdges(cell(safeEdge.from()), cell(safeEdge.to())));
        }
        return List.copyOf(result);
    }

    public static src.domain.dungeon.model.core.geometry.Edge edge(Edge edge) {
        Edge safeEdge = Objects.requireNonNull(edge, "edge");
        return new src.domain.dungeon.model.core.geometry.Edge(cell(safeEdge.from()), cell(safeEdge.to()));
    }

    public static BoundaryKind boundaryKind(DungeonEditorWorkspaceValues.BoundaryKind boundaryKind) {
        DungeonEditorWorkspaceValues.BoundaryKind safeBoundaryKind =
                Objects.requireNonNull(boundaryKind, "boundaryKind");
        return safeBoundaryKind.isDoor()
                ? BoundaryKind.DOOR
                : BoundaryKind.WALL;
    }

    private static List<src.domain.dungeon.model.core.geometry.Edge> unitEdges(
            src.domain.dungeon.model.core.geometry.Cell from,
            src.domain.dungeon.model.core.geometry.Cell to
    ) {
        if (from.level() != to.level()) {
            return List.of(new src.domain.dungeon.model.core.geometry.Edge(from, to));
        }
        int deltaQ = Integer.compare(to.q(), from.q());
        int deltaR = Integer.compare(to.r(), from.r());
        if (deltaQ != 0 && deltaR != 0) {
            return List.of(new src.domain.dungeon.model.core.geometry.Edge(from, to));
        }
        List<src.domain.dungeon.model.core.geometry.Edge> result = new ArrayList<>();
        for (int q = from.q(), r = from.r(); q != to.q() || r != to.r(); q += deltaQ, r += deltaR) {
            result.add(new src.domain.dungeon.model.core.geometry.Edge(
                    new src.domain.dungeon.model.core.geometry.Cell(q, r, from.level()),
                    new src.domain.dungeon.model.core.geometry.Cell(q + deltaQ, r + deltaR, from.level())));
        }
        return List.copyOf(result);
    }
}
