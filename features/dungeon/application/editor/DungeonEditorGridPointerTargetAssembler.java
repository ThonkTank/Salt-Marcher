package features.dungeon.application.editor;

import java.util.Map;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.DungeonEditorMapSurfaceSnapshot;
import features.dungeon.api.DungeonEditorPreview;
import features.dungeon.api.DungeonEditorStateSnapshot;

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
