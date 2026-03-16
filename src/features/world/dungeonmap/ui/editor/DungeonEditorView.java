package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.api.DungeonCorridorSummary;
import features.world.dungeonmap.api.DungeonRoomClusterSummary;
import features.world.dungeonmap.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.model.DungeonCorridorEndpoint;
import features.world.dungeonmap.model.DungeonCorridor;
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
import features.world.dungeonmap.ui.workspace.DungeonEditorTool;
import features.world.dungeonmap.ui.workspace.DungeonSplitWorkspace;
import features.world.dungeonmap.ui.workspace.DungeonViewMode;
import features.world.dungeonmap.ui.workspace.render.CorridorDoorHit;
import features.world.dungeonmap.ui.workspace.render.CorridorEditInteractionController;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;
import ui.components.MessageDropdown;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

public final class DungeonEditorView implements AppView {

    private final DungeonEditorControls controls = new DungeonEditorControls();
    private final DungeonSplitWorkspace workspace = new DungeonSplitWorkspace(true);
    private final VBox statePane = new VBox();
    private final Label activeToolLabel = new Label(DungeonEditorTool.SELECT.label());
    private final Label corridorEditSelectionLabel = new Label("Kein Korridor gewählt");
    private final Button resetCorridorDoorButton = new Button("Auf Auto zurücksetzen");
    private final Button deleteCorridorWaypointButton = new Button("Zwischenpunkt löschen");
    private final DungeonMapCatalogService mapCatalogService;
    private final DungeonEditorService editorService;
    private final DetailsNavigator detailsNavigator;
    private final DungeonMapEditorDropdown mapDropdown = new DungeonMapEditorDropdown();
    private final MessageDropdown messageDropdown = new MessageDropdown();
    private final AtomicLong loadSequence = new AtomicLong();
    private final AtomicLong editSequence = new AtomicLong();

    private Long currentMapId;
    private DungeonLayout currentLayout;
    private DungeonSelection selectedTarget;
    private DungeonCorridorEndpoint pendingCorridorStart;
    private DungeonViewMode viewMode = DungeonViewMode.GRID;
    private DungeonEditorTool editorTool = DungeonEditorTool.SELECT;
    private Long activeMapId;
    private boolean initialLoadDone;
    private CorridorEditInteractionController.DoorHandle selectedCorridorDoorHandle;
    private CorridorEditInteractionController.WaypointHandle selectedCorridorWaypointHandle;

    public DungeonEditorView(
            DetailsNavigator detailsNavigator,
            DungeonMapCatalogService mapCatalogService,
            DungeonEditorService editorService
    ) {
        this.detailsNavigator = Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        this.mapCatalogService = Objects.requireNonNull(mapCatalogService, "mapCatalogService");
        this.editorService = Objects.requireNonNull(editorService, "editorService");
        configureStatePane();
        workspace.setOnClusterSelected(this::selectCluster);
        workspace.setOnRoomSelected(this::selectRoom);
        workspace.setOnCorridorSelected(this::selectCorridor);
        workspace.setOnClusterMoved(this::moveCluster);
        workspace.setOnCorridorEndpointSelected(this::selectCorridorTarget);
        workspace.setOnRoomCellsPainted(this::paintRoomCells);
        workspace.setOnRoomCellsDeleted(this::deleteRoomCells);
        workspace.setOnClusterWallPainted(this::paintClusterWalls);
        workspace.setOnClusterDoorPainted(this::paintClusterDoors);
        workspace.setOnGraphRoomRequested(this::createGraphRoom);
        workspace.setOnGraphClusterDeleted(this::deleteGraphCluster);
        workspace.setOnCorridorDeleted(this::deleteCorridor);
        workspace.setOnCorridorRoomRemoved(this::removeCorridorRoom);
        workspace.setOnCorridorDoorSelected(this::selectCorridorDoorHandle);
        workspace.setOnCorridorDoorMoved(this::moveCorridorDoorHandle);
        workspace.setOnCorridorWaypointSelected(this::selectCorridorWaypointHandle);
        workspace.setOnCorridorWaypointAdded(this::addCorridorWaypoint);
        workspace.setOnCorridorWaypointMoved(this::moveCorridorWaypointHandle);
        controls.setOnMapSelected(this::loadLayoutAsync);
        controls.setOnNewMapRequested(this::showNewMapDropdown);
        controls.setOnEditMapRequested(this::showEditMapDropdown);
        controls.setOnViewModeChanged(this::setViewMode);
        controls.setOnToolChanged(this::setEditorTool);
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
        if (!initialLoadDone) {
            refreshMapsAndLayout(currentMapId);
            initialLoadDone = true;
        }
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
        selectCluster(room == null ? null : currentLayout.clusterForRoom(room.roomId()));
    }

    private void selectCorridor(DungeonCorridor corridor) {
        if (shouldHandleCorridorAsEndpoint(corridor)) {
            selectCorridorTarget(DungeonCorridorEndpoint.corridor(corridor.corridorId()));
            return;
        }
        selectedCorridorDoorHandle = null;
        selectedCorridorWaypointHandle = null;
        showTarget(corridor == null || corridor.corridorId() == null ? null : DungeonSelection.corridor(corridor.corridorId()), true);
    }

    private void selectCorridor(DungeonCorridor corridor, boolean publishInspector) {
        if (corridor == null || currentLayout == null) {
            return;
        }
        selectedTarget = DungeonSelection.corridor(corridor.corridorId());
        if (publishInspector) {
            publishCorridorDetails(corridor);
        }
        renderSelection();
    }

    private void publishCorridorDetails(DungeonCorridor corridor) {
        DungeonCorridorSummary summary = DungeonInspectorPresenter.corridorSummary(currentLayout, corridor, false);
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
                result -> applyMoveClusterResult(clusterId, result),
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
                () -> refreshMapsAndLayout(Objects.equals(mapId, activeMapId) ? null : currentMapId, loadState -> {
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
        workspace.setViewMode(this.viewMode);
    }

    private void setEditorTool(DungeonEditorTool editorTool) {
        this.editorTool = editorTool == null ? DungeonEditorTool.SELECT : editorTool;
        if (this.editorTool != DungeonEditorTool.CORRIDOR_CREATE) {
            clearTransientState();
        }
        syncEditorTool();
    }

    private void applyMoveClusterResult(Long clusterId, DungeonLayoutEditResult result) {
        if (currentLayout == null || clusterId == null || result == null || result.layout() == null) {
            refreshMapsAndLayout(currentMapId);
            return;
        }
        currentLayout = result.layout();
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
        currentMapId = loadState.selectedMapId();
        activeMapId = loadState.selectedMapId();
        currentLayout = loadState.layout();
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
        currentMapId = null;
        activeMapId = null;
        currentLayout = null;
        selectedTarget = null;
        clearTransientState();
        controls.selectMap(null);
        render();
    }

    private void selectCorridorDoorHandle(CorridorEditInteractionController.DoorHandle handle) {
        if (handle == null) {
            return;
        }
        selectedCorridorDoorHandle = handle;
        selectedCorridorWaypointHandle = null;
        showTarget(DungeonSelection.corridor(handle.corridorId()), false);
    }

    private void moveCorridorDoorHandle(
            CorridorEditInteractionController.DoorHandle handle,
            CorridorEditInteractionController.DoorMoveTarget target
    ) {
        if (currentMapId == null || handle == null || target == null) {
            return;
        }
        selectedCorridorDoorHandle = handle;
        selectedCorridorWaypointHandle = null;
        runEdit("DungeonEditorView.moveCorridorDoor()",
                result -> applyCorridorEditResult(result, handle, null),
                (mapId, onSuccess, onError) -> submitEdit(
                        mapId,
                        () -> editorService.moveCorridorDoor(mapId, handle.corridorId(), handle.roomId(), target.roomCell(), target.direction()),
                        onSuccess,
                        onError));
    }

    private void selectCorridorWaypointHandle(CorridorEditInteractionController.WaypointHandle handle) {
        if (handle == null) {
            return;
        }
        selectedCorridorWaypointHandle = handle;
        selectedCorridorDoorHandle = null;
        showTarget(DungeonSelection.corridor(handle.corridorId()), false);
    }

    private void addCorridorWaypoint(CorridorEditInteractionController.SegmentInsertHit hit) {
        if (currentMapId == null || hit == null) {
            return;
        }
        CorridorEditInteractionController.WaypointHandle selectedHandle =
                new CorridorEditInteractionController.WaypointHandle(hit.corridorId(), hit.insertIndex());
        runEdit("DungeonEditorView.addCorridorWaypoint()",
                result -> applyCorridorEditResult(result, null, selectedHandle),
                (mapId, onSuccess, onError) -> submitEdit(
                        mapId,
                        () -> editorService.addCorridorWaypoint(mapId, hit.corridorId(), hit.insertIndex(), hit.cell()),
                        onSuccess,
                        onError));
    }

    private void moveCorridorWaypointHandle(CorridorEditInteractionController.WaypointHandle handle, Point2i cell) {
        if (currentMapId == null || handle == null || cell == null) {
            return;
        }
        selectedCorridorWaypointHandle = handle;
        selectedCorridorDoorHandle = null;
        runEdit("DungeonEditorView.moveCorridorWaypoint()",
                result -> applyCorridorEditResult(result, null, handle),
                (mapId, onSuccess, onError) -> submitEdit(
                        mapId,
                        () -> editorService.moveCorridorWaypoint(mapId, handle.corridorId(), handle.waypointIndex(), cell),
                        onSuccess,
                        onError));
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

    private void paintClusterWalls(Set<DungeonClusterEdgeRef> edgeRefs) {
        if (currentMapId == null || edgeRefs == null || edgeRefs.isEmpty()) {
            return;
        }
        runEdit("DungeonEditorView.paintClusterWalls()",
                (mapId, onSuccess, onError) -> submitEdit(
                        mapId,
                        () -> editorService.paintClusterWalls(mapId, edgeRefs),
                        onSuccess,
                        onError));
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
        if (currentMapId == null || currentLayout == null || target == null || editorTool != DungeonEditorTool.CORRIDOR_CREATE) {
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
        if (result == null) {
            refreshMapsAndLayout(currentMapId);
            return;
        }
        currentLayout = result.layout();
        clearTransientState();
        selectedTarget = focusedTarget(currentLayout, result);
        render();
        refreshVisibleInspectorForTarget(selectedTarget);
        refreshStatePane();
    }

    private void applyCorridorEditResult(
            DungeonLayoutEditResult result,
            CorridorEditInteractionController.DoorHandle doorHandle,
            CorridorEditInteractionController.WaypointHandle waypointHandle
    ) {
        applyRoomEditResult(result);
        selectedCorridorDoorHandle = doorHandle;
        selectedCorridorWaypointHandle = waypointHandle;
        refreshStatePane();
    }

    private void syncEditorTool() {
        controls.selectTool(editorTool);
        activeToolLabel.setText(editorTool.label());
        workspace.setEditorTool(editorTool);
    }

    private void handleEditFailure(long mapId, String action, Throwable throwable) {
        UiErrorReporter.reportBackgroundFailure(action, throwable);
        clearTransientState();
        refreshMapsAndLayout(mapId);
    }

    private void runEdit(String action, EditCall call) {
        runEdit(action, this::applyRoomEditResult, call);
    }

    private void runEdit(String action, Consumer<DungeonLayoutEditResult> onSuccess, EditCall call) {
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
        DungeonCorridor corridor = DungeonInspectorPresenter.findCorridor(currentLayout, corridorId);
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
        resetCorridorDoorButton.setOnAction(event -> resetSelectedCorridorDoor());
        deleteCorridorWaypointButton.setOnAction(event -> deleteSelectedCorridorWaypoint());
        statePane.getChildren().addAll(
                card("Werkzeug", activeToolLabel),
                card("Korridor", corridorEditSelectionLabel, resetCorridorDoorButton, deleteCorridorWaypointButton));
        refreshStatePane();
    }

    private void refreshMapsAndLayout(Long preferredMapId) {
        refreshMapsAndLayout(preferredMapId, this::showLoadState);
    }

    private void refreshMapsAndLayout(Long preferredMapId, Consumer<DungeonEditorLoadState> onSuccess) {
        editSequence.incrementAndGet();
        long request = loadSequence.incrementAndGet();
        UiAsyncTasks.submit(mapCatalogService::getAllMaps,
                maps -> handleMapsLoaded(request, maps, preferredMapId, onSuccess),
                throwable -> deliverLoadFailure(request, throwable));
    }

    private void handleMapsLoaded(
            long request,
            List<DungeonMap> maps,
            Long preferredMapId,
            Consumer<DungeonEditorLoadState> onSuccess
    ) {
        if (request != loadSequence.get()) {
            return;
        }
        if (maps.isEmpty()) {
            activeMapId = null;
            onSuccess.accept(DungeonEditorLoadState.empty(maps));
            return;
        }
        Long selectedMapId = resolveMapSelection(maps, preferredMapId);
        activeMapId = selectedMapId;
        UiAsyncTasks.submit(() -> editorService.loadLayout(selectedMapId),
                layout -> {
                    if (request != loadSequence.get()) {
                        return;
                    }
                    activeMapId = selectedMapId;
                    onSuccess.accept(new DungeonEditorLoadState(maps, selectedMapId, layout));
                },
                throwable -> deliverLoadFailure(request, throwable));
    }

    private void deliverLoadFailure(long request, Throwable throwable) {
        if (request == loadSequence.get()) {
            handleLoadFailure(throwable);
        }
    }

    private void submitEdit(
            long mapId,
            Callable<DungeonLayoutEditResult> work,
            Consumer<DungeonLayoutEditResult> onSuccess,
            Consumer<Throwable> onError
    ) {
        activeMapId = mapId;
        long request = editSequence.incrementAndGet();
        UiAsyncTasks.submit(work,
                result -> {
                    if (isCurrentEdit(mapId, request)) {
                        onSuccess.accept(result);
                    }
                },
                throwable -> {
                    if (isCurrentEdit(mapId, request)) {
                        onError.accept(throwable);
                    }
                });
    }

    private boolean isCurrentEdit(long mapId, long request) {
        return activeMapId != null && activeMapId == mapId && editSequence.get() == request;
    }

    private void clearTransientState() {
        pendingCorridorStart = null;
        selectedCorridorDoorHandle = null;
        selectedCorridorWaypointHandle = null;
        refreshStatePane();
    }

    private static Long resolveMapSelection(List<DungeonMap> maps, Long preferredMapId) {
        if (preferredMapId != null) {
            for (DungeonMap map : maps) {
                if (preferredMapId.equals(map.mapId())) {
                    return preferredMapId;
                }
            }
        }
        return maps.get(0).mapId();
    }

    private void selectCorridorTargetSelection(DungeonCorridorEndpoint target) {
        if (target instanceof DungeonCorridorEndpoint.Room roomEndpoint) {
            DungeonRoomCluster cluster = currentLayout.clusterForRoom(roomEndpoint.roomId());
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
        if (target == null || currentLayout == null) {
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
                && editorTool == DungeonEditorTool.CORRIDOR_CREATE
                && currentMapId != null;
    }

    private boolean shouldHandleCorridorAsEndpoint(DungeonCorridor corridor) {
        return corridor != null
                && corridor.corridorId() != null
                && editorTool == DungeonEditorTool.CORRIDOR_CREATE
                && currentMapId != null;
    }

    private void showTarget(DungeonSelection target, boolean publishInspector) {
        if (target == null) {
            selectedTarget = null;
            selectedCorridorDoorHandle = null;
            selectedCorridorWaypointHandle = null;
            renderSelection();
            return;
        }
        if (currentLayout == null) {
            return;
        }
        if (target instanceof DungeonSelection.RoomCluster cluster) {
            showSelectedCluster(DungeonInspectorPresenter.findCluster(currentLayout, cluster.clusterId()), publishInspector);
            return;
        }
        if (target instanceof DungeonSelection.Corridor corridor) {
            selectCorridor(DungeonInspectorPresenter.findCorridor(currentLayout, corridor.corridorId()), publishInspector);
        }
    }

    private void publishInspectorForTarget(DungeonSelection target) {
        if (target == null || currentLayout == null) {
            return;
        }
        if (target instanceof DungeonSelection.RoomCluster clusterSelection) {
            DungeonRoomCluster cluster = DungeonInspectorPresenter.findCluster(currentLayout, clusterSelection.clusterId());
            DungeonRoomClusterSummary summary = DungeonInspectorPresenter.clusterSummary(currentLayout, cluster, false);
            if (summary != null) {
                detailsNavigator.showDungeonRoomCluster(summary);
            }
            return;
        }
        if (target instanceof DungeonSelection.Corridor corridorSelection) {
            DungeonCorridor corridor = DungeonInspectorPresenter.findCorridor(currentLayout, corridorSelection.corridorId());
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
        selectedCorridorDoorHandle = null;
        selectedCorridorWaypointHandle = null;
        if (publishInspector) {
            DungeonRoomClusterSummary summary = DungeonInspectorPresenter.clusterSummary(currentLayout, cluster, false);
            if (summary != null) {
                detailsNavigator.showDungeonRoomCluster(summary);
            }
        }
        renderSelection();
    }

    private void resetSelectedCorridorDoor() {
        if (currentMapId == null || selectedCorridorDoorHandle == null) {
            return;
        }
        CorridorEditInteractionController.DoorHandle handle = selectedCorridorDoorHandle;
        runEdit("DungeonEditorView.resetCorridorDoor()",
                result -> applyCorridorEditResult(result, null, null),
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
        CorridorEditInteractionController.WaypointHandle handle = selectedCorridorWaypointHandle;
        runEdit("DungeonEditorView.deleteCorridorWaypoint()",
                result -> applyCorridorEditResult(result, null, null),
                (mapId, onSuccess, onError) -> submitEdit(
                        mapId,
                        () -> editorService.deleteCorridorWaypoint(mapId, handle.corridorId(), handle.waypointIndex()),
                        onSuccess,
                        onError));
    }

    private void refreshStatePane() {
        DungeonCorridor selectedCorridor = selectedTarget instanceof DungeonSelection.Corridor corridorSelection && currentLayout != null
                ? currentLayout.corridorById(corridorSelection.corridorId())
                : null;
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

    @FunctionalInterface
    private interface EditCall {
        void run(long mapId, Consumer<DungeonLayoutEditResult> onSuccess, Consumer<Throwable> onError);
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
}
