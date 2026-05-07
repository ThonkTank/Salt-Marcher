package src.domain.dungeoneditor.interaction.value;

import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;

public record DungeonEditorMainViewEffect(
        DungeonEditorSessionValues.@Nullable Selection selection,
        boolean clearSelection,
        DungeonEditorSessionValues.@Nullable Preview preview,
        boolean clearPreview,
        DungeonEditorSessionValues.@Nullable Preview applyPreview,
        int projectionLevelDelta,
        @Nullable String statusText
) {
    public static DungeonEditorMainViewEffect none() {
        return new DungeonEditorMainViewEffect(null, false, null, false, null, 0, null);
    }

    public static DungeonEditorMainViewEffect preview(DungeonEditorSessionValues.Preview preview) {
        return new DungeonEditorMainViewEffect(null, false, preview, false, null, 0, null);
    }

    public static DungeonEditorMainViewEffect apply(DungeonEditorSessionValues.Preview applyPreview) {
        return new DungeonEditorMainViewEffect(null, false, null, true, applyPreview, 0, null);
    }

    public static DungeonEditorMainViewEffect applyWithStatus(
            DungeonEditorSessionValues.Preview applyPreview,
            String statusText
    ) {
        return new DungeonEditorMainViewEffect(null, false, null, true, applyPreview, 0, statusText);
    }

    public static DungeonEditorMainViewEffect select(DungeonEditorSessionValues.Selection selection) {
        return new DungeonEditorMainViewEffect(selection, false, null, true, null, 0, null);
    }

    public static DungeonEditorMainViewEffect select(DungeonEditorSessionValues.Selection selection, String statusText) {
        return new DungeonEditorMainViewEffect(selection, false, null, true, null, 0, statusText);
    }

    public static DungeonEditorMainViewEffect clearedSelection() {
        return new DungeonEditorMainViewEffect(null, true, null, true, null, 0, null);
    }

    public static DungeonEditorMainViewEffect projectionLevel(int delta) {
        return new DungeonEditorMainViewEffect(null, false, null, false, null, delta, null);
    }

    public static DungeonEditorMainViewEffect clearPreviewIfNeeded(boolean clearPreview) {
        return new DungeonEditorMainViewEffect(null, false, null, clearPreview, null, 0, null);
    }

    public boolean isNoop() {
        return !clearSelection && selection == null && preview == null && !clearPreview
                && applyPreview == null && projectionLevelDelta == 0 && statusText == null;
    }
}
