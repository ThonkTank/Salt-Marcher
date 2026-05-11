package src.domain.dungeoneditor.model.workspace.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;

final class DungeonEditorWorkspaceCellBoundaryTranslationHelper {

    private DungeonEditorWorkspaceCellBoundaryTranslationHelper() {
    }

    static DungeonCellRef toDomainCell(DungeonEditorWorkspaceValues.Cell cell) {
        DungeonEditorWorkspaceValues.Cell safeCell = cell == null
                ? DungeonEditorWorkspaceValues.Cell.empty()
                : cell;
        return new DungeonCellRef(safeCell.q(), safeCell.r(), safeCell.level());
    }

    static DungeonEdgeRef toDomainEdge(DungeonEditorWorkspaceValues.Edge edge) {
        DungeonEditorWorkspaceValues.Edge safeEdge = edge == null
                ? new DungeonEditorWorkspaceValues.Edge(
                        DungeonEditorWorkspaceValues.Cell.empty(),
                        DungeonEditorWorkspaceValues.Cell.empty())
                : edge;
        return new DungeonEdgeRef(toDomainCell(safeEdge.from()), toDomainCell(safeEdge.to()));
    }

    static DungeonEditorWorkspaceValues.Cell toWorkspaceCell(@Nullable DungeonCellRef cell) {
        return cell == null
                ? DungeonEditorWorkspaceValues.Cell.empty()
                : new DungeonEditorWorkspaceValues.Cell(cell.q(), cell.r(), cell.level());
    }

    static DungeonEditorWorkspaceValues.Edge toWorkspaceEdge(@Nullable DungeonEdgeRef edge) {
        return edge == null
                ? new DungeonEditorWorkspaceValues.Edge(
                        DungeonEditorWorkspaceValues.Cell.empty(),
                        DungeonEditorWorkspaceValues.Cell.empty())
                : new DungeonEditorWorkspaceValues.Edge(
                        toWorkspaceCell(edge.from()),
                        toWorkspaceCell(edge.to()));
    }
}
