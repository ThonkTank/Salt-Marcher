package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;

final class DungeonEditorIntentHandler {

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
        if (event.viewMode() != null) {
            handleViewMode(event.viewMode());
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

    private void publishIfMapSelected(long mapId, java.util.function.LongFunction<DungeonEditorPublishedEvent> factory) {
        if (mapId > 0L) {
            publish(factory.apply(mapId));
        }
    }

    private void handleMapSelection(DungeonEditorControlsViewInputEvent.MapSelectionInput mapSelection) {
        if (mapSelection == null) {
            return;
        }
        long selectedMapIdValue = mapSelection.selectedMapIdValue();
        if (selectedMapIdValue > 0L && selectedMapIdValue != presentationModel.currentSelectedMapIdValue()) {
            publish(DungeonEditorPublishedEvent.selectMap(selectedMapIdValue));
        }
    }

    private void handleMapEditor(DungeonEditorControlsViewInputEvent.MapEditorInput mapEditor) {
        if (mapEditor == null) {
            return;
        }
        presentationModel.updateMapEditorDraft(mapEditor.draftName());
        if (mapEditor.dismissRequested()) {
            presentationModel.closeMapEditor();
            return;
        }
        if (mapEditor.openCreateRequested()) {
            presentationModel.openCreateMapEditor();
            return;
        }
        if (mapEditor.openRenameRequested()) {
            presentationModel.openRenameMapEditor(mapEditor.selectedMapIdValue());
            return;
        }
        if (mapEditor.openDeleteRequested()) {
            presentationModel.openDeleteMapEditor(mapEditor.selectedMapIdValue());
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
        DungeonEditorContributionModel.MapEditorUiState mapEditorUiState = presentationModel.currentMapEditorUiState();
        String draftName = mapEditorUiState.draftName();
        if (draftName.isBlank()) {
            presentationModel.showMapEditorValidationError("Name fehlt.");
            return;
        }
        if (mapEditorUiState.mode() == DungeonEditorContributionModel.MapEditorMode.CREATE) {
            presentationModel.closeMapEditor();
            publish(DungeonEditorPublishedEvent.createMap(draftName));
            return;
        }
        if (mapEditorUiState.mode() == DungeonEditorContributionModel.MapEditorMode.RENAME) {
            long mapIdValue = mapEditorUiState.mapIdValue();
            if (mapIdValue > 0L) {
                presentationModel.closeMapEditor();
                publish(DungeonEditorPublishedEvent.renameMap(mapIdValue, draftName));
            }
        }
    }

    private void handleMapDelete() {
        DungeonEditorContributionModel.MapEditorUiState mapEditorUiState = presentationModel.currentMapEditorUiState();
        if (mapEditorUiState.mode() != DungeonEditorContributionModel.MapEditorMode.DELETE) {
            return;
        }
        long mapIdValue = mapEditorUiState.mapIdValue();
        if (mapIdValue > 0L) {
            presentationModel.closeMapEditor();
            publish(DungeonEditorPublishedEvent.deleteMap(mapIdValue));
        }
    }

    private void handleViewMode(DungeonEditorControlsViewInputEvent.ViewMode viewMode) {
        if (viewMode == null) {
            return;
        }
        String selectedViewMode = presentationModel.currentViewModeKey();
        if (viewMode == DungeonEditorControlsViewInputEvent.ViewMode.GRAPH) {
            if (!"Graph".equals(selectedViewMode)) {
                publish(DungeonEditorPublishedEvent.setViewMode(DungeonEditorPublishedEvent.ViewMode.GRAPH));
            }
            return;
        }
        if (!"Grid".equals(selectedViewMode)) {
            publish(DungeonEditorPublishedEvent.setViewMode(DungeonEditorPublishedEvent.ViewMode.GRID));
        }
    }

    private void handleToolInput(DungeonEditorControlsViewInputEvent.ToolInput toolInput) {
        if (toolInput == null) {
            return;
        }
        if (toolInput.dismissRequested()) {
            presentationModel.closeToolPalette();
            return;
        }
        if (toolInput.requestedFamily() != null) {
            presentationModel.openToolPalette(toolInput.requestedFamily());
        } else {
            presentationModel.closeToolPalette();
        }
        if (toolInput.selectedTool() != null
                && !presentationModel.currentSelectedToolLabel().equals(toolLabel(toolInput.selectedTool()))) {
            publish(DungeonEditorPublishedEvent.setTool(toPublishedTool(toolInput.selectedTool())));
        }
    }

    private void handleOverlayInput(DungeonEditorControlsViewInputEvent.OverlayInput overlayInput) {
        if (overlayInput == null) {
            return;
        }
        DungeonEditorContributionModel.OverlayProjection currentOverlay = presentationModel.currentOverlayProjection();
        List<Integer> selectedLevels = parseLevels(overlayInput.selectedLevelsText());
        if (currentOverlay.modeKey().equals(overlayInput.modeKey())
                && currentOverlay.levelRange() == overlayInput.levelRange()
                && Double.compare(currentOverlay.opacity(), overlayInput.opacity()) == 0
                && currentOverlay.selectedLevels().equals(selectedLevels)) {
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

    private static DungeonEditorPublishedEvent.OverlaySettings toOverlaySettings(
            DungeonEditorControlsViewInputEvent.OverlayInput overlayInput
    ) {
        return new DungeonEditorPublishedEvent.OverlaySettings(
                overlayInput == null ? "OFF" : overlayInput.modeKey(),
                overlayInput == null ? 0 : overlayInput.levelRange(),
                overlayInput == null ? 0.0 : overlayInput.opacity(),
                parseLevels(overlayInput == null ? "" : overlayInput.selectedLevelsText()));
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

    private static DungeonEditorPublishedEvent.ViewMode toPublishedViewMode(
            DungeonEditorControlsViewInputEvent.ViewMode viewMode
    ) {
        return viewMode == DungeonEditorControlsViewInputEvent.ViewMode.GRAPH
                ? DungeonEditorPublishedEvent.ViewMode.GRAPH
                : DungeonEditorPublishedEvent.ViewMode.GRID;
    }

    private static DungeonEditorPublishedEvent.Tool toPublishedTool(
            DungeonEditorControlsViewInputEvent.Tool tool
    ) {
        return tool == null ? DungeonEditorPublishedEvent.Tool.SELECT : DungeonEditorPublishedEvent.Tool.valueOf(tool.name());
    }

    private static String toolLabel(DungeonEditorControlsViewInputEvent.Tool tool) {
        return switch (tool == null ? DungeonEditorControlsViewInputEvent.Tool.SELECT : tool) {
            case ROOM_PAINT -> "Raum malen";
            case ROOM_DELETE -> "Raum löschen";
            case WALL_CREATE -> "Wand setzen";
            case WALL_DELETE -> "Wand löschen";
            case DOOR_CREATE -> "Tür setzen";
            case DOOR_DELETE -> "Tür löschen";
            case CORRIDOR_CREATE -> "Korridor erstellen";
            case CORRIDOR_DELETE -> "Korridor löschen";
            case STAIR_CREATE -> "Treppe erstellen";
            case STAIR_DELETE -> "Treppe löschen";
            case TRANSITION_CREATE -> "Übergang erstellen";
            case TRANSITION_DELETE -> "Übergang löschen";
            case SELECT -> "Auswahl";
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
