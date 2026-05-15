package src.domain.dungeon.model.editor.helper;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorProjectionGeometryProjectionHelper {

    private DungeonEditorProjectionGeometryProjectionHelper() {
    }

    public static boolean edgeTouchesAnyCell(
            DungeonEditorWorkspaceValues.@Nullable Edge edge,
            List<DungeonEditorWorkspaceValues.Cell> cells
    ) {
        for (DungeonEditorWorkspaceValues.Cell touchingCell : touchingCells(edge)) {
            for (DungeonEditorWorkspaceValues.Cell cell : cells) {
                if (sameCell(touchingCell, cell)) {
                    return true;
                }
            }
        }
        return false;
    }

    public static List<DungeonEditorWorkspaceValues.Cell> touchingCells(DungeonEditorWorkspaceValues.@Nullable Edge edge) {
        if (edge == null) {
            return List.of();
        }
        DungeonEditorWorkspaceValues.Cell from = edge.from();
        DungeonEditorWorkspaceValues.Cell to = edge.to();
        if (from == null || to == null || from.level() != to.level()) {
            return List.of();
        }
        if (from.r() == to.r()) {
            return horizontalTouchingCells(from, to);
        }
        if (from.q() == to.q()) {
            return verticalTouchingCells(from, to);
        }
        return List.of();
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

    private static List<DungeonEditorWorkspaceValues.Cell> horizontalTouchingCells(
            DungeonEditorWorkspaceValues.Cell from,
            DungeonEditorWorkspaceValues.Cell to
    ) {
        int minQ = Math.min(from.q(), to.q());
        int maxQ = Math.max(from.q(), to.q());
        List<DungeonEditorWorkspaceValues.Cell> result = new ArrayList<>();
        for (int q = minQ; q < maxQ; q++) {
            result.add(new DungeonEditorWorkspaceValues.Cell(q, from.r() - 1, from.level()));
            result.add(new DungeonEditorWorkspaceValues.Cell(q, from.r(), from.level()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonEditorWorkspaceValues.Cell> verticalTouchingCells(
            DungeonEditorWorkspaceValues.Cell from,
            DungeonEditorWorkspaceValues.Cell to
    ) {
        int minR = Math.min(from.r(), to.r());
        int maxR = Math.max(from.r(), to.r());
        List<DungeonEditorWorkspaceValues.Cell> result = new ArrayList<>();
        for (int r = minR; r < maxR; r++) {
            result.add(new DungeonEditorWorkspaceValues.Cell(from.q() - 1, r, from.level()));
            result.add(new DungeonEditorWorkspaceValues.Cell(from.q(), r, from.level()));
        }
        return List.copyOf(result);
    }

    private static boolean sameCell(DungeonEditorWorkspaceValues.Cell left, DungeonEditorWorkspaceValues.Cell right) {
        return left.q() == right.q() && left.r() == right.r() && left.level() == right.level();
    }

    public record CellCenter(double q, double r) {
    }
}
