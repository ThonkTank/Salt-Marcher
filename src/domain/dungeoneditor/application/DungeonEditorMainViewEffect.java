package src.domain.dungeoneditor.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;

record DungeonEditorMainViewEffect(
        DungeonEditorSessionValues.@Nullable Selection selection,
        boolean clearSelection,
        DungeonEditorSessionValues.@Nullable Preview preview,
        boolean clearPreview,
        @Nullable DungeonEditorOperation applyOperation,
        int projectionLevelDelta,
        @Nullable String statusText
) {
    static DungeonEditorMainViewEffect none() {
        return new DungeonEditorMainViewEffect(null, false, null, false, null, 0, null);
    }

    static DungeonEditorMainViewEffect preview(DungeonEditorSessionValues.Preview preview) {
        return new DungeonEditorMainViewEffect(null, false, preview, false, null, 0, null);
    }

    static DungeonEditorMainViewEffect apply(DungeonEditorOperation operation) {
        return new DungeonEditorMainViewEffect(null, false, null, true, operation, 0, null);
    }

    static DungeonEditorMainViewEffect applyWithStatus(DungeonEditorOperation operation, String statusText) {
        return new DungeonEditorMainViewEffect(null, false, null, true, operation, 0, statusText);
    }

    static DungeonEditorMainViewEffect select(DungeonEditorSessionValues.Selection selection) {
        return new DungeonEditorMainViewEffect(selection, false, null, true, null, 0, null);
    }

    static DungeonEditorMainViewEffect select(DungeonEditorSessionValues.Selection selection, String statusText) {
        return new DungeonEditorMainViewEffect(selection, false, null, true, null, 0, statusText);
    }

    static DungeonEditorMainViewEffect clearedSelection() {
        return new DungeonEditorMainViewEffect(null, true, null, true, null, 0, null);
    }

    static DungeonEditorMainViewEffect projectionLevel(int delta) {
        return new DungeonEditorMainViewEffect(null, false, null, false, null, delta, null);
    }

    static DungeonEditorMainViewEffect clearPreviewIfNeeded(boolean clearPreview) {
        return new DungeonEditorMainViewEffect(null, false, null, clearPreview, null, 0, null);
    }

    boolean isNoop() {
        return !clearSelection && selection == null && preview == null && !clearPreview
                && applyOperation == null && projectionLevelDelta == 0 && statusText == null;
    }
}
