package features.dungeon.application.editor;

import java.util.Map;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.DungeonEditorPreview;

final class DungeonEditorGridPointerTargetAssembler {
    private DungeonEditorGridPointerTargetAssembler() {
    }

    static void addTargets(
            Map<String, features.dungeon.api.editor.DungeonEditorPointerInput.Target> targets,
            DungeonEditorMapSnapshot map,
            features.dungeon.api.editor.DungeonEditorSelection selection,
            DungeonEditorPreview preview,
            DungeonEditorSurfaceProjection snapshot
    ) {
        DungeonEditorCellFeaturePointerTargets.addTargets(targets, map, snapshot);
        DungeonEditorBoundaryPointerTargets.addTargets(targets, map, snapshot);
        DungeonEditorHandlePointerTargets.addTargets(targets, map, selection, preview, snapshot);
        DungeonEditorLabelPointerTargets.addTargets(targets, map, snapshot);
    }
}
