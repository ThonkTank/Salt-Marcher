package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.api.DungeonCorridorSummary;
import features.world.dungeonmap.api.DungeonRoomClusterSummary;
import features.world.dungeonmap.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.model.DungeonCorridorEndpoint;
import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonClusterVertexRef;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonLayoutEditResult;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.service.catalog.DungeonMapCatalogService;
import features.world.dungeonmap.service.editor.DungeonEditorService;
import features.world.dungeonmap.ui.editor.dropdowns.DungeonMapEditorDropdown;
import features.world.dungeonmap.ui.inspector.DungeonInspectorPresenter;
import features.world.dungeonmap.ui.workspace.DungeonCorridorDoorHandle;
import features.world.dungeonmap.ui.workspace.DungeonCorridorDoorMoveTarget;
import features.world.dungeonmap.ui.workspace.DungeonCorridorWaypointHandle;
import features.world.dungeonmap.ui.workspace.DungeonCorridorWaypointInsert;
import features.world.dungeonmap.ui.workspace.DungeonEditorTool;
import features.world.dungeonmap.ui.workspace.DungeonSplitWorkspace;
import features.world.dungeonmap.ui.workspace.DungeonViewMode;
import features.world.dungeonmap.ui.workspace.DungeonWallPathCommit;
import features.world.dungeonmap.ui.workspace.DungeonWallPathState;
import features.world.dungeonmap.ui.workspace.render.CorridorDoorHit;
import javafx.beans.value.ChangeListener;
import javafx.event.EventHandler;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextInputControl;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.VBox;
import javafx.stage.Window;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;
import ui.components.MessageDropdown;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

public final class DungeonEditorView implements AppView {

    private final DungeonToolModeState toolModeState = new DungeonToolModeState();
    private final DungeonEditorControls controls = new DungeonEditorControls(toolModeState);
    private final DungeonSplitWorkspace workspace = new DungeonSplitWorkspace(true);
    private final VBox statePane = new VBox();
    private final Label activeToolLabel = new Label(DungeonEditorTool.SELECT.label());
    private final Label wallPathLabel = new Label("Kein Startpunkt");
    private final Button cancelWallPathButton = new Button("Pfad verwerfen");
    private final Label corridorEditSelectionLabel = new Label("Kein Korridor gewählt");
    private final Button resetCorridorDoorButton = new Button("Auf Auto zurücksetzen");
    private final Button deleteCorridorWaypointButton = new Button("Zwischenpunkt löschen");
    private final DungeonMapCatalogService mapCatalogService;
    private final DungeonEditorService editorService;
    private final DungeonEditorApplicationService workflow;
    private final DetailsNavigator detailsNavigator;
    private final DungeonMapEditorDropdown mapDropdown = new DungeonMapEditorDropdown();
    private final MessageDropdown messageDropdown = new MessageDropdown();

    private Long currentMapId;
    private DungeonLayout currentLayout;
    private DungeonSelection selectedTarget;
    private DungeonCorridorEndpoint pendingCorridorStart;
    private DungeonViewMode viewMode = DungeonViewMode.GRID;
    private boolean initialLoadDone;
    private Scene shortcutScene;
    private Window shortcutWindow;
    private CorridorDraft suspendedCorridorDraft;
    private DungeonWallPathState suspendedWallPathState;
    private DungeonCorridorWaypointHandle selectedCorridorWaypointHandle;
    private final EventHandler<KeyEvent> keyPressedHandler = this::handleKeyPressed;
    private final EventHandler<KeyEvent> keyReleasedHandler = this::handleKeyReleased;
    private final ChangeListener<Node> focusOwnerListener = (obs, previous, focusOwner) -> {
        if (!isWithinEditorView(focusOwner)) {
            setDeleteOverrideActive(false);
        }
    };
    private final ChangeListener<Boolean> shortcutWindowFocusListener = (obs, wasFocused, isFocused) -> {
        if (!Boolean.TRUE.equals(isFocused)) {
            setDeleteOverrideActive(false);
        }
    };
    private final ChangeListener<Window> shortcutSceneWindowListener = (obs, previousWindow, nextWindow) -> {
        uninstallShortcutWindow(previousWindow);
        installShortcutWindow(nextWindow);
    };

    public DungeonEditorView(
            DetailsNavigator detailsNavigator,
            DungeonMapCatalogService mapCatalogService,
            DungeonEditorService editorService
    ) {
        this.detailsNavigator = Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        this.mapCatalogService = Objects.requireNonNull(mapCatalogService, "mapCatalogService");
        this.editorService = Objects.requireNonNull(editorService, "editorService");
        this.workflow = new DungeonEditorApplicationService(this.mapCatalogService, this.editorService);
        configureStatePane();
        workspace.setOnClusterSelected(this::selectCluster);
        workspace.setOnRoomSelected(this::selectRoom);
        workspace.setOnCorridorSelected(this::selectCorridor);
        workspace.setOnClusterMoved(this::moveCluster);
        workspace.setOnCorridorEndpointSelected(this::selectCorridorTarget);
        workspace.setOnRoomCellsPainted(this::paintRoomCells);
        workspace.setOnRoomCellsDeleted(this::deleteRoomCells);
        workspace.setOnClusterDoorPainted(this::paintClusterDoors);
        workspace.setOnClusterDoorDeleted(this::deleteClusterDoors);
        workspace.setOnWallPathStateChanged(this::refreshStatePane);
        workspace.setOnWallPathCommitRequested(this::commitWallPathSegment);
        workspace.setOnGraphRoomRequested(this::createGraphRoom);
        workspace.setOnGraphClusterDeleted(this::deleteGraphCluster);
        workspace.setOnCorridorDeleted(this::deleteCorridor);
        workspace.setOnCorridorRoomRemoved(this::removeCorridorRoom);
        workspace.setOnCorridorDoorSelected(this::selectCorridorDoorHandle);
        workspace.setOnCorridorDoorSelectionChanged(this::handleCorridorDoorSelectionChanged);
        workspace.setOnCorridorDoorMoved(this::moveCorridorDoorHandle);
        workspace.setOnCorridorWaypointSelected(this::selectCorridorWaypointHandle);
        workspace.setOnCorridorWaypointAdded(this::addCorridorWaypoint);
        workspace.setOnCorridorWaypointRemoved(this::removeCorridorWaypointHandle);
        workspace.setOnCorridorWaypointMoved(this::moveCorridorWaypointHandle);
        controls.setOnMapSelected(this::loadLayoutAsync);
        controls.setOnNewMapRequested(this::showNewMapDropdown);
        controls.setOnEditMapRequested(this::showEditMapDropdown);
        controls.setOnViewModeChanged(this::setViewMode);
        controls.setOnToolChanged(this::setSelectedTool);
        workspace.sceneProperty().addListener((obs, oldScene, newScene) -> {
            detachShortcutContext(oldScene);
            attachShortcutContext(newScene);
        });
        syncEditorTool();
    }

    @Override
    public Node getMainContent() {
        return workspace;
    }

    @Override
    public String getTitle() {
        return "Dungeon-Editor";
    }

    @Override
    public String getIconText() {
        return "\u25A6";
    }

    @Override
    public Node getControlsContent() {
        return controls;
    }

    @Override
    public Node getStateContent() {
        return statePane;
    }

    @Override
    public void onShow() {
        attachShortcutContext(workspace.getScene());
        if (!initialLoadDone) {
            refreshMapsAndLayout(currentMapId);
            initialLoadDone = true;
        }
    }

    @Override
    public void onHide() {
        detachShortcutContext(shortcutScene);
        setDeleteOverrideActive(false);
    }

    private void loadLayoutAsync(Long mapId) {
        if (mapId == null) {
            return;
        }
        refreshMapsAndLayout(mapId);
    }

    private void render() {
        controls.selectViewMode(viewMode);
        syncEditorTool();
        workspace.setViewMode(viewMode);
        workspace.showLayout(currentLayout, selectedTarget, null);
    }

    private void renderSelection() {
        workspace.updateSelection(selectedTarget, null);
        refreshStatePane();
    }

    private void selectCluster(DungeonRoomCluster cluster) {
        showTarget(cluster == null || cluster.clusterId() == null ? null : DungeonSelection.roomCluster(cluster.clusterId()), true);
    }

    private void selectRoom(DungeonRoom room) {
        if (shouldHandleRoomAsCorridorEndpoint(room)) {
            selectCorridorTarget(DungeonCorridorEndpoint.room(room.roomId()));
            return;
        }
        DungeonLayout layout = currentLayout();
        selectCluster(room == null || layout == null ? null : layout.clusterForRoom(room.roomId()));
    }

    private void selectCorridor(DungeonCorridor corridor) {
        if (shouldHandleCorridorAsEndpoint(corridor)) {
            selectCorridorTarget(DungeonCorridorEndpoint.corridor(corridor.corridorId()));
            return;
        }
        workspace.setSelectedCorridorDoorHandle(null);
        selectedCorridorWaypointHandle = null;
        showTarget(corridor == null || corridor.corridorId() == null ? null : DungeonSelection.corridor(corridor.corridorId()), true);
    }

    private void selectCorridor(DungeonCorridor corridor, boolean publishInspector) {
        if (corridor == null || currentLayout() == null) {
            return;
        }
        selectedTarget = DungeonSelection.corridor(corridor.corridorId());
        if (publishInspector) {
            publishCorridorDetails(corridor);
        }
        renderSelection();
    }

    private void publishCorridorDetails(DungeonCorridor corridor) {
        DungeonCorridorSummary summary = DungeonInspectorPresenter.corridorSummary(currentLayout(), corridor, false);
        if (summary == null) {
            return;
        }
        detailsNavigator.showInfo("Korridor",
                new DetailsNavigator.EntryKey("dungeon-corridor", summary.corridorId()),
                DungeonInspectorPresenter.corridorLabel(summary));
    }

    private void moveCluster(DungeonRoomCluster cluster, Point2i center) {
        if (currentMapId == null || cluster == null || cluster.clusterId() == null) {
            return;
        }
        Long clusterId = cluster.clusterId();
        runEdit("DungeonEditorView.moveCluster()",
                (result, layout) -> applyMoveClusterResult(clusterId, result, layout),
                (mapId, onSuccess, onError) -> submitEdit(
                        mapId,
                        () -> editorService.moveCluster(mapId, clusterId, center),
                        onSuccess,
                        onError));
    }

    private void createMap(String name) {
        UiAsyncTasks.submit(() -> mapCatalogService.createMap(name), mapId -> refreshMapsAndLayout(mapId, loadState -> {
            mapDropdown.hide();
            showLoadState(loadState);
        }), throwable -> {
            UiErrorReporter.reportBackgroundFailure("DungeonEditorView.createMap()", throwable);
            mapDropdown.showError("Dungeon konnte nicht erstellt werden.");
        });
    }

    private void updateMap(Long mapId, String name) {
        if (mapId == null) {
            return;
        }
        UiAsyncTasks.submitVoid(() -> mapCatalogService.renameMap(mapId, name), () -> refreshMapsAndLayout(mapId, loadState -> {
            mapDropdown.hide();
            showLoadState(loadState);
        }), throwable -> {
            UiErrorReporter.reportBackgroundFailure("DungeonEditorView.updateMap()", throwable);
            mapDropdown.showError("Dungeon konnte nicht gespeichert werden.");
        });
    }

    private void deleteMap(DungeonMap map) {
        if (map == null || map.mapId() == null) {
            return;
        }
        long mapId = map.mapId();
        UiAsyncTasks.submitVoid(() -> mapCatalogService.deleteMap(mapId),
                () -> refreshMapsAndLayout(Objects.equals(mapId, workflow.activeMapId()) ? null : currentMapId, loadState -> {
            mapDropdown.hide();
            showLoadState(loadState);
        }), throwable -> {
            UiErrorReporter.reportBackgroundFailure("DungeonEditorView.deleteMap()", throwable);
            mapDropdown.showError("Dungeon konnte nicht gelöscht werden.");
        });
    }

    private void showNewMapDropdown(Node anchor) {
        mapDropdown.showCreate(anchor, this::createMap);
    }

    private void showEditMapDropdown(DungeonEditorControls.MapActionRequest request) {
        mapDropdown.showEdit(
                request.anchor(),
                request.map(),
                editRequest -> updateMap(editRequest.mapId(), editRequest.name()),
                () -> deleteMap(request.map()));
    }

    private void setViewMode(DungeonViewMode viewMode) {
        this.viewMode = viewMode == null ? DungeonViewMode.GRID : viewMode;
        if (this.viewMode == DungeonViewMode.GRAPH && activeTool().isWallTool()) {
            workspace.cancelWallPath();
        }
        workspace.setViewMode(this.viewMode);
    }

    private void setSelectedTool(DungeonEditorTool editorTool) {
        toolModeState.selectPersistentTool(editorTool);
        suspendedCorridorDraft = null;
        applyActiveTool();
    }

    private void applyActiveTool() {
        if (activeTool() != DungeonEditorTool.CORRIDOR_CREATE) {
            clearTransientState();
        }
        syncEditorTool();
    }

    private void applyMoveClusterResult(Long clusterId, DungeonLayoutEditResult result) {
        applyMoveClusterResult(clusterId, result, result == null ? null : result.layout());
    }

    private void applyMoveClusterResult(Long clusterId, DungeonLayoutEditResult result, DungeonLayout layout) {
        if (layout == null || clusterId == null || result == null || result.layout() == null) {
            refreshMapsAndLayout(currentMapId);
            return;
        }
        render();
        refreshVisibleInspectorForTarget(selectedTarget);
        refreshStatePane();
    }

    private void showLoadState(DungeonEditorLoadState loadState) {
        controls.setMaps(loadState.maps());
        if (loadState.layout() == null || loadState.selectedMapId() == null) {
            clearLayout();
            return;
        }
        applyLoadedWorkspaceState(loadState.selectedMapId(), loadState.layout());
        selectedTarget = null;
        clearTransientState();
        controls.selectMap(loadState.selectedMapId());
        render();
    }

    private void handleLoadFailure(Throwable throwable) {
        UiErrorReporter.reportBackgroundFailure("DungeonEditorView.refreshMapsAndLayout()", throwable);
        messageDropdown.show(controls, "Dungeon konnte nicht geladen werden", "Bitte Datenbankstatus prüfen.");
    }

    private void clearLayout() {
        applyLoadedWorkspaceState(null, null);
        selectedTarget = null;
        clearTransientState();
        controls.selectMap(null);
        render();
    }

    private void selectCorridorDoorHandle(DungeonCorridorDoorHandle handle) {
        if (handle == null) {
            return;
        }
        selectedCorridorWaypointHandle = null;
        showTarget(DungeonSelection.corridor(handle.corridorId()), false);
    }

    private void handleCorridorDoorSelectionChanged(DungeonCorridorDoorHandle handle) {
        if (handle != null) {
            selectedCorridorWaypointHandle = null;
        }
        refreshStatePane();
    }

    private void moveCorridorDoorHandle(
            DungeonCorridorDoorHandle handle,
            DungeonCorridorDoorMoveTarget target
    ) {
        if (currentMapId == null || handle == null || target == null) {
            return;
        }
        DungeonCorridorDoorHandle nextHandle = new DungeonCorridorDoorHandle(
                handle.corridorId(),
                target.roomId());
        workspace.setSelectedCorridorDoorHandle(handle);
        selectedCorridorWaypointHandle = null;
        runEdit("DungeonEditorView.moveCorridorDoor()",
                (result, layout) -> applyCorridorEditResult(result, layout, nextHandle, null),
                (mapId, onSuccess, onError) -> submitEdit(
                        mapId,
                        () -> editorService.moveCorridorDoor(mapId, handle.corridorId(), handle.roomId(), target.roomCell(), target.direction()),
                        onSuccess,
                        onError));
    }

    private void selectCorridorWaypointHandle(DungeonCorridorWaypointHandle handle) {
        if (handle == null) {
            return;
        }
        selectedCorridorWaypointHandle = handle;
        workspace.setSelectedCorridorDoorHandle(null);
        showTarget(DungeonSelection.corridor(handle.corridorId()), false);
    }

    private void addCorridorWaypoint(DungeonCorridorWaypointInsert hit) {
        if (currentMapId == null || hit == null) {
            return;
        }
        DungeonCorridorWaypointHandle selectedHandle =
                new DungeonCorridorWaypointHandle(hit.corridorId(), hit.insertIndex());
        runEdit("DungeonEditorView.addCorridorWaypoint()",
                (result, layout) -> applyCorridorEditResult(result, layout, null, selectedHandle),
                (mapId, onSuccess, onError) -> submitEdit(
                        mapId,
                        () -> editorService.addCorridorWaypoint(mapId, hit.corridorId(), hit.insertIndex(), hit.cell()),
                        onSuccess,
                        onError));
    }

    private void moveCorridorWaypointHandle(DungeonCorridorWaypointHandle handle, Point2i cell) {
        if (currentMapId == null || handle == null || cell == null) {
            return;
        }
        selectedCorridorWaypointHandle = handle;
        workspace.setSelectedCorridorDoorHandle(null);
        runEdit("DungeonEditorView.moveCorridorWaypoint()",
                (result, layout) -> applyCorridorEditResult(result, layout, null, handle),
                (mapId, onSuccess, onError) -> submitEdit(
                        mapId,
                        () -> editorService.moveCorridorWaypoint(mapId, handle.corridorId(), handle.waypointIndex(), cell),
                        onSuccess,
                        onError));
    }

    private void removeCorridorWaypointHandle(DungeonCorridorWaypointHandle handle) {
        if (currentMapId == null || handle == null) {
            return;
        }
        deleteCorridorWaypoint(handle, "DungeonEditorView.removeCorridorWaypointHandle()");
    }

    private void paintRoomCells(Set<Point2i> cells) {
        if (currentMapId == null || cells == null || cells.isEmpty()) {
            return;
        }
        runEdit("DungeonEditorView.paintRoomCells()",
                (mapId, onSuccess, onError) -> submitEdit(
                        mapId,
                        () -> editorService.paintRoomCells(mapId, cells),
                        onSuccess,
                        onError));
    }

    private void commitWallPathSegment(DungeonWallPathCommit request) {
        if (currentMapId == null || request == null || request.edgeRefs() == null || request.edgeRefs().isEmpty()) {
            return;
        }
        boolean deleteMode = activeTool() == DungeonEditorTool.CLUSTER_WALL_DELETE;
        runEdit(deleteMode ? "DungeonEditorView.deleteClusterWalls()" : "DungeonEditorView.paintClusterWalls()",
                (result, layout) -> applyWallEditResult(result, layout, request.nextAnchor()),
                (mapId, onSuccess, onError) -> submitEdit(
                        mapId,
                        () -> deleteMode
                                ? editorService.deleteClusterWalls(mapId, request.edgeRefs())
                                : editorService.paintClusterWalls(mapId, request.edgeRefs()),
                        onSuccess,
                        throwable -> {
                            workspace.revertPendingWallPathCommit();
                            onError.accept(throwable);
                        }));
    }

    private void paintClusterDoors(Set<DungeonClusterEdgeRef> edgeRefs) {
        if (currentMapId == null || edgeRefs == null || edgeRefs.isEmpty()) {
            return;
        }
        runEdit("DungeonEditorView.paintClusterDoors()",
                (mapId, onSuccess, onError) -> submitEdit(
                        mapId,
                        () -> editorService.paintClusterDoors(mapId, edgeRefs),
                        onSuccess,
                        onError));
    }

    private void deleteClusterDoors(Set<DungeonClusterEdgeRef> edgeRefs) {
        if (currentMapId == null || edgeRefs == null || edgeRefs.isEmpty()) {
            return;
        }
        runEdit("DungeonEditorView.deleteClusterDoors()",
                (mapId, onSuccess, onError) -> submitEdit(
                        mapId,
                        () -> editorService.deleteClusterDoors(mapId, edgeRefs),
                        onSuccess,
                        onError));
    }

    private void createGraphRoom(Point2i center) {
        if (currentMapId == null || center == null) {
            return;
        }
        runEdit("DungeonEditorView.createGraphRoom()",
                (mapId, onSuccess, onError) -> submitEdit(
                        mapId,
                        () -> editorService.createGraphRoom(mapId, center),
                        onSuccess,
                        onError));
    }

    private void deleteRoomCells(Set<Point2i> cells) {
        if (currentMapId == null || cells == null || cells.isEmpty()) {
            return;
        }
        runEdit("DungeonEditorView.deleteRoomCells()",
                (mapId, onSuccess, onError) -> submitEdit(
                        mapId,
                        () -> editorService.deleteRoomsAtCells(mapId, cells),
                        onSuccess,
                        onError));
    }

    private void deleteGraphCluster(DungeonRoomCluster cluster) {
        if (currentMapId == null || cluster == null || cluster.clusterId() == null) {
            return;
        }
        Long clusterId = cluster.clusterId();
        runEdit("DungeonEditorView.deleteGraphCluster()",
                (mapId, onSuccess, onError) -> submitEdit(
                        mapId,
                        () -> editorService.deleteGraphCluster(mapId, clusterId),
                        onSuccess,
                        onError));
    }

    private void selectCorridorTarget(DungeonCorridorEndpoint target) {
        if (currentMapId == null || currentLayout() == null || target == null || activeTool() != DungeonEditorTool.CORRIDOR_CREATE) {
            return;
        }
        if (pendingCorridorStart == null) {
            pendingCorridorStart = target;
            selectCorridorTargetSelection(target);
            return;
        }
        if (pendingCorridorStart.equals(target)) {
            pendingCorridorStart = null;
            selectCorridorTargetSelection(target);
            return;
        }
        DungeonCorridorEndpoint start = pendingCorridorStart;
        pendingCorridorStart = null;
        dispatchCorridorSelection(start, target);
    }

    private void deleteCorridor(DungeonCorridor corridor) {
        if (currentMapId == null || corridor == null || corridor.corridorId() == null) {
            return;
        }
        Long corridorId = corridor.corridorId();
        runEdit("DungeonEditorView.deleteCorridor()",
                (mapId, onSuccess, onError) -> submitEdit(
                        mapId,
                        () -> editorService.deleteCorridor(mapId, corridorId),
                        onSuccess,
                        onError));
    }

    private void removeCorridorRoom(CorridorDoorHit hit) {
        if (currentMapId == null || hit == null || hit.isEmpty()) {
            return;
        }
        runEdit("DungeonEditorView.removeRoomFromCorridor()",
                (mapId, onSuccess, onError) -> submitEdit(
                        mapId,
                        () -> editorService.removeRoomFromCorridors(mapId, hit.corridorIds(), hit.roomId()),
                        onSuccess,
                        onError));
    }

    private void applyRoomEditResult(DungeonLayoutEditResult result) {
        applyRoomEditResult(result, result == null ? null : result.layout());
    }

    private void applyRoomEditResult(DungeonLayoutEditResult result, DungeonLayout layout) {
        if (result == null) {
            refreshMapsAndLayout(currentMapId);
            return;
        }
        clearTransientState();
        selectedTarget = focusedTarget(layout, result);
        render();
        refreshVisibleInspectorForTarget(selectedTarget);
        refreshStatePane();
    }

    private void applyWallEditResult(DungeonLayoutEditResult result, DungeonClusterVertexRef nextAnchor) {
        applyWallEditResult(result, result == null ? null : result.layout(), nextAnchor);
    }

    private void applyWallEditResult(
            DungeonLayoutEditResult result,
            DungeonLayout layout,
            DungeonClusterVertexRef nextAnchor
    ) {
        if (result == null) {
            refreshMapsAndLayout(currentMapId);
            return;
        }
        pendingCorridorStart = null;
        workspace.setSelectedCorridorDoorHandle(null);
        selectedCorridorWaypointHandle = null;
        selectedTarget = focusedTarget(layout, result);
        workspace.applyWallPathCommitResult(nextAnchor);
        render();
        refreshVisibleInspectorForTarget(selectedTarget);
        refreshStatePane();
    }

    private void applyCorridorEditResult(
            DungeonLayoutEditResult result,
            DungeonLayout layout,
            DungeonCorridorDoorHandle doorHandle,
            DungeonCorridorWaypointHandle waypointHandle
    ) {
        applyRoomEditResult(result, layout);
        workspace.setSelectedCorridorDoorHandle(doorHandle);
        selectedCorridorWaypointHandle = waypointHandle;
        refreshStatePane();
    }

    private void applyDeletedCorridorWaypointResult(
            DungeonLayoutEditResult result,
            DungeonLayout layout,
            DungeonCorridorWaypointHandle deletedHandle
    ) {
        DungeonCorridorWaypointHandle nextHandle = null;
        if (layout != null && deletedHandle != null) {
            DungeonCorridor corridor = layout.corridorById(deletedHandle.corridorId());
            if (corridor != null && !corridor.waypoints().isEmpty()) {
                int nextIndex = Math.min(deletedHandle.waypointIndex(), corridor.waypoints().size() - 1);
                nextHandle = new DungeonCorridorWaypointHandle(deletedHandle.corridorId(), nextIndex);
            }
        }
        applyCorridorEditResult(result, layout, null, nextHandle);
    }

    private void syncEditorTool() {
        DungeonEditorTool activeTool = activeTool();
        if (toolModeState.deleteOverrideActive()) {
            controls.showTemporaryTool(activeTool);
        } else {
            controls.selectTool(activeTool);
        }
        activeToolLabel.setText(activeTool.label());
        workspace.setEditorTool(activeTool);
    }

    private void attachShortcutContext(Scene scene) {
        if (scene == null || scene == shortcutScene) {
            return;
        }
        shortcutScene = scene;
        shortcutScene.addEventFilter(KeyEvent.KEY_PRESSED, keyPressedHandler);
        shortcutScene.addEventFilter(KeyEvent.KEY_RELEASED, keyReleasedHandler);
        shortcutScene.focusOwnerProperty().addListener(focusOwnerListener);
        shortcutScene.windowProperty().addListener(shortcutSceneWindowListener);
        installShortcutWindow(scene.getWindow());
    }

    private void detachShortcutContext(Scene scene) {
        if (scene == null) {
            return;
        }
        scene.removeEventFilter(KeyEvent.KEY_PRESSED, keyPressedHandler);
        scene.removeEventFilter(KeyEvent.KEY_RELEASED, keyReleasedHandler);
        scene.focusOwnerProperty().removeListener(focusOwnerListener);
        scene.windowProperty().removeListener(shortcutSceneWindowListener);
        uninstallShortcutWindow(scene.getWindow());
        if (scene == shortcutScene) {
            shortcutScene = null;
        }
    }

    private void installShortcutWindow(Window window) {
        if (window == null || window == shortcutWindow) {
            return;
        }
        shortcutWindow = window;
        shortcutWindow.focusedProperty().addListener(shortcutWindowFocusListener);
    }

    private void uninstallShortcutWindow(Window window) {
        if (window == null) {
            return;
        }
        window.focusedProperty().removeListener(shortcutWindowFocusListener);
        if (window == shortcutWindow) {
            shortcutWindow = null;
        }
    }

    private void handleKeyPressed(KeyEvent event) {
        if (shouldIgnoreShortcut(event)) {
            return;
        }
        if (event.getCode() == KeyCode.CONTROL) {
            if (setDeleteOverrideActive(true)) {
                event.consume();
            }
            return;
        }
        if (event.isControlDown()) {
            return;
        }
        if (event.getCode() == KeyCode.E) {
            if (switchPersistentToolMode(false)) {
                event.consume();
            }
            return;
        }
        if (event.getCode() == KeyCode.D && switchPersistentToolMode(true)) {
            event.consume();
        }
    }

    private void handleKeyReleased(KeyEvent event) {
        if (event.getCode() == KeyCode.CONTROL && setDeleteOverrideActive(false)) {
            event.consume();
        }
    }

    private boolean isWithinEditorView(Node node) {
        Node current = node;
        while (current != null) {
            if (current == controls || current == workspace || current == statePane) {
                return true;
            }
            current = current.getParent();
        }
        return false;
    }

    private boolean shouldIgnoreShortcut(KeyEvent event) {
        if (event == null || event.getTarget() instanceof TextInputControl) {
            return true;
        }
        if (event.getTarget() instanceof Node node) {
            // Editor shortcuts are view-scoped: they should work from controls, canvas,
            // and state pane, but never leak into other shell panels.
            return !isWithinEditorView(node);
        }
        return true;
    }

    private DungeonEditorTool activeTool() {
        return toolModeState.activeTool();
    }

    private boolean switchPersistentToolMode(boolean deleteMode) {
        DungeonEditorTool nextTool = toolModeState.switchPersistentMode(deleteMode);
        if (nextTool == null) {
            return false;
        }
        suspendedCorridorDraft = null;
        applyActiveTool();
        return true;
    }

    private boolean setDeleteOverrideActive(boolean active) {
        if (active) {
            DungeonEditorTool deleteTool = toolModeState.selectedTool().deleteVariant();
            if (toolModeState.deleteOverrideActive() || deleteTool == null || deleteTool == activeTool()) {
                return false;
            }
            // Ctrl must behave like a reversible preview of delete mode, not a mode commit.
            suspendTemporaryToolState();
            toolModeState.showDeleteOverride();
            applyActiveTool();
            return true;
        }
        if (!toolModeState.deleteOverrideActive()) {
            return false;
        }
        toolModeState.clearDeleteOverride();
        applyActiveTool();
        restoreSuspendedToolState();
        return true;
    }

    private void suspendTemporaryToolState() {
        if (toolModeState.selectedTool() == DungeonEditorTool.CORRIDOR_CREATE) {
            suspendedCorridorDraft = new CorridorDraft(
                    pendingCorridorStart,
                    workspace.selectedCorridorDoorHandle(),
                    selectedCorridorWaypointHandle);
        } else {
            suspendedCorridorDraft = null;
        }
        suspendedWallPathState = toolModeState.selectedTool().isWallTool() ? workspace.snapshotWallPathState() : null;
    }

    private void restoreSuspendedToolState() {
        if (toolModeState.selectedTool() == DungeonEditorTool.CORRIDOR_CREATE && suspendedCorridorDraft != null) {
            pendingCorridorStart = suspendedCorridorDraft.pendingStart();
            workspace.setSelectedCorridorDoorHandle(suspendedCorridorDraft.selectedDoorHandle());
            selectedCorridorWaypointHandle = suspendedCorridorDraft.selectedWaypointHandle();
            refreshStatePane();
        }
        suspendedCorridorDraft = null;
        if (toolModeState.selectedTool().isWallTool() && suspendedWallPathState != null) {
            workspace.restoreWallPathState(suspendedWallPathState);
        }
        suspendedWallPathState = null;
    }

    private void handleEditFailure(long mapId, String action, Throwable throwable) {
        UiErrorReporter.reportBackgroundFailure(action, throwable);
        clearTransientState();
        refreshMapsAndLayout(mapId);
    }

    private void runEdit(String action, EditCall call) {
        runEdit(action, this::applyRoomEditResult, call);
    }

    private void runEdit(String action, EditResultHandler onSuccess, EditCall call) {
        if (currentMapId == null) {
            return;
        }
        long mapId = currentMapId;
        call.run(mapId, onSuccess, throwable -> handleEditFailure(mapId, action, throwable));
    }

    private void dispatchCorridorSelection(DungeonCorridorEndpoint start, DungeonCorridorEndpoint target) {
        if (start == null || target == null) {
            return;
        }
        if (start instanceof DungeonCorridorEndpoint.Room startRoom && target instanceof DungeonCorridorEndpoint.Room targetRoom) {
            List<Long> roomIds = List.of(startRoom.roomId(), targetRoom.roomId());
            runEdit("DungeonEditorView.createCorridor()",
                    (ignoredMapId, onSuccess, onError) -> submitEdit(
                            ignoredMapId,
                            () -> editorService.createCorridor(ignoredMapId, roomIds),
                            onSuccess,
                            onError));
            return;
        }
        if (start instanceof DungeonCorridorEndpoint.Corridor startCorridor
                && target instanceof DungeonCorridorEndpoint.Corridor targetCorridor) {
            long keptCorridorId = targetCorridor.corridorId();
            long mergedCorridorId = startCorridor.corridorId();
            runEdit("DungeonEditorView.mergeCorridors()",
                    (ignoredMapId, onSuccess, onError) -> submitEdit(
                            ignoredMapId,
                            () -> editorService.mergeCorridors(ignoredMapId, keptCorridorId, mergedCorridorId),
                            onSuccess,
                            onError));
            return;
        }
        if (start instanceof DungeonCorridorEndpoint.Corridor && target instanceof DungeonCorridorEndpoint.Room) {
            dispatchCorridorSelection(target, start);
            return;
        }
        if (!(start instanceof DungeonCorridorEndpoint.Room startRoom)
                || !(target instanceof DungeonCorridorEndpoint.Corridor targetCorridor)) {
            return;
        }
        long roomId = startRoom.roomId();
        long corridorId = targetCorridor.corridorId();
        DungeonCorridor corridor = DungeonInspectorPresenter.findCorridor(currentLayout(), corridorId);
        if (corridor != null && corridor.roomIds().contains(roomId)) {
            selectCorridorTargetSelection(target);
            return;
        }
        runEdit("DungeonEditorView.addRoomToCorridor()",
                (ignoredMapId, onSuccess, onError) -> submitEdit(
                        ignoredMapId,
                        () -> editorService.addRoomToCorridor(ignoredMapId, corridorId, roomId),
                        onSuccess,
                        onError));
    }

    private void configureStatePane() {
        statePane.getStyleClass().add("dungeon-editor-sidebar");
        activeToolLabel.getStyleClass().add("editor-panel-title");
        cancelWallPathButton.setOnAction(event -> workspace.cancelWallPath());
        resetCorridorDoorButton.setOnAction(event -> resetSelectedCorridorDoor());
        deleteCorridorWaypointButton.setOnAction(event -> deleteSelectedCorridorWaypoint());
        statePane.getChildren().addAll(
                card("Werkzeug", activeToolLabel),
                card("Wand", wallPathLabel, cancelWallPathButton),
                card("Korridor", corridorEditSelectionLabel, resetCorridorDoorButton, deleteCorridorWaypointButton));
        refreshStatePane();
    }

    private void refreshMapsAndLayout(Long preferredMapId) {
        refreshMapsAndLayout(preferredMapId, this::showLoadState);
    }

    private void refreshMapsAndLayout(Long preferredMapId, Consumer<DungeonEditorLoadState> onSuccess) {
        workflow.refreshMapsAndLayout(preferredMapId, onSuccess, this::handleLoadFailure);
    }

    private void submitEdit(
            long mapId,
            Callable<DungeonLayoutEditResult> work,
            EditResultHandler onSuccess,
            Consumer<Throwable> onError
    ) {
        workflow.submitEdit(
                mapId,
                work,
                (result, layout) -> {
                    updateLayout(layout);
                    onSuccess.accept(result, layout);
                },
                onError);
    }

    private void applyLoadedWorkspaceState(Long mapId, DungeonLayout layout) {
        currentMapId = mapId;
        updateLayout(layout);
    }

    private void updateLayout(DungeonLayout layout) {
        currentLayout = layout;
    }

    private void clearTransientState() {
        pendingCorridorStart = null;
        workspace.setSelectedCorridorDoorHandle(null);
        selectedCorridorWaypointHandle = null;
        refreshStatePane();
    }

    private void selectCorridorTargetSelection(DungeonCorridorEndpoint target) {
        DungeonLayout layout = currentLayout();
        if (layout == null) {
            return;
        }
        if (target instanceof DungeonCorridorEndpoint.Room roomEndpoint) {
            DungeonRoomCluster cluster = layout.clusterForRoom(roomEndpoint.roomId());
            showTarget(cluster == null || cluster.clusterId() == null ? null : DungeonSelection.roomCluster(cluster.clusterId()), true);
            return;
        }
        if (target instanceof DungeonCorridorEndpoint.Corridor corridorEndpoint) {
            showTarget(DungeonSelection.corridor(corridorEndpoint.corridorId()), true);
        }
    }

    private static DungeonSelection focusedTarget(DungeonLayout layout, DungeonLayoutEditResult result) {
        if (layout == null || result == null || result.focusSelection() == null) {
            return null;
        }
        if (result.focusSelection() instanceof DungeonSelection.RoomCluster cluster
                && DungeonInspectorPresenter.findCluster(layout, cluster.clusterId()) != null) {
            return cluster;
        }
        if (result.focusSelection() instanceof DungeonSelection.Corridor corridor
                && DungeonInspectorPresenter.findCorridor(layout, corridor.corridorId()) != null) {
            return corridor;
        }
        return null;
    }

    private void refreshVisibleInspectorForTarget(DungeonSelection target) {
        if (target == null || currentLayout() == null) {
            return;
        }
        DetailsNavigator.EntryKey entryKey = detailsEntryKey(target);
        if (entryKey == null || !detailsNavigator.isShowing(entryKey)) {
            return;
        }
        showTarget(target, false);
        publishInspectorForTarget(target);
    }

    private boolean shouldHandleRoomAsCorridorEndpoint(DungeonRoom room) {
        return room != null
                && room.roomId() != null
                && activeTool() == DungeonEditorTool.CORRIDOR_CREATE
                && currentMapId != null;
    }

    private boolean shouldHandleCorridorAsEndpoint(DungeonCorridor corridor) {
        return corridor != null
                && corridor.corridorId() != null
                && activeTool() == DungeonEditorTool.CORRIDOR_CREATE
                && currentMapId != null;
    }

    private void showTarget(DungeonSelection target, boolean publishInspector) {
        if (target == null) {
            selectedTarget = null;
            workspace.setSelectedCorridorDoorHandle(null);
            selectedCorridorWaypointHandle = null;
            renderSelection();
            return;
        }
        DungeonLayout layout = currentLayout();
        if (layout == null) {
            return;
        }
        if (target instanceof DungeonSelection.RoomCluster cluster) {
            showSelectedCluster(DungeonInspectorPresenter.findCluster(layout, cluster.clusterId()), publishInspector);
            return;
        }
        if (target instanceof DungeonSelection.Corridor corridor) {
            selectCorridor(DungeonInspectorPresenter.findCorridor(layout, corridor.corridorId()), publishInspector);
        }
    }

    private void publishInspectorForTarget(DungeonSelection target) {
        DungeonLayout layout = currentLayout();
        if (target == null || layout == null) {
            return;
        }
        if (target instanceof DungeonSelection.RoomCluster clusterSelection) {
            DungeonRoomCluster cluster = DungeonInspectorPresenter.findCluster(layout, clusterSelection.clusterId());
            DungeonRoomClusterSummary summary = DungeonInspectorPresenter.clusterSummary(layout, cluster, false);
            if (summary != null) {
                detailsNavigator.showDungeonRoomCluster(summary);
            }
            return;
        }
        if (target instanceof DungeonSelection.Corridor corridorSelection) {
            DungeonCorridor corridor = DungeonInspectorPresenter.findCorridor(layout, corridorSelection.corridorId());
            if (corridor != null) {
                publishCorridorDetails(corridor);
            }
        }
    }

    private DetailsNavigator.EntryKey detailsEntryKey(DungeonSelection target) {
        if (target == null) {
            return null;
        }
        if (target instanceof DungeonSelection.RoomCluster cluster) {
            return new DetailsNavigator.EntryKey("dungeon-room-cluster", cluster.clusterId());
        }
        if (target instanceof DungeonSelection.Corridor corridor) {
            return new DetailsNavigator.EntryKey("dungeon-corridor", corridor.corridorId());
        }
        return null;
    }

    private void showSelectedCluster(DungeonRoomCluster cluster, boolean publishInspector) {
        selectedTarget = cluster == null || cluster.clusterId() == null ? null : DungeonSelection.roomCluster(cluster.clusterId());
        workspace.setSelectedCorridorDoorHandle(null);
        selectedCorridorWaypointHandle = null;
        if (publishInspector) {
            DungeonRoomClusterSummary summary = DungeonInspectorPresenter.clusterSummary(currentLayout(), cluster, false);
            if (summary != null) {
                detailsNavigator.showDungeonRoomCluster(summary);
            }
        }
        renderSelection();
    }

    private void resetSelectedCorridorDoor() {
        DungeonCorridorDoorHandle handle = workspace.selectedCorridorDoorHandle();
        if (currentMapId == null || handle == null) {
            return;
        }
        runEdit("DungeonEditorView.resetCorridorDoor()",
                (result, layout) -> applyCorridorEditResult(result, layout, null, null),
                (mapId, onSuccess, onError) -> submitEdit(
                        mapId,
                        () -> editorService.resetCorridorDoor(mapId, handle.corridorId(), handle.roomId()),
                        onSuccess,
                        onError));
    }

    private void deleteSelectedCorridorWaypoint() {
        if (currentMapId == null || selectedCorridorWaypointHandle == null) {
            return;
        }
        deleteCorridorWaypoint(selectedCorridorWaypointHandle, "DungeonEditorView.deleteCorridorWaypoint()");
    }

    private void deleteCorridorWaypoint(DungeonCorridorWaypointHandle handle, String action) {
        if (currentMapId == null || handle == null) {
            return;
        }
        runEdit(action,
                (result, layout) -> applyDeletedCorridorWaypointResult(result, layout, handle),
                (mapId, onSuccess, onError) -> submitEdit(
                        mapId,
                        () -> editorService.deleteCorridorWaypoint(mapId, handle.corridorId(), handle.waypointIndex()),
                        onSuccess,
                        onError));
    }

    private void refreshStatePane() {
        DungeonClusterVertexRef shownWallAnchor = workspace.displayedWallAnchor();
        if (activeTool().isWallTool() && shownWallAnchor != null) {
            wallPathLabel.setText(
                    "Cluster " + shownWallAnchor.clusterId()
                            + " @ Ecke " + shownWallAnchor.point().x() + "/" + shownWallAnchor.point().y());
            cancelWallPathButton.setManaged(true);
            cancelWallPathButton.setVisible(true);
        } else if (activeTool().isWallTool()) {
            wallPathLabel.setText("Kein Startpunkt");
            cancelWallPathButton.setManaged(false);
            cancelWallPathButton.setVisible(false);
        } else {
            wallPathLabel.setText("Kein Startpunkt");
            cancelWallPathButton.setManaged(false);
            cancelWallPathButton.setVisible(false);
        }
        DungeonLayout layout = currentLayout();
        DungeonCorridor selectedCorridor = selectedTarget instanceof DungeonSelection.Corridor corridorSelection && layout != null
                ? layout.corridorById(corridorSelection.corridorId())
                : null;
        DungeonCorridorDoorHandle selectedCorridorDoorHandle = workspace.selectedCorridorDoorHandle();
        if (selectedCorridor == null || selectedCorridor.corridorId() == null) {
            corridorEditSelectionLabel.setText("Kein Korridor gewählt");
            resetCorridorDoorButton.setManaged(false);
            resetCorridorDoorButton.setVisible(false);
            deleteCorridorWaypointButton.setManaged(false);
            deleteCorridorWaypointButton.setVisible(false);
            return;
        }
        if (selectedCorridorDoorHandle != null && selectedCorridorDoorHandle.corridorId() == selectedCorridor.corridorId()) {
            corridorEditSelectionLabel.setText("Tür an Raum " + selectedCorridorDoorHandle.roomId());
            resetCorridorDoorButton.setManaged(true);
            resetCorridorDoorButton.setVisible(true);
            deleteCorridorWaypointButton.setManaged(false);
            deleteCorridorWaypointButton.setVisible(false);
            return;
        }
        if (selectedCorridorWaypointHandle != null && selectedCorridorWaypointHandle.corridorId() == selectedCorridor.corridorId()) {
            corridorEditSelectionLabel.setText("Zwischenpunkt " + (selectedCorridorWaypointHandle.waypointIndex() + 1));
            resetCorridorDoorButton.setManaged(false);
            resetCorridorDoorButton.setVisible(false);
            deleteCorridorWaypointButton.setManaged(true);
            deleteCorridorWaypointButton.setVisible(true);
            return;
        }
        corridorEditSelectionLabel.setText("Korridor " + selectedCorridor.corridorId() + " ausgewählt");
        resetCorridorDoorButton.setManaged(false);
        resetCorridorDoorButton.setVisible(false);
        deleteCorridorWaypointButton.setManaged(false);
        deleteCorridorWaypointButton.setVisible(false);
    }

    private String directionLabel(DungeonRoomCluster.EdgeDirection direction) {
        if (direction == null) {
            return "";
        }
        return switch (direction) {
            case NORTH -> "Nord";
            case EAST -> "Ost";
            case SOUTH -> "Sued";
            case WEST -> "West";
        };
    }

    private record CorridorDraft(
            DungeonCorridorEndpoint pendingStart,
            DungeonCorridorDoorHandle selectedDoorHandle,
            DungeonCorridorWaypointHandle selectedWaypointHandle
    ) {
    }

    @FunctionalInterface
    private interface EditCall {
        void run(long mapId, EditResultHandler onSuccess, Consumer<Throwable> onError);
    }

    @FunctionalInterface
    private interface EditResultHandler {
        void accept(DungeonLayoutEditResult result, DungeonLayout layout);
    }

    private static VBox card(String title, Node... content) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("editor-panel-title");
        VBox box = new VBox(6);
        box.getStyleClass().add("editor-card");
        box.getChildren().add(titleLabel);
        box.getChildren().addAll(content);
        return box;
    }

    private DungeonLayout currentLayout() {
        return currentLayout;
    }
}
