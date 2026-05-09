package src.view.leftbartabs.dungeoneditor;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
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
    private Consumer<DungeonEditorPublishedEvent> publishedEventListener = ignored -> {};

    DungeonEditorIntentHandler(
            DungeonEditorContributionModel presentationModel,
            MapCanvasContentModel mapCanvasContentModel
    ) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
        this.mapCanvasContentModel = Objects.requireNonNull(mapCanvasContentModel, "mapCanvasContentModel");
    }

    void onPublishedEventRequested(Consumer<DungeonEditorPublishedEvent> listener) {
        publishedEventListener = listener == null ? ignored -> {} : listener;
    }

    void consume(DungeonMapViewInputEvent event) {
        if (event == null) {
            return;
        }
        publish(MainViewSupport.toPublishedEvent(mapCanvasContentModel, event.canvasEvent()));
    }

    void consume(DungeonEditorControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        ControlsSupport.consume(presentationModel, this::publish, event);
    }

    void consume(DungeonEditorStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        publish(StateSaveSupport.toSaveEvent(presentationModel, event));
    }

    private void publish(@Nullable DungeonEditorPublishedEvent event) {
        if (event == null) {
            return;
        }
        publishedEventListener.accept(event);
    }

    private static final class MainViewSupport {

        private static @Nullable DungeonEditorPublishedEvent toPublishedEvent(
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
            return DungeonEditorPublishedEvent.interpretMainView(new DungeonEditorPublishedEvent.MainViewInput(
                    toMainViewSource(event.interaction()),
                    event.position().canvasX(),
                    event.position().canvasY(),
                    event.buttons().primaryButtonDown(),
                    event.buttons().secondaryButtonDown(),
                    hitRef(event),
                    0));
        }

        private static @Nullable DungeonEditorPublishedEvent handleScroll(
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
            return DungeonEditorPublishedEvent.interpretMainView(new DungeonEditorPublishedEvent.MainViewInput(
                    DungeonEditorPublishedEvent.MainViewInput.Source.LEVEL_SCROLLED,
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

        private static DungeonEditorPublishedEvent.MainViewInput.Source toMainViewSource(
                MapCanvasViewInputEvent.Interaction interaction
        ) {
            MapCanvasViewInputEvent.Interaction safeInteraction = interaction == null
                    ? MapCanvasViewInputEvent.Interaction.MOVE
                    : interaction;
            return switch (safeInteraction) {
                case PRESS -> DungeonEditorPublishedEvent.MainViewInput.Source.POINTER_PRESSED;
                case DRAG -> DungeonEditorPublishedEvent.MainViewInput.Source.POINTER_DRAGGED;
                case RELEASE -> DungeonEditorPublishedEvent.MainViewInput.Source.POINTER_RELEASED;
                case MOVE -> DungeonEditorPublishedEvent.MainViewInput.Source.POINTER_MOVED;
                case SCROLL -> DungeonEditorPublishedEvent.MainViewInput.Source.LEVEL_SCROLLED;
            };
        }
    }

    private static final class ControlsSupport {

        private static void consume(
                DungeonEditorContributionModel presentationModel,
                Consumer<DungeonEditorPublishedEvent> publisher,
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
                publisher.accept(DungeonEditorPublishedEvent.shiftProjectionLevel(event.projectionLevelShift()));
                return;
            }
            if (event.overlay() != null) {
                handleOverlayInput(presentationModel, publisher, event.overlay());
            }
        }

        private static void handleMapSelection(
                DungeonEditorContributionModel presentationModel,
                Consumer<DungeonEditorPublishedEvent> publisher,
                DungeonEditorControlsViewInputEvent.MapSelectionInput mapSelection
        ) {
            long selectedMapIdValue = mapSelection.selectedMapIdValue();
            DungeonEditorContributionModel.InteractionState interactionState = presentationModel.currentInteractionState();
            if (selectedMapIdValue > NO_MAP_ID
                    && selectedMapIdValue != interactionState.currentSelectedMapIdValue()) {
                publisher.accept(DungeonEditorPublishedEvent.selectMap(selectedMapIdValue));
            }
        }

        private static void handleMapEditor(
                DungeonEditorContributionModel presentationModel,
                Consumer<DungeonEditorPublishedEvent> publisher,
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
                Consumer<DungeonEditorPublishedEvent> publisher
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
                publisher.accept(DungeonEditorPublishedEvent.createMap(draftName));
                return;
            }
            if (mapEditorUiState.isRenameMode()) {
                long mapIdValue = mapEditorUiState.mapIdValue();
                if (mapIdValue > NO_MAP_ID) {
                    presentationModel.applyLocalMutation(new DungeonEditorContributionModel.CloseMapEditorMutation());
                    publisher.accept(DungeonEditorPublishedEvent.renameMap(mapIdValue, draftName));
                }
            }
        }

        private static void handleMapDelete(
                DungeonEditorContributionModel presentationModel,
                Consumer<DungeonEditorPublishedEvent> publisher
        ) {
            DungeonEditorContributionModel.MapEditorUiState mapEditorUiState =
                    presentationModel.currentInteractionState().currentMapEditorUiState();
            if (!mapEditorUiState.isDeleteMode()) {
                return;
            }
            long mapIdValue = mapEditorUiState.mapIdValue();
            if (mapIdValue > NO_MAP_ID) {
                presentationModel.applyLocalMutation(new DungeonEditorContributionModel.CloseMapEditorMutation());
                publisher.accept(DungeonEditorPublishedEvent.deleteMap(mapIdValue));
            }
        }

        private static void handleViewMode(
                DungeonEditorContributionModel presentationModel,
                Consumer<DungeonEditorPublishedEvent> publisher,
                @Nullable String viewModeKey
        ) {
            if (viewModeKey == null || viewModeKey.isBlank()) {
                return;
            }
            String normalizedViewModeKey = DungeonEditorContributionModel.ToolCatalog.normalizeViewModeKey(viewModeKey);
            String selectedViewMode = presentationModel.currentInteractionState().currentViewModeKey();
            if (DungeonEditorContributionModel.ToolCatalog.GRAPH_VIEW_LABEL.equals(normalizedViewModeKey)) {
                if (!DungeonEditorContributionModel.ToolCatalog.GRAPH_VIEW_LABEL.equals(selectedViewMode)) {
                    publisher.accept(DungeonEditorPublishedEvent.setViewMode(
                            DungeonEditorContributionModel.ToolCatalog.toPublishedViewMode(normalizedViewModeKey)));
                }
                return;
            }
            if (!DungeonEditorContributionModel.ToolCatalog.GRID_VIEW_LABEL.equals(selectedViewMode)) {
                publisher.accept(DungeonEditorPublishedEvent.setViewMode(DungeonEditorPublishedEvent.ViewMode.GRID));
            }
        }

        private static void handleToolInput(
                DungeonEditorContributionModel presentationModel,
                Consumer<DungeonEditorPublishedEvent> publisher,
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
                publisher.accept(DungeonEditorPublishedEvent.setTool(
                        DungeonEditorContributionModel.ToolCatalog.toPublishedTool(toolInput.selectedToolLabel())));
            }
        }

        private static void handleOverlayInput(
                DungeonEditorContributionModel presentationModel,
                Consumer<DungeonEditorPublishedEvent> publisher,
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
            publisher.accept(new DungeonEditorPublishedEvent(
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
    }

    private static final class StateSaveSupport {

        private static @Nullable DungeonEditorPublishedEvent toSaveEvent(
                DungeonEditorContributionModel presentationModel,
                DungeonEditorStateViewInputEvent event
        ) {
            DungeonEditorContributionModel.RoomNarrationCardProjection card =
                    currentNarrationCard(presentationModel, event.roomId());
            if (card == null) {
                return null;
            }
            return DungeonEditorPublishedEvent.saveRoomNarration(new DungeonEditorPublishedEvent.RoomNarrationInput(
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

        private static List<DungeonEditorPublishedEvent.RoomExitNarration> mergeExitNarrations(
                List<DungeonEditorContributionModel.RoomExitNarrationProjection> exits,
                List<String> exitDescriptions
        ) {
            List<DungeonEditorPublishedEvent.RoomExitNarration> merged = new ArrayList<>();
            List<DungeonEditorContributionModel.RoomExitNarrationProjection> safeExits = exits == null ? List.of() : exits;
            List<String> safeDescriptions = exitDescriptions == null ? List.of() : exitDescriptions;
            for (int index = 0; index < safeExits.size(); index++) {
                DungeonEditorContributionModel.RoomExitNarrationProjection exit = safeExits.get(index);
                String description = index < safeDescriptions.size() ? safeDescriptions.get(index) : exit.description();
                merged.add(toPublishedExit(exit, description));
            }
            return List.copyOf(merged);
        }

        private static DungeonEditorPublishedEvent.RoomExitNarration toPublishedExit(
                DungeonEditorContributionModel.RoomExitNarrationProjection exit,
                @Nullable String description
        ) {
            DungeonEditorContributionModel.RoomExitNarrationProjection safeExit = exit == null
                    ? new DungeonEditorContributionModel.RoomExitNarrationProjection("", 0, 0, 0, "", "")
                    : exit;
            return new DungeonEditorPublishedEvent.RoomExitNarration(
                    safeExit.label(),
                    new DungeonEditorPublishedEvent.CellRef(safeExit.q(), safeExit.r(), safeExit.level()),
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
}
