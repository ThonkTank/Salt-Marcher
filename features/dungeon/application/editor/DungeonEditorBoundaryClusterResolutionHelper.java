package features.dungeon.application.editor;

import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.DungeonEditorInteractionValues.CellKey;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.BoundaryTarget;

final class DungeonEditorBoundaryClusterResolutionHelper {
    long resolveBoundaryClusterId(
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
        for (features.dungeon.domain.core.geometry.Cell cell : area.cells()) {
            if (touchingCells.contains(new CellKey(cell.q(), cell.r(), cell.level()))) {
                return true;
            }
        }
        return false;
    }
}
