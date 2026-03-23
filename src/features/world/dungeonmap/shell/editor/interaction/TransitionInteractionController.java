package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.transition.DungeonTransitionEditService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.DungeonTransitionDraftState;
import features.world.dungeonmap.state.EditorSelectionState;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.Comparator;
import java.util.Objects;

public final class TransitionInteractionController {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonEditorSessionState sessionState;
    private final EditorSelectionState selectionState;
    private final DungeonTransitionDraftState transitionDraftState;
    private final DungeonTransitionEditService transitionEditService;

    public TransitionInteractionController(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonEditorSessionState sessionState,
            EditorSelectionState selectionState,
            DungeonTransitionDraftState transitionDraftState,
            DungeonTransitionEditService transitionEditService
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.selectionState = Objects.requireNonNull(selectionState, "selectionState");
        this.transitionDraftState = Objects.requireNonNull(transitionDraftState, "transitionDraftState");
        this.transitionEditService = Objects.requireNonNull(transitionEditService, "transitionEditService");
    }

    public boolean handlePressed(DungeonCanvasPointerEvent event) {
        if (event == null || !event.isPrimaryButton()) {
            return false;
        }
        return switch (sessionState.selectedTool()) {
            case TRANSITION_CREATE -> handleCreatePressed(event);
            case TRANSITION_DELETE -> handleDeletePressed(event);
            default -> false;
        };
    }

    public boolean handleDragged(DungeonCanvasPointerEvent event) {
        return false;
    }

    public boolean handleReleased(DungeonCanvasPointerEvent event) {
        return false;
    }

    public void clear() {
        transitionDraftState.clearPlacementError();
    }

    private boolean handleCreatePressed(DungeonCanvasPointerEvent event) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || event.gridCell() == null) {
            return false;
        }
        transitionDraftState.clearPlacementError();
        selectionState.clearSelection();
        if (transitionDraftState.preparedTransitionId() != null && transitionDraftState.preparedTransitionId() > 0) {
            UiAsyncTasks.submitVoid(
                    () -> transitionEditService.placePrepared(
                            transitionDraftState.preparedTransitionId(),
                            event.gridCell(),
                            mapState.activeProjectionLevel()),
                    () -> loadingService.reload(mapId),
                    throwable -> {
                        transitionDraftState.showPlacementError(throwable == null ? "Übergang konnte nicht platziert werden" : throwable.getMessage());
                        UiErrorReporter.reportBackgroundFailure("TransitionInteractionController.handleCreatePressed()", throwable);
                    });
            return true;
        }
        UiAsyncTasks.submitVoid(
                () -> transitionEditService.create(
                        mapState.activeMap(),
                        event.gridCell(),
                        mapState.activeProjectionLevel(),
                        transitionDraftState.createRequest()),
                () -> loadingService.reload(mapId),
                throwable -> {
                    transitionDraftState.showPlacementError(throwable == null ? "Übergang konnte nicht erstellt werden" : throwable.getMessage());
                    UiErrorReporter.reportBackgroundFailure("TransitionInteractionController.handleCreatePressed()", throwable);
                });
        return true;
    }

    private boolean handleDeletePressed(DungeonCanvasPointerEvent event) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || event.gridCell() == null) {
            return false;
        }
        DungeonTransition transition = mapState.activeMap().transitionsAtCell(event.gridCell(), mapState.activeProjectionLevel()).stream()
                .filter(candidate -> candidate != null && candidate.transitionId() != null)
                .min(Comparator.comparing(DungeonTransition::transitionId))
                .orElse(null);
        if (transition == null || transition.transitionId() == null) {
            selectionState.clearSelection();
            return false;
        }
        selectionState.selectTarget(transition.targetKey());
        UiAsyncTasks.submitVoid(
                () -> transitionEditService.delete(transition.transitionId()),
                () -> loadingService.reload(mapId),
                throwable -> UiErrorReporter.reportBackgroundFailure("TransitionInteractionController.handleDeletePressed()", throwable));
        return true;
    }
}
