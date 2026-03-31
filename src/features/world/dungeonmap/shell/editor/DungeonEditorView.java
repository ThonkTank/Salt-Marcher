package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.shell.AbstractDungeonMapView;
import features.world.dungeonmap.shell.editor.interaction.EditorInteraction;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorInteractionState;
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
                new DungeonMapDropdownController.ReloadHandle() {
                    @Override
                    public Long sessionMapId() {
                        return mapState.activeMapId();
                    }
                });

        // Workspace observes EditorInteractionState directly for preview/selection
        interactionState.addListener(() -> {
            workspace().setSelectedTargetKey(interactionState.selectedTargetKey());
            workspace().setHoveredSelectionKey(interactionState.hoveredKey());
            workspace().showPreview(interactionState.activePreview());
        });

        // Session state → tool activation + controls
        sessionState.addListener(() -> {
            workspace().setViewMode(sessionState.viewMode());
            controls.selectViewMode(sessionState.viewMode());
            controls.showDisplayedTool(sessionState.selectedTool());
            editorInteraction.activateTool(sessionState.selectedTool());
            statePane.refresh(sessionState.selectedTool(), editorInteraction.activeToolPane());
        });

        // Map state → controls refresh (workspace syncs itself via DungeonMapState listener)
        mapState.addListener(() -> {
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
        });

        // Tool state changes → state pane refresh
        editorInteraction.setOnToolStateChanged(
                () -> statePane.refresh(sessionState.selectedTool(), editorInteraction.activeToolPane()));

        // Control callbacks → state mutations
        controls.setOnMapSelected(entry -> {
            if (entry != null) {
                loadingService.loadMap(entry.mapId());
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
}
