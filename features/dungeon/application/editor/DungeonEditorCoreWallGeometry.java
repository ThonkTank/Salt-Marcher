package features.dungeon.application.editor;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.DungeonEditorInteractionValues.CellKey;
import features.dungeon.application.editor.DungeonEditorInteractionValues.VertexKey;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.EdgeKey;

final class DungeonEditorCoreWallGeometry {
    private DungeonEditorCoreWallGeometry() {
    }

    static List<Cell> cells(Set<CellKey> cells) {
        List<Cell> result = new ArrayList<>();
        for (CellKey cell : cells) {
            result.add(cell(cell));
        }
        return List.copyOf(result);
    }

    static List<Edge> edges(Set<EdgeKey> edges) {
        List<Edge> result = new ArrayList<>();
        for (EdgeKey edge : edges) {
            result.add(edge(edge));
        }
        return List.copyOf(result);
    }

    static Cell cell(CellKey cell) {
        return new Cell(cell.q(), cell.r(), cell.level());
    }

    static Cell cell(VertexKey vertex) {
        return new Cell(vertex.q(), vertex.r(), vertex.level());
    }

    static Edge edge(DungeonEditorWorkspaceValues.Edge edge) {
        return new Edge(cell(edge.from()), cell(edge.to()));
    }

    static Edge edge(EdgeKey edge) {
        return new Edge(
                new Cell(edge.start().q(), edge.start().r(), edge.start().level()),
                new Cell(edge.end().q(), edge.end().r(), edge.end().level()));
    }

    static EdgeKey runtimeEdge(Edge edge) {
        return EdgeKey.between(
                new VertexKey(edge.from().q(), edge.from().r(), edge.from().level()),
                new VertexKey(edge.to().q(), edge.to().r(), edge.to().level()));
    }

    private static Cell cell(DungeonEditorWorkspaceValues.Cell cell) {
        return new Cell(cell.q(), cell.r(), cell.level());
    }
}
