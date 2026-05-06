package src.view.leftbartabs.dungeoneditor;

import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelView.OverlayControlsPanel;

final class DungeonEditorControlsEvents {

    private final Consumer<DungeonEditorControlsViewInputEvent> sink;

    DungeonEditorControlsEvents(Consumer<DungeonEditorControlsViewInputEvent> sink) {
        this.sink = sink;
    }

    void mapSelection(long selectedMapIdValue) {
        sink.accept(new DungeonEditorControlsViewInputEvent(
                new DungeonEditorControlsViewInputEvent.MapSelectionInput(selectedMapIdValue),
                null,
                null,
                null,
                0,
                null));
    }

    void mapEditorInput(
            boolean openCreateRequested,
            boolean openRenameRequested,
            boolean openDeleteRequested,
            boolean dismissRequested,
            boolean submitRequested,
            boolean confirmDeleteRequested,
            String draftText
    ) {
        sink.accept(new DungeonEditorControlsViewInputEvent(
                null,
                new DungeonEditorControlsViewInputEvent.MapEditorInput(
                        openCreateRequested,
                        openRenameRequested,
                        openDeleteRequested,
                        dismissRequested,
                        submitRequested,
                        confirmDeleteRequested,
                        draftText),
                null,
                null,
                0,
                null));
    }

    void viewModeSelected(String viewModeKey) {
        sink.accept(new DungeonEditorControlsViewInputEvent(
                null,
                null,
                viewModeKey,
                null,
                0,
                null));
    }

    void toolFamilySelected(DungeonEditorControlsViewInputEvent.ToolFamily family, String primaryToolLabel) {
        sink.accept(new DungeonEditorControlsViewInputEvent(
                null,
                null,
                null,
                new DungeonEditorControlsViewInputEvent.ToolInput(family, primaryToolLabel, false),
                0,
                null));
    }

    void toolSelected(@Nullable String selectedToolLabel) {
        sink.accept(new DungeonEditorControlsViewInputEvent(
                null,
                null,
                null,
                new DungeonEditorControlsViewInputEvent.ToolInput(null, selectedToolLabel, false),
                0,
                null));
    }

    void toolDismissed() {
        sink.accept(new DungeonEditorControlsViewInputEvent(
                null,
                null,
                null,
                new DungeonEditorControlsViewInputEvent.ToolInput(null, null, true),
                0,
                null));
    }

    void projectionShift(int projectionLevelShift) {
        sink.accept(new DungeonEditorControlsViewInputEvent(
                null,
                null,
                null,
                null,
                projectionLevelShift,
                null));
    }

    void overlayInput(OverlayControlsPanel overlayControls) {
        sink.accept(new DungeonEditorControlsViewInputEvent(
                null,
                null,
                null,
                null,
                0,
                new DungeonEditorControlsViewInputEvent.OverlayInput(
                        overlayControls.overlayModeKey(),
                        overlayControls.overlayRange(),
                        overlayControls.overlayOpacity(),
                        overlayControls.overlayLevelsText())));
    }
}
