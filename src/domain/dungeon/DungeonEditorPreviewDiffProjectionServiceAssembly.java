package src.domain.dungeon;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorPreviewDiff;

final class DungeonEditorPreviewDiffProjectionServiceAssembly {

    private DungeonEditorPreviewDiffProjectionServiceAssembly() {
    }

    static DungeonEditorPreviewDiff previewDiff(
            DungeonEditorMapSnapshot committedMap,
            @Nullable DungeonEditorMapSnapshot previewMap
    ) {
        if (previewMap == null) {
            return DungeonEditorPreviewDiff.empty();
        }
        DungeonEditorPreviewFactDiffProjectionServiceAssembly<DungeonEditorMapSnapshot.Area> areaDiff =
                DungeonEditorPreviewAreaDiffProjectionServiceAssembly.diff(committedMap, previewMap);
        DungeonEditorPreviewFactDiffProjectionServiceAssembly<DungeonEditorMapSnapshot.Boundary> boundaryDiff =
                DungeonEditorPreviewBoundaryDiffProjectionServiceAssembly.diff(committedMap, previewMap);
        DungeonEditorPreviewFactDiffProjectionServiceAssembly<DungeonEditorHandleSnapshot> handleDiff =
                DungeonEditorPreviewHandleDiffProjectionServiceAssembly.diff(committedMap, previewMap);
        DungeonEditorPreviewFactDiffProjectionServiceAssembly<DungeonEditorMapSnapshot.Feature> featureDiff =
                DungeonEditorPreviewFeatureDiffProjectionServiceAssembly.diff(committedMap, previewMap);
        DungeonEditorPreviewDiff diff = new DungeonEditorPreviewDiff(
                areaDiff.changed(),
                areaDiff.removed(),
                boundaryDiff.changed(),
                boundaryDiff.removed(),
                handleDiff.changed(),
                handleDiff.removed(),
                featureDiff.changed(),
                featureDiff.removed());
        return diff.isEmpty() ? DungeonEditorPreviewDiff.empty() : diff;
    }
}
