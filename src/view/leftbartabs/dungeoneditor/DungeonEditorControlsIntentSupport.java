package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionCommand;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;

final class DungeonEditorControlsIntentSupport {

    private static final String NAME_MISSING_ERROR = "Name fehlt.";
    private static final long NO_MAP_ID = 0L;

    private DungeonEditorControlsIntentSupport() {
    }

    static void consume(
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
            publisher.accept(DungeonEditorSessionCommands.shiftProjectionLevelCommand(event.projectionLevelShift()));
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
            publisher.accept(DungeonEditorSessionCommands.mapCommand(
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
        presentationModel.applyLocalMutation(new DungeonEditorContributionModel.UpdateMapEditorDraftMutation(
                mapEditor.draftName()));
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
            publisher.accept(DungeonEditorSessionCommands.mapCommand(
                    DungeonEditorSessionCommand.Action.CREATE_MAP,
                    null,
                    draftName));
            return;
        }
        if (mapEditorUiState.isRenameMode()) {
            submitRename(presentationModel, publisher, mapEditorUiState, draftName);
        }
    }

    private static void submitRename(
            DungeonEditorContributionModel presentationModel,
            Consumer<DungeonEditorSessionCommand> publisher,
            DungeonEditorContributionModel.MapEditorUiState mapEditorUiState,
            String draftName
    ) {
        long mapIdValue = mapEditorUiState.mapIdValue();
        if (mapIdValue > NO_MAP_ID) {
            presentationModel.applyLocalMutation(new DungeonEditorContributionModel.CloseMapEditorMutation());
            publisher.accept(DungeonEditorSessionCommands.mapCommand(
                    DungeonEditorSessionCommand.Action.RENAME_MAP,
                    new DungeonEditorWorkspaceValues.MapId(mapIdValue),
                    draftName));
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
            publisher.accept(DungeonEditorSessionCommands.mapCommand(
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
                publisher.accept(DungeonEditorSessionCommands.viewModeCommand(
                        DungeonEditorContributionModel.ToolCatalog.toSessionViewMode(normalizedViewModeKey)));
            }
            return;
        }
        if (!DungeonEditorContributionModel.ToolCatalog.GRID_VIEW_LABEL.equals(selectedViewMode)) {
            publisher.accept(DungeonEditorSessionCommands.viewModeCommand(DungeonEditorSessionValues.ViewMode.GRID));
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
            publisher.accept(DungeonEditorSessionCommands.toolCommand(
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
        List<Integer> selectedLevels = DungeonEditorLevelTextSupport.parseLevels(overlayInput.selectedLevelsText());
        if (currentOverlay.modeKey().equals(overlayInput.modeKey())
                && currentOverlay.levelRange() == overlayInput.levelRange()
                && Double.compare(currentOverlay.opacity(), overlayInput.opacity()) == 0
                && DungeonEditorLevelTextSupport.parseLevels(currentOverlay.selectedLevelsText()).equals(selectedLevels)) {
            return;
        }
        publisher.accept(DungeonEditorSessionCommands.overlayCommand(new DungeonEditorSessionValues.OverlaySettings(
                        overlayInput.modeKey(),
                        overlayInput.levelRange(),
                        overlayInput.opacity(),
                        selectedLevels)));
    }
}
