package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;

final class DungeonEditorIntentHandler {

    private static final String NAME_MISSING_ERROR = "Name fehlt.";

    private final DungeonEditorContributionModel presentationModel;
    private Consumer<DungeonEditorPublishedEvent> publishedEventListener = ignored -> {};

    DungeonEditorIntentHandler(DungeonEditorContributionModel presentationModel) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
    }

    void onPublishedEventRequested(Consumer<DungeonEditorPublishedEvent> listener) {
        publishedEventListener = listener == null ? ignored -> {} : listener;
    }

    void consume(DungeonEditorMainViewInputEvent event) {
        if (event == null) {
            return;
        }
        publish(DungeonEditorPublishedEvent.interpretMainView(new DungeonEditorPublishedEvent.MainViewInput(
                toMainViewSource(event.pointerPhaseKey(), event.levelDelta()),
                event.canvasX(),
                event.canvasY(),
                event.primaryButtonDown(),
                event.secondaryButtonDown(),
                event.hitRef(),
                event.levelDelta())));
    }

    void consume(DungeonEditorControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.mapSelection() != null) {
            handleMapSelection(event.mapSelection());
            return;
        }
        if (event.mapEditor() != null) {
            handleMapEditor(event.mapEditor());
            return;
        }
        if (event.viewModeKey() != null) {
            handleViewMode(event.viewModeKey());
            return;
        }
        if (event.toolInput() != null) {
            handleToolInput(event.toolInput());
            return;
        }
        if (event.projectionLevelShift() != 0) {
            publish(DungeonEditorPublishedEvent.shiftProjectionLevel(event.projectionLevelShift()));
            return;
        }
        if (event.overlay() != null) {
            handleOverlayInput(event.overlay());
        }
    }

    void consume(DungeonEditorStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        publish(DungeonEditorPublishedEvent.saveRoomNarration(new DungeonEditorPublishedEvent.RoomNarrationInput(
                event.roomId(),
                event.visualDescription(),
                event.exits().stream().map(DungeonEditorIntentHandler::toPublishedExit).toList())));
    }

    private void handleMapSelection(DungeonEditorControlsViewInputEvent.MapSelectionInput mapSelection) {
        if (mapSelection == null) {
            return;
        }
        long selectedMapIdValue = mapSelection.selectedMapIdValue();
        DungeonEditorInteractionState interactionState = presentationModel.currentInteractionState();
        if (selectedMapIdValue > DungeonEditorInteractionState.NO_MAP_ID
                && selectedMapIdValue != interactionState.currentSelectedMapIdValue()) {
            publish(DungeonEditorPublishedEvent.selectMap(selectedMapIdValue));
        }
    }

    private void handleMapEditor(DungeonEditorControlsViewInputEvent.MapEditorInput mapEditor) {
        if (mapEditor == null) {
            return;
        }
        presentationModel.applyLocalMutation(new UpdateMapEditorDraftMutation(mapEditor.draftName()));
        DungeonEditorInteractionState interactionState = presentationModel.currentInteractionState();
        if (mapEditor.dismissRequested()) {
            presentationModel.applyLocalMutation(new CloseMapEditorMutation());
            return;
        }
        if (mapEditor.openCreateRequested()) {
            presentationModel.applyLocalMutation(new OpenCreateMapEditorMutation());
            return;
        }
        if (mapEditor.openRenameRequested()) {
            presentationModel.applyLocalMutation(new OpenSelectedMapEditorMutation(
                    DungeonEditorMapEditorMode.RENAME,
                    interactionState.currentSelectedMapIdValue()));
            return;
        }
        if (mapEditor.openDeleteRequested()) {
            presentationModel.applyLocalMutation(new OpenSelectedMapEditorMutation(
                    DungeonEditorMapEditorMode.DELETE,
                    interactionState.currentSelectedMapIdValue()));
            return;
        }
        if (mapEditor.confirmDeleteRequested()) {
            handleMapDelete();
            return;
        }
        if (mapEditor.submitRequested()) {
            handleMapEditorSubmit();
        }
    }

    private void handleMapEditorSubmit() {
        DungeonEditorMapEditorUiState mapEditorUiState = presentationModel.currentInteractionState().currentMapEditorUiState();
        String draftName = mapEditorUiState.draftName();
        if (draftName.isBlank()) {
            presentationModel.applyLocalMutation(new ShowMapEditorValidationErrorMutation(NAME_MISSING_ERROR));
            return;
        }
        if (mapEditorUiState.isCreateMode()) {
            presentationModel.applyLocalMutation(new CloseMapEditorMutation());
            publish(DungeonEditorPublishedEvent.createMap(draftName));
            return;
        }
        if (mapEditorUiState.isRenameMode()) {
            long mapIdValue = mapEditorUiState.mapIdValue();
            if (mapIdValue > DungeonEditorInteractionState.NO_MAP_ID) {
                presentationModel.applyLocalMutation(new CloseMapEditorMutation());
                publish(DungeonEditorPublishedEvent.renameMap(mapIdValue, draftName));
            }
        }
    }

    private void handleMapDelete() {
        DungeonEditorMapEditorUiState mapEditorUiState = presentationModel.currentInteractionState().currentMapEditorUiState();
        if (!mapEditorUiState.isDeleteMode()) {
            return;
        }
        long mapIdValue = mapEditorUiState.mapIdValue();
        if (mapIdValue > DungeonEditorInteractionState.NO_MAP_ID) {
            presentationModel.applyLocalMutation(new CloseMapEditorMutation());
            publish(DungeonEditorPublishedEvent.deleteMap(mapIdValue));
        }
    }

    private void handleViewMode(@Nullable String viewModeKey) {
        if (viewModeKey == null || viewModeKey.isBlank()) {
            return;
        }
        String normalizedViewModeKey = DungeonEditorToolCatalog.normalizeViewModeKey(viewModeKey);
        String selectedViewMode = presentationModel.currentInteractionState().currentViewModeKey();
        if (DungeonEditorToolCatalog.GRAPH_VIEW_LABEL.equals(normalizedViewModeKey)) {
            if (!DungeonEditorToolCatalog.GRAPH_VIEW_LABEL.equals(selectedViewMode)) {
                publish(DungeonEditorPublishedEvent.setViewMode(DungeonEditorToolCatalog.toPublishedViewMode(normalizedViewModeKey)));
            }
            return;
        }
        if (!DungeonEditorToolCatalog.GRID_VIEW_LABEL.equals(selectedViewMode)) {
            publish(DungeonEditorPublishedEvent.setViewMode(DungeonEditorPublishedEvent.ViewMode.GRID));
        }
    }

    private void handleToolInput(DungeonEditorControlsViewInputEvent.ToolInput toolInput) {
        if (toolInput == null) {
            return;
        }
        if (toolInput.dismissRequested()) {
            presentationModel.applyLocalMutation(new SetToolPaletteMutation(null));
            return;
        }
        if (toolInput.requestedFamily() != null) {
            presentationModel.applyLocalMutation(new SetToolPaletteMutation(DungeonEditorToolFamily.valueOf(toolInput.requestedFamily().name())));
        } else {
            presentationModel.applyLocalMutation(new SetToolPaletteMutation(null));
        }
        DungeonEditorInteractionState interactionState = presentationModel.currentInteractionState();
        if (toolInput.selectedToolLabel() != null
                && !toolInput.selectedToolLabel().isBlank()
                && !interactionState.currentSelectedToolLabel().equals(toolInput.selectedToolLabel())) {
            publish(DungeonEditorPublishedEvent.setTool(DungeonEditorToolCatalog.toPublishedTool(toolInput.selectedToolLabel())));
        }
    }

    private void handleOverlayInput(DungeonEditorControlsViewInputEvent.OverlayInput overlayInput) {
        if (overlayInput == null) {
            return;
        }
        DungeonEditorOverlayProjection currentOverlay = presentationModel.currentInteractionState().currentOverlayProjection();
        List<Integer> selectedLevels = parseLevels(overlayInput.selectedLevelsText());
        if (currentOverlay.modeKey().equals(overlayInput.modeKey())
                && currentOverlay.levelRange() == overlayInput.levelRange()
                && Double.compare(currentOverlay.opacity(), overlayInput.opacity()) == 0
                && parseLevels(currentOverlay.selectedLevelsText()).equals(selectedLevels)) {
            return;
        }
        publish(new DungeonEditorPublishedEvent(
                DungeonEditorPublishedEvent.Kind.SET_OVERLAY,
                0L,
                "",
                DungeonEditorPublishedEvent.ViewMode.GRID,
                DungeonEditorPublishedEvent.Tool.SELECT,
                0,
                new DungeonEditorPublishedEvent.OverlaySettings(
                        overlayInput.modeKey(),
                        overlayInput.levelRange(),
                        overlayInput.opacity(),
                        selectedLevels),
                DungeonEditorPublishedEvent.MainViewInput.empty(),
                DungeonEditorPublishedEvent.RoomNarrationInput.empty()));
    }

    private void publish(DungeonEditorPublishedEvent event) {
        if (event == null) {
            return;
        }
        publishedEventListener.accept(event);
    }

    private static DungeonEditorPublishedEvent.RoomExitNarration toPublishedExit(
            DungeonEditorStateViewInputEvent.RoomExitNarrationSnapshot exit
    ) {
        DungeonEditorStateViewInputEvent.RoomExitNarrationSnapshot safeExit = exit == null
                ? new DungeonEditorStateViewInputEvent.RoomExitNarrationSnapshot("", 0, 0, 0, "", "")
                : exit;
        return new DungeonEditorPublishedEvent.RoomExitNarration(
                safeExit.label(),
                new DungeonEditorPublishedEvent.CellRef(safeExit.q(), safeExit.r(), safeExit.level()),
                safeExit.direction(),
                safeExit.description());
    }

    private static DungeonEditorPublishedEvent.MainViewInput.Source toMainViewSource(
            String pointerPhaseKey,
            int levelDelta
    ) {
        if (levelDelta != 0) {
            return DungeonEditorPublishedEvent.MainViewInput.Source.LEVEL_SCROLLED;
        }
        return switch (pointerPhaseKey == null ? "MOVE" : pointerPhaseKey) {
            case "PRESS" -> DungeonEditorPublishedEvent.MainViewInput.Source.POINTER_PRESSED;
            case "DRAG" -> DungeonEditorPublishedEvent.MainViewInput.Source.POINTER_DRAGGED;
            case "RELEASE" -> DungeonEditorPublishedEvent.MainViewInput.Source.POINTER_RELEASED;
            default -> DungeonEditorPublishedEvent.MainViewInput.Source.POINTER_MOVED;
        };
    }

    private static List<Integer> parseLevels(@Nullable String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        try {
            return java.util.Arrays.stream(raw.split(","))
                    .map(String::trim)
                    .filter(part -> !part.isBlank())
                    .map(Integer::parseInt)
                    .sorted()
                    .distinct()
                    .toList();
        } catch (NumberFormatException exception) {
            return List.of();
        }
    }
}
