package src.domain.dungeon.model.editor.helper;

import java.util.List;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorBoundaryTouchGeometry;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.published.DungeonEditorMapProjectionSnapshot;

public final class DungeonEditorProjectionGeometryProjectionHelper {

    private DungeonEditorProjectionGeometryProjectionHelper() {
    }

    public static boolean edgeTouchesAnyCell(
            DungeonEditorWorkspaceValues.Edge edge,
            List<DungeonEditorWorkspaceValues.Cell> cells
    ) {
        return edge != null && DungeonEditorBoundaryTouchGeometry.fromEdge(edge).touchesAnyCell(cells);
    }

    public static CellCenter centerOf(List<DungeonEditorMapProjectionSnapshot.CellProjection> cells) {
        double q = 0.0;
        double r = 0.0;
        for (DungeonEditorMapProjectionSnapshot.CellProjection cell : cells) {
            q += cell.q() + 0.5;
            r += cell.r() + 0.5;
        }
        int count = Math.max(1, cells.size());
        return new CellCenter(q / count, r / count);
    }

    public record CellCenter(double q, double r) {
    }
}
