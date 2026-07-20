package features.dungeon.application.editor.session;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import org.jspecify.annotations.Nullable;

public final class DungeonEditorSessionEffect {
    private final DungeonEditorSessionValues.@Nullable Selection selection;
    private final boolean clearSelection;
    private final DungeonEditorSessionValues.@Nullable Preview preview;
    private final boolean clearPreview;
    private final DungeonEditorSessionValues.@Nullable Preview applyPreview;
    private final int projectionLevelDelta;
    private final @Nullable String statusText;
    private final DungeonEditorCommandOutcome.@Nullable Rejected rejection;

    private DungeonEditorSessionEffect(
            DungeonEditorSessionValues.@Nullable Selection selection,
            boolean clearSelection,
            DungeonEditorSessionValues.@Nullable Preview preview,
            boolean clearPreview,
            DungeonEditorSessionValues.@Nullable Preview applyPreview,
            int projectionLevelDelta,
            @Nullable String statusText,
            DungeonEditorCommandOutcome.@Nullable Rejected rejection
    ) {
        this.selection = selection;
        this.clearSelection = clearSelection;
        this.preview = preview;
        this.clearPreview = clearPreview;
        this.applyPreview = applyPreview;
        this.projectionLevelDelta = projectionLevelDelta;
        this.statusText = statusText;
        this.rejection = rejection;
    }

    public static DungeonEditorSessionEffect none() {
        return new DungeonEditorSessionEffect(null, false, null, false, null, 0, null, null);
    }

    public static DungeonEditorSessionEffect preview(DungeonEditorSessionValues.Preview preview) {
        return new DungeonEditorSessionEffect(null, false, preview, false, null, 0, null, null);
    }

    public static DungeonEditorSessionEffect apply(DungeonEditorSessionValues.Preview applyPreview) {
        return new DungeonEditorSessionEffect(null, false, null, true, applyPreview, 0, null, null);
    }

    public static DungeonEditorSessionEffect applyWithStatus(
            DungeonEditorSessionValues.Preview applyPreview,
            String statusText
    ) {
        return new DungeonEditorSessionEffect(null, false, null, true, applyPreview, 0, statusText, null);
    }

    public static DungeonEditorSessionEffect select(DungeonEditorSessionValues.Selection selection) {
        return new DungeonEditorSessionEffect(selection, false, null, true, null, 0, null, null);
    }

    public static DungeonEditorSessionEffect select(DungeonEditorSessionValues.Selection selection, String statusText) {
        return new DungeonEditorSessionEffect(selection, false, null, true, null, 0, statusText, null);
    }

    public static DungeonEditorSessionEffect selectRejected(
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorCommandOutcome.RejectionReason reason
    ) {
        return new DungeonEditorSessionEffect(
                selection, false, null, true, null, 0, null,
                new DungeonEditorCommandOutcome.Rejected(reason));
    }

    public static DungeonEditorSessionEffect clearedSelection() {
        return new DungeonEditorSessionEffect(null, true, null, true, null, 0, null, null);
    }

    public static DungeonEditorSessionEffect projectionLevel(int delta) {
        return new DungeonEditorSessionEffect(null, false, null, false, null, delta, null, null);
    }

    public static DungeonEditorSessionEffect clearPreviewIfNeeded(boolean clearPreview) {
        return new DungeonEditorSessionEffect(null, false, null, clearPreview, null, 0, null, null);
    }

    public static DungeonEditorSessionEffect clearPreviewWithStatus(String statusText) {
        return new DungeonEditorSessionEffect(null, false, null, true, null, 0, statusText, null);
    }

    public static DungeonEditorSessionEffect rejected(DungeonEditorCommandOutcome.RejectionReason reason) {
        return new DungeonEditorSessionEffect(
                null, false, null, true, null, 0, null,
                new DungeonEditorCommandOutcome.Rejected(reason));
    }

    public DungeonEditorSessionValues.@Nullable Selection getSelection() {
        return selection;
    }

    public boolean isClearSelection() {
        return clearSelection;
    }

    public DungeonEditorSessionValues.@Nullable Preview getPreview() {
        return preview;
    }

    public boolean isClearPreview() {
        return clearPreview;
    }

    public DungeonEditorSessionValues.@Nullable Preview getApplyPreview() {
        return applyPreview;
    }

    public int getProjectionLevelDelta() {
        return projectionLevelDelta;
    }

    public @Nullable String getStatusText() {
        return statusText;
    }

    public DungeonEditorCommandOutcome.@Nullable Rejected getRejection() {
        return rejection;
    }

    public boolean isNoop() {
        return !clearSelection && selection == null && preview == null && !clearPreview
                && applyPreview == null && projectionLevelDelta == 0 && statusText == null && rejection == null;
    }
}
