package src.features.dungeon.runtime;

import java.util.Map;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;

final class DungeonEditorGridPointerTargetAssembler {
    private DungeonEditorGridPointerTargetAssembler() {
    }

    static void addTargets(
            Map<String, DungeonEditorRuntimePointerTarget> targets,
            DungeonEditorMapSnapshot map,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonEditorPreview preview,
            DungeonEditorMapSurfaceSnapshot snapshot
    ) {
        DungeonEditorCellFeaturePointerTargets.addTargets(targets, map, snapshot);
        DungeonEditorBoundaryPointerTargets.addTargets(targets, map, snapshot);
        DungeonEditorHandlePointerTargets.addTargets(targets, map, selection, preview, snapshot);
        DungeonEditorLabelPointerTargets.addTargets(targets, map, snapshot);
    }
}
