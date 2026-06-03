package src.domain.dungeon.model.worldspace.helper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorBoundaryTouchGeometry;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

public final class DungeonEditorBoundaryClusterResolutionHelper {
    public long resolveBoundaryClusterId(
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot snapshot,
            @Nullable BoundaryTarget boundaryTarget
    ) {
        if (snapshot == null || boundaryTarget == null || !boundaryTarget.present()) {
            return 0L;
        }
        List<CellKey> touchingCells =
                DungeonEditorBoundaryTouchGeometry.fromEdge(boundaryTarget.edgeRef()).touchingCellKeys();
        for (DungeonEditorWorkspaceValues.Area area : snapshot.areas()) {
            if (!area.kind().isRoom() || !DungeonEditorWorkspaceValues.hasId(area.clusterId())) {
                continue;
            }
            if (areaTouchesCells(area, touchingCells)) {
                return area.clusterId();
            }
        }
        return 0L;
    }

    private static boolean areaTouchesCells(DungeonEditorWorkspaceValues.Area area, List<CellKey> touchingCells) {
        for (DungeonEditorWorkspaceValues.Cell cell : area.cells()) {
            if (touchingCells.contains(new CellKey(cell.q(), cell.r(), cell.level()))) {
                return true;
            }
        }
        return false;
    }
}
