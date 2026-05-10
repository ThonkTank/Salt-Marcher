package src.view.leftbartabs.dungeoneditor;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.DungeonEditorApplicationService;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionCommand;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;
import src.view.slotcontent.main.dungeonmap.DungeonMapViewInputEvent;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasViewInputEvent;

final class DungeonEditorIntentHandler {

    private static final String NAME_MISSING_ERROR = "Name fehlt.";
    private static final long NO_MAP_ID = 0L;
    private static final double ZOOM_IN_FACTOR = 1.1;
    private static final double ZOOM_OUT_FACTOR = 1.0 / ZOOM_IN_FACTOR;

    private final DungeonEditorContributionModel presentationModel;
    private final MapCanvasContentModel mapCanvasContentModel;
    private final DungeonEditorApplicationService editor;

    DungeonEditorIntentHandler(
            DungeonEditorContributionModel presentationModel,
            MapCanvasContentModel mapCanvasContentModel,
            DungeonEditorApplicationService editor
    ) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
        this.mapCanvasContentModel = Objects.requireNonNull(mapCanvasContentModel, "mapCanvasContentModel");
        this.editor = Objects.requireNonNull(editor, "editor");
    }

    void consume(DungeonMapViewInputEvent event) {
        if (event == null) {
            return;
        }
        apply(MainViewSupport.toCommand(mapCanvasContentModel, event.canvasEvent()));
    }

    void consume(DungeonEditorControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        ControlsSupport.consume(presentationModel, this::apply, event);
    }

    void consume(DungeonEditorStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        apply(StateSaveSupport.toSaveCommand(presentationModel, event));
    }

    private void apply(@Nullable DungeonEditorSessionCommand command) {
        if (command != null) {
            editor.applyEditorSession(command);
        }
    }

    private static final class MainViewSupport {

        private static @Nullable DungeonEditorSessionCommand toCommand(
                MapCanvasContentModel mapCanvasContentModel,
                MapCanvasViewInputEvent event
        ) {
            if (event == null) {
                return null;
            }
            if (event.interaction().isDrag()
                    && event.buttons().middleButtonDown()) {
                mapCanvasContentModel.panByPixels(event.dragDeltaX(), event.dragDeltaY());
                return null;
            }
            if (event.interaction().isScroll()) {
                return handleScroll(mapCanvasContentModel, event);
            }
            if (event.buttons().middleButtonDown()) {
                return null;
            }
            return mainViewCommand(new DungeonEditorSessionCommand.MainViewInput(
                    toMainViewSource(event.interaction()),
                    event.position().canvasX(),
                    event.position().canvasY(),
                    event.buttons().primaryButtonDown(),
                    event.buttons().secondaryButtonDown(),
                    hitRef(event),
                    0));
        }

        private static @Nullable DungeonEditorSessionCommand handleScroll(
                MapCanvasContentModel mapCanvasContentModel,
                MapCanvasViewInputEvent event
        ) {
            if (!event.modifiers().controlDown()) {
                if (event.scrollDeltaY() > 0.0) {
                    mapCanvasContentModel.zoomAround(
                            event.position().canvasX(),
                            event.position().canvasY(),
                            ZOOM_IN_FACTOR);
                } else if (event.scrollDeltaY() < 0.0) {
                    mapCanvasContentModel.zoomAround(
                            event.position().canvasX(),
                            event.position().canvasY(),
                            ZOOM_OUT_FACTOR);
                }
                return null;
            }
            int levelDelta = normalizeLevelDelta(event.scrollDeltaY());
            if (levelDelta == 0) {
                return null;
            }
            return mainViewCommand(new DungeonEditorSessionCommand.MainViewInput(
                    DungeonEditorSessionCommand.MainViewInputSource.LEVEL_SCROLLED,
                    event.position().canvasX(),
                    event.position().canvasY(),
                    event.buttons().primaryButtonDown(),
                    event.buttons().secondaryButtonDown(),
                    hitRef(event),
                    levelDelta));
        }

        private static String hitRef(MapCanvasViewInputEvent event) {
            return event.hit() == null ? "" : event.hit().hitRef();
        }

        private static int normalizeLevelDelta(double scrollDeltaY) {
            if (scrollDeltaY > 0.0) {
                return 1;
            }
            if (scrollDeltaY < 0.0) {
                return -1;
            }
            return 0;
        }

        private static DungeonEditorSessionCommand.MainViewInputSource toMainViewSource(
                MapCanvasViewInputEvent.Interaction interaction
        ) {
            MapCanvasViewInputEvent.Interaction safeInteraction = interaction == null
                    ? MapCanvasViewInputEvent.Interaction.MOVE
                    : interaction;
            return switch (safeInteraction) {
                case PRESS -> DungeonEditorSessionCommand.MainViewInputSource.POINTER_PRESSED;
                case DRAG -> DungeonEditorSessionCommand.MainViewInputSource.POINTER_DRAGGED;
                case RELEASE -> DungeonEditorSessionCommand.MainViewInputSource.POINTER_RELEASED;
                case MOVE -> DungeonEditorSessionCommand.MainViewInputSource.POINTER_MOVED;
                case SCROLL -> DungeonEditorSessionCommand.MainViewInputSource.LEVEL_SCROLLED;
            };
        }
    }

    private static final class ControlsSupport {

        private static void consume(
                DungeonEditorContributionModel presentationModel,
                Consumer<DungeonEditorSessionCommand> publisher,
                DungeonEditorControlsViewInputEvent event
        ) {
            if (event.mapSelection() != null) {
                handleMapSelection(presentationModel, publisher, event.mapSelection());
                return;
            }
            if (event.mapEditor() != null) {
                handleMapEditor(presentationModel, publisher, event.mapEditor());
                return;
            }
            if (event.viewModeKey() != null) {
                handleViewMode(presentationModel, publisher, event.viewModeKey());
                return;
            }
            if (event.toolInput() != null) {
                handleToolInput(presentationModel, publisher, event.toolInput());
                return;
            }
            if (event.projectionLevelShift() != 0) {
                publisher.accept(shiftProjectionLevelCommand(event.projectionLevelShift()));
                return;
            }
            if (event.overlay() != null) {
                handleOverlayInput(presentationModel, publisher, event.overlay());
            }
        }

        private static void handleMapSelection(
                DungeonEditorContributionModel presentationModel,
                Consumer<DungeonEditorSessionCommand> publisher,
                DungeonEditorControlsViewInputEvent.MapSelectionInput mapSelection
        ) {
            long selectedMapIdValue = mapSelection.selectedMapIdValue();
            DungeonEditorContributionModel.InteractionState interactionState = presentationModel.currentInteractionState();
            if (selectedMapIdValue > NO_MAP_ID
                    && selectedMapIdValue != interactionState.currentSelectedMapIdValue()) {
                publisher.accept(mapCommand(
                        DungeonEditorSessionCommand.Action.SELECT_MAP,
                        new DungeonEditorWorkspaceValues.MapId(selectedMapIdValue),
                        ""));
            }
        }

        private static void handleMapEditor(
                DungeonEditorContributionModel presentationModel,
                Consumer<DungeonEditorSessionCommand> publisher,
                DungeonEditorControlsViewInputEvent.MapEditorInput mapEditor
        ) {
            presentationModel.applyLocalMutation(new DungeonEditorContributionModel.UpdateMapEditorDraftMutation(mapEditor.draftName()));
            DungeonEditorContributionModel.InteractionState interactionState = presentationModel.currentInteractionState();
            if (mapEditor.dismissRequested()) {
                presentationModel.applyLocalMutation(new DungeonEditorContributionModel.CloseMapEditorMutation());
                return;
            }
            if (mapEditor.openCreateRequested()) {
                presentationModel.applyLocalMutation(new DungeonEditorContributionModel.OpenCreateMapEditorMutation());
                return;
            }
            if (mapEditor.openRenameRequested()) {
                presentationModel.applyLocalMutation(new DungeonEditorContributionModel.OpenSelectedMapEditorMutation(
                        DungeonEditorContributionModel.MapEditorMode.RENAME,
                        interactionState.currentSelectedMapIdValue()));
                return;
            }
            if (mapEditor.openDeleteRequested()) {
                presentationModel.applyLocalMutation(new DungeonEditorContributionModel.OpenSelectedMapEditorMutation(
                        DungeonEditorContributionModel.MapEditorMode.DELETE,
                        interactionState.currentSelectedMapIdValue()));
                return;
            }
            if (mapEditor.confirmDeleteRequested()) {
                handleMapDelete(presentationModel, publisher);
                return;
            }
            if (mapEditor.submitRequested()) {
                handleMapEditorSubmit(presentationModel, publisher);
            }
        }

        private static void handleMapEditorSubmit(
                DungeonEditorContributionModel presentationModel,
                Consumer<DungeonEditorSessionCommand> publisher
        ) {
            DungeonEditorContributionModel.MapEditorUiState mapEditorUiState =
                    presentationModel.currentInteractionState().currentMapEditorUiState();
            String draftName = mapEditorUiState.draftName();
            if (draftName.isBlank()) {
                presentationModel.applyLocalMutation(
                        new DungeonEditorContributionModel.ShowMapEditorValidationErrorMutation(NAME_MISSING_ERROR));
                return;
            }
            if (mapEditorUiState.isCreateMode()) {
                presentationModel.applyLocalMutation(new DungeonEditorContributionModel.CloseMapEditorMutation());
                publisher.accept(mapCommand(DungeonEditorSessionCommand.Action.CREATE_MAP, null, draftName));
                return;
            }
            if (mapEditorUiState.isRenameMode()) {
                long mapIdValue = mapEditorUiState.mapIdValue();
                if (mapIdValue > NO_MAP_ID) {
                    presentationModel.applyLocalMutation(new DungeonEditorContributionModel.CloseMapEditorMutation());
                    publisher.accept(mapCommand(
                            DungeonEditorSessionCommand.Action.RENAME_MAP,
                            new DungeonEditorWorkspaceValues.MapId(mapIdValue),
                            draftName));
                }
            }
        }

        private static void handleMapDelete(
                DungeonEditorContributionModel presentationModel,
                Consumer<DungeonEditorSessionCommand> publisher
        ) {
            DungeonEditorContributionModel.MapEditorUiState mapEditorUiState =
                    presentationModel.currentInteractionState().currentMapEditorUiState();
            if (!mapEditorUiState.isDeleteMode()) {
                return;
            }
            long mapIdValue = mapEditorUiState.mapIdValue();
            if (mapIdValue > NO_MAP_ID) {
                presentationModel.applyLocalMutation(new DungeonEditorContributionModel.CloseMapEditorMutation());
                publisher.accept(mapCommand(
                        DungeonEditorSessionCommand.Action.DELETE_MAP,
                        new DungeonEditorWorkspaceValues.MapId(mapIdValue),
                        ""));
            }
        }

        private static void handleViewMode(
                DungeonEditorContributionModel presentationModel,
                Consumer<DungeonEditorSessionCommand> publisher,
                @Nullable String viewModeKey
        ) {
            if (viewModeKey == null || viewModeKey.isBlank()) {
                return;
            }
            String normalizedViewModeKey = DungeonEditorContributionModel.ToolCatalog.normalizeViewModeKey(viewModeKey);
            String selectedViewMode = presentationModel.currentInteractionState().currentViewModeKey();
            if (DungeonEditorContributionModel.ToolCatalog.GRAPH_VIEW_LABEL.equals(normalizedViewModeKey)) {
                if (!DungeonEditorContributionModel.ToolCatalog.GRAPH_VIEW_LABEL.equals(selectedViewMode)) {
                    publisher.accept(viewModeCommand(
                            DungeonEditorContributionModel.ToolCatalog.toSessionViewMode(normalizedViewModeKey)));
                }
                return;
            }
            if (!DungeonEditorContributionModel.ToolCatalog.GRID_VIEW_LABEL.equals(selectedViewMode)) {
                publisher.accept(viewModeCommand(DungeonEditorSessionValues.ViewMode.GRID));
            }
        }

        private static void handleToolInput(
                DungeonEditorContributionModel presentationModel,
                Consumer<DungeonEditorSessionCommand> publisher,
                DungeonEditorControlsViewInputEvent.ToolInput toolInput
        ) {
            if (toolInput.dismissRequested()) {
                presentationModel.applyLocalMutation(new DungeonEditorContributionModel.SetToolPaletteMutation(null));
                return;
            }
            if (toolInput.requestedFamily() != null) {
                presentationModel.applyLocalMutation(new DungeonEditorContributionModel.SetToolPaletteMutation(
                        DungeonEditorContributionModel.ToolFamily.valueOf(toolInput.requestedFamily().name())));
            } else {
                presentationModel.applyLocalMutation(new DungeonEditorContributionModel.SetToolPaletteMutation(null));
            }
            DungeonEditorContributionModel.InteractionState interactionState = presentationModel.currentInteractionState();
            if (toolInput.selectedToolLabel() != null
                    && !toolInput.selectedToolLabel().isBlank()
                    && !interactionState.currentSelectedToolLabel().equals(toolInput.selectedToolLabel())) {
                publisher.accept(toolCommand(
                        DungeonEditorContributionModel.ToolCatalog.toSessionTool(toolInput.selectedToolLabel())));
            }
        }

        private static void handleOverlayInput(
                DungeonEditorContributionModel presentationModel,
                Consumer<DungeonEditorSessionCommand> publisher,
                DungeonEditorControlsViewInputEvent.OverlayInput overlayInput
        ) {
            DungeonEditorContributionModel.OverlayProjection currentOverlay =
                    presentationModel.currentInteractionState().currentOverlayProjection();
            List<Integer> selectedLevels = parseLevels(overlayInput.selectedLevelsText());
            if (currentOverlay.modeKey().equals(overlayInput.modeKey())
                    && currentOverlay.levelRange() == overlayInput.levelRange()
                    && Double.compare(currentOverlay.opacity(), overlayInput.opacity()) == 0
                    && parseLevels(currentOverlay.selectedLevelsText()).equals(selectedLevels)) {
                return;
            }
            publisher.accept(overlayCommand(new DungeonEditorSessionValues.OverlaySettings(
                            overlayInput.modeKey(),
                            overlayInput.levelRange(),
                            overlayInput.opacity(),
                            selectedLevels)));
        }
    }

    private static final class StateSaveSupport {

        private static @Nullable DungeonEditorSessionCommand toSaveCommand(
                DungeonEditorContributionModel presentationModel,
                DungeonEditorStateViewInputEvent event
        ) {
            DungeonEditorContributionModel.RoomNarrationCardProjection card =
                    currentNarrationCard(presentationModel, event.roomId());
            if (card == null) {
                return null;
            }
            return roomNarrationCommand(new DungeonEditorSessionCommand.RoomNarrationInput(
                    card.roomId(),
                    event.visualDescription(),
                    mergeExitNarrations(card.exits(), event.exitDescriptions())));
        }

        private static DungeonEditorContributionModel.@Nullable RoomNarrationCardProjection currentNarrationCard(
                DungeonEditorContributionModel presentationModel,
                long roomId
        ) {
            DungeonEditorContributionModel.StateProjection currentProjection = presentationModel.stateProjectionProperty().get();
            DungeonEditorContributionModel.StateProjection safeProjection = currentProjection == null
                    ? DungeonEditorContributionModel.StateProjection.initial()
                    : currentProjection;
            for (DungeonEditorContributionModel.RoomNarrationCardProjection card : safeProjection.narrationCards()) {
                if (card.roomId() == roomId) {
                    return card;
                }
            }
            return null;
        }

        private static List<DungeonEditorWorkspaceValues.RoomExitNarration> mergeExitNarrations(
                List<DungeonEditorContributionModel.RoomExitNarrationProjection> exits,
                List<String> exitDescriptions
        ) {
            List<DungeonEditorWorkspaceValues.RoomExitNarration> merged = new ArrayList<>();
            List<DungeonEditorContributionModel.RoomExitNarrationProjection> safeExits = exits == null ? List.of() : exits;
            List<String> safeDescriptions = exitDescriptions == null ? List.of() : exitDescriptions;
            for (int index = 0; index < safeExits.size(); index++) {
                DungeonEditorContributionModel.RoomExitNarrationProjection exit = safeExits.get(index);
                String description = index < safeDescriptions.size() ? safeDescriptions.get(index) : exit.description();
                merged.add(toRoomExit(exit, description));
            }
            return List.copyOf(merged);
        }

        private static DungeonEditorWorkspaceValues.RoomExitNarration toRoomExit(
                DungeonEditorContributionModel.RoomExitNarrationProjection exit,
                @Nullable String description
        ) {
            DungeonEditorContributionModel.RoomExitNarrationProjection safeExit = exit == null
                    ? new DungeonEditorContributionModel.RoomExitNarrationProjection("", 0, 0, 0, "", "")
                    : exit;
            return new DungeonEditorWorkspaceValues.RoomExitNarration(
                    safeExit.label(),
                    new DungeonEditorWorkspaceValues.Cell(safeExit.q(), safeExit.r(), safeExit.level()),
                    safeExit.direction(),
                    description == null ? safeExit.description() : description);
        }
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

    private static DungeonEditorSessionCommand mainViewCommand(DungeonEditorSessionCommand.MainViewInput mainViewInput) {
        return new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.INTERPRET_MAIN_VIEW,
                null,
                "",
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                DungeonEditorSessionValues.Tool.defaultTool(),
                0,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                mainViewInput,
                DungeonEditorSessionCommand.RoomNarrationInput.empty());
    }

    private static DungeonEditorSessionCommand mapCommand(
            DungeonEditorSessionCommand.Action action,
            DungeonEditorWorkspaceValues.MapId mapId,
            String mapName
    ) {
        return new DungeonEditorSessionCommand(
                action,
                mapId,
                mapName,
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                DungeonEditorSessionValues.Tool.defaultTool(),
                0,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                DungeonEditorSessionCommand.MainViewInput.empty(),
                DungeonEditorSessionCommand.RoomNarrationInput.empty());
    }

    private static DungeonEditorSessionCommand viewModeCommand(DungeonEditorSessionValues.ViewMode viewMode) {
        return new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.SET_VIEW_MODE,
                null,
                "",
                viewMode,
                DungeonEditorSessionValues.Tool.defaultTool(),
                0,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                DungeonEditorSessionCommand.MainViewInput.empty(),
                DungeonEditorSessionCommand.RoomNarrationInput.empty());
    }

    private static DungeonEditorSessionCommand toolCommand(DungeonEditorSessionValues.Tool tool) {
        return new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.SET_TOOL,
                null,
                "",
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                tool,
                0,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                DungeonEditorSessionCommand.MainViewInput.empty(),
                DungeonEditorSessionCommand.RoomNarrationInput.empty());
    }

    private static DungeonEditorSessionCommand shiftProjectionLevelCommand(int projectionLevelDelta) {
        return new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.SHIFT_PROJECTION_LEVEL,
                null,
                "",
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                DungeonEditorSessionValues.Tool.defaultTool(),
                projectionLevelDelta,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                DungeonEditorSessionCommand.MainViewInput.empty(),
                DungeonEditorSessionCommand.RoomNarrationInput.empty());
    }

    private static DungeonEditorSessionCommand overlayCommand(
            DungeonEditorSessionValues.OverlaySettings overlaySettings
    ) {
        return new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.SET_OVERLAY,
                null,
                "",
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                DungeonEditorSessionValues.Tool.defaultTool(),
                0,
                overlaySettings,
                DungeonEditorSessionCommand.MainViewInput.empty(),
                DungeonEditorSessionCommand.RoomNarrationInput.empty());
    }

    private static DungeonEditorSessionCommand roomNarrationCommand(
            DungeonEditorSessionCommand.RoomNarrationInput roomNarration
    ) {
        return new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.SAVE_ROOM_NARRATION,
                null,
                "",
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                DungeonEditorSessionValues.Tool.defaultTool(),
                0,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                DungeonEditorSessionCommand.MainViewInput.empty(),
                roomNarration);
    }
}
