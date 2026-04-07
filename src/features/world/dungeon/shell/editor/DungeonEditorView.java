package features.world.dungeon.shell.editor;

import features.world.dungeon.catalog.application.DungeonMapCatalogService;
import features.world.dungeon.canvas.base.DungeonEditorRenderState;
import features.world.dungeon.dungoenmap.application.DungeonMapLoadingService;
import features.world.dungeon.shell.AbstractDungeonMapView;
import features.world.dungeon.shell.editor.interaction.EditorInteraction;
import features.world.dungeon.state.DungeonEditorSessionState;
import features.world.dungeon.dungoenmap.state.DungeonMapState;
import features.world.dungeon.state.EditorInteractionState;
import javafx.scene.Node;
import ui.shell.NavigationIcons;

import java.util.Objects;

public final class DungeonEditorView extends AbstractDungeonMapView {

    private final DungeonEditorControls controls = new DungeonEditorControls();
    private final DungeonEditorStatePane statePane = new DungeonEditorStatePane();
    private Long previousMapId;

    public DungeonEditorView(
            DungeonMapLoadingService loadingService,
            DungeonMapState mapState,
            DungeonMapCatalogService mapCatalogService,
            DungeonEditorSessionState sessionState,
            EditorInteraction editorInteraction
    ) {
        super(true, loadingService, mapState);
        EditorInteractionState interactionState = editorInteraction.state();

        DungeonMapDropdownController mapDropdownController = new DungeonMapDropdownController(
                mapCatalogService,
                loadingService,
                mapState);

        // Editor interaction state → one batched render payload for the workspace
        interactionState.addListener(() -> refreshEditorRenderState(interactionState));

        // Session state → tool activation + controls
        sessionState.addListener(() -> refreshSessionUi(sessionState, editorInteraction));

        // Map state → controls refresh (workspace syncs itself via DungeonMapState listener)
        mapState.addListener(() -> refreshMapUi(mapState, sessionState, editorInteraction));

        // Tool state changes → state pane refresh
        editorInteraction.setOnToolStateChanged(
                () -> statePane.refresh(sessionState.selectedTool(), editorInteraction.activeToolPane()));

        // Control callbacks → state mutations
        controls.setOnMapSelected(entry -> {
            if (entry != null) {
                loadingService.selectMap(entry.mapId());
            }
        });
        controls.setOnNewMapRequested(mapDropdownController::showCreate);
        controls.setOnEditMapRequested(request ->
                mapDropdownController.showEdit(new DungeonMapDropdownController.EditRequest(request.map(), request.anchor())));
        controls.setOnPreviousLevelRequested(() -> mapState.setActiveProjectionLevel(mapState.activeProjectionLevel() - 1));
        controls.setOnNextLevelRequested(() -> mapState.setActiveProjectionLevel(mapState.activeProjectionLevel() + 1));
        controls.setOnOverlayModeChanged(mapState::setLevelOverlayMode);
        controls.setOnOverlayRangeChanged(mapState::setLevelOverlayRange);
        controls.setOnOverlayOpacityChanged(mapState::setLevelOverlayOpacity);
        controls.setOnSelectedOverlayLevelsChanged(mapState::setSelectedOverlayLevels);
        controls.setOnViewModeChanged(sessionState::selectViewMode);
        controls.setOnToolChanged(sessionState::selectTool);

        workspace().setInteractionHandler(editorInteraction);
        refreshSessionUi(sessionState, editorInteraction);
        refreshMapUi(mapState, sessionState, editorInteraction);
        refreshEditorRenderState(interactionState);
    }

    @Override
    public String getTitle() {
        return "Dungeon-Editor";
    }

    @Override
    public Node getNavigationGraphic() {
        return NavigationIcons.dungeonEditor();
    }

    @Override
    public Node getControlsContent() {
        return controls;
    }

    @Override
    public Node getStateContent() {
        return statePane.content();
    }

    private static String mapStatusText(DungeonMapState mapState) {
        if (mapState.mutationPending()) {
            return "Aenderungen werden gespeichert...";
        }
        return mapState.errorMessage();
    }

    private void refreshEditorRenderState(EditorInteractionState interactionState) {
        workspace().showEditorRenderState(new DungeonEditorRenderState(
                interactionState.selectedRef(),
                interactionState.hovered(),
                interactionState.activePreview()));
    }

    private void refreshSessionUi(DungeonEditorSessionState sessionState, EditorInteraction editorInteraction) {
        workspace().setViewMode(sessionState.viewMode());
        controls.selectViewMode(sessionState.viewMode());
        controls.showDisplayedTool(sessionState.selectedTool());
        editorInteraction.activateTool(sessionState.selectedTool());
        statePane.refresh(sessionState.selectedTool(), editorInteraction.activeToolPane());
    }

    private void refreshMapUi(
            DungeonMapState mapState,
            DungeonEditorSessionState sessionState,
            EditorInteraction editorInteraction
    ) {
        boolean mapChanged = !Objects.equals(previousMapId, mapState.activeMapId());
        controls.showMaps(mapState.maps(), mapState.activeMapId(), mapState.busy(), mapStatusText(mapState));
        controls.showLevels(
                mapState.activeMap().reachableLevels(),
                mapState.activeProjectionLevel(),
                mapState.busy(),
                mapState.activeMapId() != null);
        controls.showOverlaySettings(mapState.levelOverlaySettings(), mapState.busy());
        if (mapChanged) {
            editorInteraction.activateTool(sessionState.selectedTool());
        }
        statePane.refresh(sessionState.selectedTool(), editorInteraction.activeToolPane());
        previousMapId = mapState.activeMapId();
    }

}
