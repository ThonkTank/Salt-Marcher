package features.world.dungeonmap.ui.concept.workflow;

import features.world.dungeonmap.model.domain.DungeonConceptLevel;
import features.world.dungeonmap.model.domain.DungeonConceptNodePosition;
import features.world.dungeonmap.model.domain.DungeonConceptNodeType;
import features.world.dungeonmap.model.domain.DungeonMap;
import features.world.dungeonmap.model.projection.DungeonConceptCanvasNode;
import features.world.dungeonmap.model.projection.DungeonConceptState;
import features.world.dungeonmap.model.projection.DungeonMapState;
import features.world.dungeonmap.service.DungeonConceptCommandService;
import features.world.dungeonmap.service.DungeonConceptQueryService;
import features.world.dungeonmap.service.DungeonMapCommandService;
import features.world.dungeonmap.service.DungeonMapQueryService;
import features.world.dungeonmap.ui.concept.canvas.DungeonConceptPane;
import features.world.dungeonmap.ui.concept.chrome.DungeonConceptStatePane;
import features.world.dungeonmap.ui.concept.state.DungeonConceptEditorState;
import features.world.dungeonmap.ui.concept.state.DungeonConceptLevelMetrics;
import features.world.dungeonmap.ui.concept.state.DungeonConceptSelection;
import features.world.dungeonmap.ui.concept.state.DungeonConceptTool;
import features.world.dungeonmap.ui.shared.async.DungeonUiAsyncSupport;
import features.world.dungeonmap.ui.shared.format.DungeonConceptTransitionText;
import features.world.dungeonmap.ui.shared.map.DungeonMapControlsPane;
import features.world.dungeonmap.ui.shared.map.DungeonMapDropdownPresenter;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import shared.rules.service.AdventuringDayProgressCalculator;
import shared.rules.service.XpCalculator;
import ui.async.UiErrorReporter;
import ui.shell.DetailsNavigator;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class DungeonConceptController {

    private final DungeonConceptEditorState state;
    private final DungeonMapControlsPane mapControls;
    private final DungeonConceptPane pane;
    private final DungeonConceptStatePane statePane;
    private final DungeonMapQueryService mapQueries;
    private final DungeonMapCommandService mapCommands;
    private final DungeonConceptQueryService conceptQueries;
    private final DungeonConceptCommandService conceptCommands;
    private final DetailsNavigator detailsNavigator;
    private final DungeonMapDropdownPresenter mapDropdownPresenter = new DungeonMapDropdownPresenter();

    public DungeonConceptController(
            DungeonConceptEditorState state,
            DungeonMapControlsPane mapControls,
            DungeonConceptPane pane,
            DungeonConceptStatePane statePane,
            DungeonMapQueryService mapQueries,
            DungeonMapCommandService mapCommands,
            DungeonConceptQueryService conceptQueries,
            DungeonConceptCommandService conceptCommands,
            DetailsNavigator detailsNavigator
    ) {
        this.state = state;
        this.mapControls = mapControls;
        this.pane = pane;
        this.statePane = statePane;
        this.mapQueries = mapQueries;
        this.mapCommands = mapCommands;
        this.conceptQueries = conceptQueries;
        this.conceptCommands = conceptCommands;
        this.detailsNavigator = detailsNavigator;
    }

    public void onShow() {
        loadMapList();
    }

    public void handleMapSelected(Long mapId) {
        ensureInitializedAndLoadConceptState(mapId);
    }

    public void showNewMapDropdown(Node anchor) {
        mapDropdownPresenter.showNewMapDropdown(anchor, result -> DungeonUiAsyncSupport.submitValue(
                () -> mapCommands.createMap(result.name(), result.width(), result.height()),
                mapId -> {
                    state.setCurrentMapId(mapId);
                    loadMapList();
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConceptController.createMap()", ex)));
    }

    public void showEditMapDropdown(DungeonMapControlsPane.MapActionRequest request) {
        if (request == null || request.map() == null || request.anchor() == null) {
            return;
        }
        DungeonUiAsyncSupport.submitValue(
                () -> mapQueries.loadMapState(request.map().mapId()),
                currentState -> showEditMapDropdown(request, currentState),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConceptController.loadMapEditState()", ex));
    }

    public void handleLevelCountChanged(int levelCount) {
        Long mapId = state.currentMapId();
        if (mapId == null) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> conceptCommands.updateLevelCount(mapId, levelCount),
                this::reloadCurrentMap,
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConceptController.updateLevelCount()", ex));
    }

    public void handleActiveLevelSelected(Long conceptLevelId) {
        state.setActiveLevelId(conceptLevelId);
        clearSelection();
        refreshStatePane();
        showActiveLevelInspector(false);
        pane.loadState(state.currentState(), state.activeLevelId());
    }

    public void handleLevelPlanChanged(DungeonConceptStatePane.LevelPlanUpdate update) {
        if (update == null) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> conceptCommands.updateLevelPlan(
                        update.conceptLevelId(),
                        update.startLevel(),
                        update.endLevel(),
                        update.progressFraction(),
                        update.adventuringDaysTarget(),
                        update.entranceCount(),
                        update.exitCount()),
                this::reloadCurrentMap,
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConceptController.updateLevelPlan()", ex));
    }

    public void handlePartySizeChanged(int partySize) {
        Long mapId = state.currentMapId();
        if (mapId == null) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> conceptCommands.updatePartySize(mapId, partySize),
                this::reloadCurrentMap,
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConceptController.updatePartySize()", ex));
    }

    public void createLevelConnection(Long sourceLevelId, Long targetLevelId) {
        if (sourceLevelId == null || targetLevelId == null) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> conceptCommands.addLevelConnection(sourceLevelId, targetLevelId),
                this::reloadCurrentMap,
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConceptController.createLevelConnection()", ex));
    }

    public void deleteLevelConnection(Long connectionId) {
        if (connectionId == null) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> conceptCommands.removeLevelConnection(connectionId),
                this::reloadCurrentMap,
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConceptController.deleteLevelConnection()", ex));
    }

    public void handleActiveToolChanged(DungeonConceptTool tool) {
        state.setActiveTool(tool);
        pane.setActiveTool(tool);
    }

    public void handleGraphConnectionRequested(DungeonConceptCanvasNode startNode, DungeonConceptCanvasNode targetNode) {
        if (startNode == null || targetNode == null) {
            return;
        }
        if (!Objects.equals(startNode.conceptLevelId(), targetNode.conceptLevelId())) {
            return;
        }
        DungeonConceptState currentState = state.currentState();
        if (currentState != null && currentState.hasCanvasEdge(startNode.conceptLevelId(), startNode.nodeKey(), targetNode.nodeKey())) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> conceptCommands.addGraphEdge(startNode.conceptLevelId(), startNode.nodeKey(), targetNode.nodeKey()),
                this::reloadCurrentMap,
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConceptController.addGraphEdge()", ex));
    }

    public void handleGraphEdgeDeleteRequested(Long edgeId) {
        if (edgeId == null) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> conceptCommands.removeGraphEdge(edgeId),
                this::reloadCurrentMap,
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConceptController.removeGraphEdge()", ex));
    }

    public void handleGraphEdgeSplitRequested(DungeonConceptPane.EdgeSplitRequest request) {
        if (request == null || request.edgeId() == null) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> conceptCommands.splitGraphEdge(request.edgeId(), request.x(), request.y()),
                this::reloadCurrentMap,
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConceptController.splitGraphEdge()", ex));
    }

    public void handleCreateRoomNodeRequested(DungeonConceptPane.RoomCreateRequest request) {
        if (request == null || request.conceptLevelId() == null) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> conceptCommands.createRoomNodeAt(request.conceptLevelId(), request.x(), request.y()),
                this::reloadCurrentMap,
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConceptController.createRoomNodeAt()", ex));
    }

    public void handleNodeDeleteRequested(DungeonConceptCanvasNode node) {
        if (node == null || node.conceptLevelId() == null || node.nodeKey() == null) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> conceptCommands.deleteCanvasNode(node.conceptLevelId(), node.nodeKey()),
                this::reloadCurrentMap,
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConceptController.deleteCanvasNode()", ex));
    }

    public void handleNodeSelected(DungeonConceptCanvasNode node) {
        if (node == null) {
            return;
        }
        state.setActiveLevelId(node.conceptLevelId());
        state.setSelection(DungeonConceptSelection.node(node));
        pane.setSelection(node.nodeKey(), null);
        refreshStatePane();
        showNodeInspector(node, false);
    }

    public void clearSelection() {
        state.setSelection(DungeonConceptSelection.none());
        pane.setSelection(null, null);
        refreshStatePane();
    }

    public void persistNodePositions(List<DungeonConceptPane.NodePosition> positions) {
        if (positions == null || positions.isEmpty() || state.currentState() == null) {
            return;
        }
        List<DungeonConceptNodePosition> updatedPositions = mergeUpdatedPositions(positions);
        if (updatedPositions.isEmpty()) {
            return;
        }
        long saveToken = state.queuedPositionSaveToken() + 1;
        state.setQueuedPositionSave(saveToken, updatedPositions);
        if (!state.positionSaveInFlight()) {
            drainPendingPositionSave();
        }
    }

    public Long currentMapId() {
        return state.currentMapId();
    }

    public void setPreferredMapId(Long mapId) {
        state.setCurrentMapId(mapId);
        mapControls.selectMap(mapId);
    }

    private void loadMapList() {
        DungeonUiAsyncSupport.submitValue(
                mapQueries::getAllMaps,
                maps -> {
                    mapControls.setMaps(maps);
                    Long mapId = resolveMapSelection(maps);
                    if (mapId == null) {
                        mapControls.clearMapSelection();
                        clearLoadedState();
                        return;
                    }
                    mapControls.selectMap(mapId);
                    ensureInitializedAndLoadConceptState(mapId);
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConceptController.loadMapList()", ex));
    }

    private void ensureInitializedAndLoadConceptState(Long mapId) {
        if (mapId == null) {
            clearLoadedState();
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> conceptCommands.ensureInitialized(mapId),
                () -> loadConceptState(mapId),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConceptController.ensureInitialized()", ex));
    }

    private void loadConceptState(Long mapId) {
        if (mapId == null) {
            clearLoadedState();
            return;
        }
        state.setCurrentMapId(mapId);
        long requestToken = state.nextLoadRequestToken();
        DungeonUiAsyncSupport.submitValue(
                () -> conceptQueries.loadConceptState(mapId),
                loadedState -> {
                    if (requestToken == state.loadRequestToken() && Objects.equals(mapId, state.currentMapId())) {
                        applyLoadedState(loadedState);
                    }
                },
                ex -> {
                    if (requestToken == state.loadRequestToken() && Objects.equals(mapId, state.currentMapId())) {
                        clearLoadedState();
                    }
                    UiErrorReporter.reportBackgroundFailure("DungeonConceptController.loadConceptState()", ex);
                });
    }

    private void reloadCurrentMap() {
        Long mapId = state.currentMapId();
        if (mapId == null) {
            clearLoadedState();
            return;
        }
        loadConceptState(mapId);
    }

    private void applyLoadedState(DungeonConceptState loadedState) {
        state.setCurrentState(loadedState);
        state.setActiveLevelId(resolveActiveLevelId(loadedState, state.activeLevelId(), state.selection()));
        refreshSelectionAfterReload();
        pane.setActiveTool(state.activeTool());
        pane.loadState(loadedState, state.activeLevelId());
        pane.setSelection(selectedNodeKey(), null);
        refreshStatePane();
        refreshInspector();
    }

    private Long resolveActiveLevelId(
            DungeonConceptState loadedState,
            Long preferredLevelId,
            DungeonConceptSelection selection
    ) {
        if (loadedState == null || loadedState.levels().isEmpty()) {
            return null;
        }
        if (selection != null && selection.node() != null) {
            Long selectedLevelId = selection.node().conceptLevelId();
            if (loadedState.findLevel(selectedLevelId) != null) {
                return selectedLevelId;
            }
        }
        if (selection != null && selection.edge() != null) {
            Long selectedLevelId = selection.edge().conceptLevelId();
            if (loadedState.findLevel(selectedLevelId) != null) {
                return selectedLevelId;
            }
        }
        if (preferredLevelId != null && loadedState.findLevel(preferredLevelId) != null) {
            return preferredLevelId;
        }
        return loadedState.levels().get(0).conceptLevelId();
    }

    private void refreshSelectionAfterReload() {
        if (state.currentState() == null || state.selection() == null) {
            state.setSelection(DungeonConceptSelection.none());
            return;
        }
        if (state.selection().node() != null) {
            DungeonConceptCanvasNode updatedNode = state.currentState().findNode(
                    state.selection().node().nodeKey(),
                    state.selection().node().conceptLevelId());
            if (updatedNode == null) {
                state.setSelection(DungeonConceptSelection.none());
                return;
            }
            state.setSelection(DungeonConceptSelection.node(updatedNode));
            return;
        }
        state.setSelection(DungeonConceptSelection.none());
    }

    private void clearLoadedState() {
        state.setCurrentMapId(null);
        state.setCurrentState(null);
        state.setActiveLevelId(null);
        state.setSelection(DungeonConceptSelection.none());
        mapControls.clearMapSelection();
        pane.loadState(null, null);
        refreshStatePane();
    }

    private void refreshStatePane() {
        statePane.showState(state.currentState(), state.activeLevelId(), computeMetricsByLevel());
    }

    private DungeonConceptLevelMetrics computeMetrics(DungeonConceptLevel level) {
        DungeonConceptState currentState = state.currentState();
        if (level == null || currentState == null || currentState.partyProfile() == null) {
            return DungeonConceptLevelMetrics.empty();
        }
        int partySize = Math.max(1, currentState.partyProfile().partySize());
        int endBoundaryLevel = Math.min(20, level.endLevel() == 20 ? 20 : level.endLevel() + 1);
        int fullSpanPerCharacterXp = Math.max(0, XpCalculator.xpAtLevel(endBoundaryLevel) - XpCalculator.xpAtLevel(level.startLevel()));
        int fullSpanGroupXp = fullSpanPerCharacterXp * partySize;
        int progressTargetGroupXp = (int) Math.round(fullSpanGroupXp * Math.max(0.0, level.progressFraction()));

        List<Integer> partyLevels = new ArrayList<>();
        for (int index = 0; index < partySize; index++) {
            partyLevels.add(level.startLevel());
        }
        AdventuringDayProgressCalculator.AdventuringDayProgressReport report =
                AdventuringDayProgressCalculator.compute(partyLevels, progressTargetGroupXp);
        int daysTargetGroupXp = (int) Math.round(XpCalculator.computeAdventuringDayBudget(partyLevels).totalXp()
                * Math.max(0.0, level.adventuringDaysTarget()));
        double daysTargetFraction = fullSpanGroupXp == 0 ? 0.0 : daysTargetGroupXp / (double) fullSpanGroupXp;

        return new DungeonConceptLevelMetrics(
                fullSpanGroupXp,
                progressTargetGroupXp,
                report.totalDays(),
                daysTargetGroupXp,
                daysTargetFraction);
    }

    private Map<Long, DungeonConceptLevelMetrics> computeMetricsByLevel() {
        DungeonConceptState currentState = state.currentState();
        if (currentState == null || currentState.levels() == null || currentState.levels().isEmpty()) {
            return Map.of();
        }
        Map<Long, DungeonConceptLevelMetrics> result = new LinkedHashMap<>();
        for (DungeonConceptLevel level : currentState.levels()) {
            result.put(level.conceptLevelId(), computeMetrics(level));
        }
        return result;
    }

    private List<DungeonConceptNodePosition> mergeUpdatedPositions(List<DungeonConceptPane.NodePosition> positions) {
        DungeonConceptState currentState = state.currentState();
        if (currentState == null) {
            return List.of();
        }
        Map<String, DungeonConceptCanvasNode> updatedByKey = currentState.nodesByKey();
        List<DungeonConceptNodePosition> positionsToSave = new ArrayList<>();
        boolean changed = false;
        for (DungeonConceptPane.NodePosition position : positions) {
            String compositeKey = position.conceptLevelId() + ":" + position.nodeKey();
            DungeonConceptCanvasNode existing = updatedByKey.get(compositeKey);
            if (existing == null) {
                continue;
            }
            DungeonConceptCanvasNode updatedNode = existing.withPosition(position.x(), position.y());
            if (updatedNode.equals(existing)) {
                continue;
            }
            updatedByKey.put(compositeKey, updatedNode);
            positionsToSave.add(new DungeonConceptNodePosition(
                    null,
                    currentState.map().mapId(),
                    position.conceptLevelId(),
                    position.nodeKey(),
                    position.nodeType(),
                    position.externalNodeIndex(),
                    position.connectionId(),
                    position.x(),
                    position.y()));
            changed = true;
        }
        if (!changed) {
            return List.of();
        }
        state.setCurrentState(currentState.withCanvasNodes(new ArrayList<>(updatedByKey.values())));
        if (state.selection() != null && state.selection().node() != null) {
            DungeonConceptCanvasNode updatedNode = state.currentState().findNode(
                    state.selection().node().nodeKey(),
                    state.selection().node().conceptLevelId());
            if (updatedNode != null) {
                state.setSelection(DungeonConceptSelection.node(updatedNode));
            }
        }
        refreshStatePane();
        refreshInspector();
        return positionsToSave;
    }

    private void drainPendingPositionSave() {
        if (state.positionSaveInFlight() || state.queuedPositionSaveNodes().isEmpty()) {
            return;
        }
        long saveToken = state.queuedPositionSaveToken();
        List<DungeonConceptNodePosition> nodesToSave = state.queuedPositionSaveNodes();
        state.setPositionSaveInFlight(true);
        DungeonUiAsyncSupport.submitAction(
                () -> conceptCommands.updateNodePositions(nodesToSave),
                () -> onPositionSaveFinished(saveToken),
                ex -> {
                    state.setPositionSaveInFlight(false);
                    UiErrorReporter.reportBackgroundFailure("DungeonConceptController.updateNodePositions()", ex);
                    if (state.queuedPositionSaveToken() > saveToken) {
                        drainPendingPositionSave();
                    }
                });
    }

    private void onPositionSaveFinished(long saveToken) {
        state.setPositionSaveInFlight(false);
        if (state.queuedPositionSaveToken() > saveToken) {
            drainPendingPositionSave();
            return;
        }
        state.setQueuedPositionSave(saveToken, List.of());
    }

    private void refreshInspector() {
        if (detailsNavigator == null) {
            return;
        }
        if (state.selection() != null && state.selection().node() != null) {
            showNodeInspector(state.selection().node(), true);
            return;
        }
        showActiveLevelInspector(true);
    }

    private void showActiveLevelInspector(boolean refreshOnlyIfVisible) {
        DungeonConceptLevel level = activeLevel();
        if (level == null || detailsNavigator == null) {
            return;
        }
        String entryKey = "dungeon-concept-level:" + level.conceptLevelId();
        if (refreshOnlyIfVisible && !detailsNavigator.isShowing(entryKey)) {
            return;
        }
        DungeonConceptLevelMetrics metrics = computeMetrics(level);
        detailsNavigator.showContent(level.displayName(), entryKey, () -> {
            VBox box = new VBox(6);
            box.getChildren().addAll(
                    new Label("Ziellevel: " + level.startLevel() + " bis " + level.endLevel()),
                    new Label("Fortschritt: " + formatDecimal(level.progressFraction()) + " Ebenenspannen"),
                    new Label("Adventuring Days: " + formatDecimal(level.adventuringDaysTarget())),
                    new Label("Eingänge: " + level.entranceCount()),
                    new Label("Voller Bogen: " + metrics.fullSpanGroupXp() + " Gruppen-XP"));
            return box;
        });
    }

    private void showNodeInspector(DungeonConceptCanvasNode node, boolean refreshOnlyIfVisible) {
        if (node == null || detailsNavigator == null) {
            return;
        }
        String entryKey = "dungeon-concept-node:" + node.conceptLevelId() + ":" + node.nodeKey();
        if (refreshOnlyIfVisible && !detailsNavigator.isShowing(entryKey)) {
            return;
        }
        DungeonConceptLevel targetLevel = node.targetLevelId() == null || state.currentState() == null
                ? null
                : state.currentState().findLevel(node.targetLevelId());
        detailsNavigator.showContent(DungeonConceptTransitionText.nodeLabel(node), entryKey, () -> {
            VBox box = new VBox(6);
            box.getChildren().addAll(
                    new Label("Typ: " + node.nodeType().label()),
                    new Label("Position: " + Math.round(node.x()) + " / " + Math.round(node.y())));
            if (node.nodeType() == DungeonConceptNodeType.ROOM && node.roomId() != null) {
                var room = state.currentState() == null ? null : state.currentState().findRoom(node.roomId());
                if (room != null) {
                    box.getChildren().add(new Label("Raum-ID: " + room.roomId()));
                }
            }
            if (node.nodeType() == DungeonConceptNodeType.LEVEL_TRANSITION) {
                box.getChildren().add(new Label("Ziel: " + transitionTargetLabel(node, targetLevel)));
            }
            return box;
        });
    }

    private String transitionTargetLabel(DungeonConceptCanvasNode node, DungeonConceptLevel targetLevel) {
        return DungeonConceptTransitionText.targetChipLabel(
                targetLevel == null ? null : targetLevel.displayName(),
                node.transitionVariantIndex(),
                node.transitionVariantCount());
    }

    private Long resolveMapSelection(List<DungeonMap> maps) {
        Long currentMapId = state.currentMapId();
        if (currentMapId != null) {
            for (DungeonMap map : maps) {
                if (Objects.equals(currentMapId, map.mapId())) {
                    return currentMapId;
                }
            }
        }
        return maps.isEmpty() ? null : maps.get(0).mapId();
    }

    private DungeonConceptLevel activeLevel() {
        return state.currentState() == null ? null : state.currentState().findLevel(state.activeLevelId());
    }

    private void showEditMapDropdown(DungeonMapControlsPane.MapActionRequest request, DungeonMapState currentState) {
        mapDropdownPresenter.showEditMapDropdown(
                request.anchor(),
                request.map(),
                currentState,
                result -> DungeonUiAsyncSupport.submitAction(
                        () -> mapCommands.updateMap(request.map().mapId(), result.name(), result.width(), result.height()),
                        this::loadMapList,
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonConceptController.updateMap()", ex)),
                () -> DungeonUiAsyncSupport.submitAction(
                        () -> mapCommands.deleteMap(request.map().mapId()),
                        () -> {
                            if (Objects.equals(state.currentMapId(), request.map().mapId())) {
                                state.setCurrentMapId(null);
                            }
                            loadMapList();
                        },
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonConceptController.deleteMap()", ex)));
    }

    private String selectedNodeKey() {
        return state.selection() == null || state.selection().node() == null ? null : state.selection().node().nodeKey();
    }

    private static String formatDecimal(double value) {
        return String.format(java.util.Locale.GERMANY, "%.2f", value);
    }
}
