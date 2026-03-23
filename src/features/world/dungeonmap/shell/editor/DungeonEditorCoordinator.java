package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.application.corridor.DungeonCorridorEditService;
import features.world.dungeonmap.application.stair.DungeonStairEditService;
import features.world.dungeonmap.application.transition.DungeonTransitionEditRequest;
import features.world.dungeonmap.application.transition.DungeonTransitionEditService;
import features.world.dungeonmap.application.transition.DungeonTransitionTargetCatalogService;
import features.world.dungeonmap.application.transition.DungeonTransitionTargetSummary;
import features.world.dungeonmap.application.room.DungeonBoundaryEditService;
import features.world.dungeonmap.application.room.DungeonClusterMoveService;
import features.world.dungeonmap.application.room.DungeonRoomNarrationService;
import features.world.dungeonmap.application.room.DungeonRoomTopologyService;
import features.world.dungeonmap.application.room.RoomExitCatalog;
import features.world.dungeonmap.canvas.base.DungeonCanvasWorkspace;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.dungeonmap.loading.DungeonMapCatalogEntry;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.room.RoomNarration;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.shell.editor.interaction.CorridorInteractionController;
import features.world.dungeonmap.shell.editor.interaction.BoundaryInteractionController;
import features.world.dungeonmap.shell.editor.interaction.ClusterSelectionDragController;
import features.world.dungeonmap.shell.editor.interaction.DungeonEditorGridInteractionController;
import features.world.dungeonmap.shell.editor.interaction.RoomPaintInteractionController;
import features.world.dungeonmap.shell.editor.interaction.StairInteractionController;
import features.world.dungeonmap.shell.editor.interaction.TransitionInteractionController;
import features.world.dungeonmap.state.DungeonCorridorDraftState;
import features.world.dungeonmap.state.EditorLayoutPreviewState;
import features.world.dungeonmap.state.EditorPaintPreviewState;
import features.world.dungeonmap.state.EditorSelectionState;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.DungeonStairDraftState;
import features.world.dungeonmap.state.DungeonTransitionDraftState;
import features.world.api.OverworldTransitionTargetSummary;
import features.world.api.WorldReadApi;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;

final class DungeonEditorCoordinator {

    private final DungeonEditorControls controls;
    private final DungeonEditorStatePane statePane;
    private final DungeonCanvasWorkspace workspace;
    private final DungeonMapLoadingService loadingService;
    private final DungeonMapState mapState;
    private final DungeonEditorSessionState sessionState;
    private final DungeonRoomNarrationService roomNarrationService;
    private final DungeonMapDropdownController mapDropdownController;
    private final DungeonTransitionTargetCatalogService transitionTargetCatalogService = new DungeonTransitionTargetCatalogService();
    private final EditorSelectionState selectionState = new EditorSelectionState();
    private final EditorLayoutPreviewState layoutPreviewState = new EditorLayoutPreviewState();
    private final EditorPaintPreviewState paintPreviewState = new EditorPaintPreviewState();
    private final DungeonCorridorDraftState corridorDraftState = new DungeonCorridorDraftState();
    private final DungeonStairDraftState stairDraftState = new DungeonStairDraftState();
    private final DungeonTransitionDraftState transitionDraftState = new DungeonTransitionDraftState();
    private final DungeonStairEditService stairEditService;
    private final StairInteractionController stairInteractionController;
    private final TransitionInteractionController transitionInteractionController;
    private final DungeonEditorGridInteractionController interactionController;
    private List<DungeonTransitionTargetSummary> targetTransitions = List.of();
    private List<OverworldTransitionTargetSummary> overworldTargets = List.of();
    private Long loadedTargetTransitionMapId;
    private boolean overworldTargetsLoaded;
    private long targetTransitionRequestSequence;
    private long overworldTargetRequestSequence;
    private DungeonEditorTool previousTool = DungeonEditorTool.SELECT;
    private Long previousMapId;

    DungeonEditorCoordinator(
            DungeonEditorControls controls,
            DungeonEditorStatePane statePane,
            DungeonCanvasWorkspace workspace,
            DungeonMapLoadingService loadingService,
            DungeonMapState mapState,
            DungeonEditorSessionState sessionState,
            DungeonMapCatalogService mapCatalogService,
            DungeonRoomTopologyService roomTopologyService,
            DungeonBoundaryEditService boundaryEditService,
            DungeonRoomNarrationService roomNarrationService,
            DungeonClusterMoveService clusterMoveService,
            DungeonCorridorEditService corridorEditService,
            DungeonStairEditService stairEditService,
            DungeonTransitionEditService transitionEditService
    ) {
        this.controls = Objects.requireNonNull(controls, "controls");
        this.statePane = Objects.requireNonNull(statePane, "statePane");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.roomNarrationService = Objects.requireNonNull(roomNarrationService, "roomNarrationService");
        this.stairEditService = Objects.requireNonNull(stairEditService, "stairEditService");
        ClusterSelectionDragController clusterSelectionDragController = new ClusterSelectionDragController(
                mapState,
                loadingService,
                selectionState,
                layoutPreviewState,
                Objects.requireNonNull(clusterMoveService, "clusterMoveService"));
        RoomPaintInteractionController roomPaintInteractionController = new RoomPaintInteractionController(
                mapState,
                loadingService,
                sessionState,
                selectionState,
                paintPreviewState,
                Objects.requireNonNull(roomTopologyService, "roomTopologyService"));
        CorridorInteractionController corridorInteractionController = new CorridorInteractionController(
                mapState,
                loadingService,
                sessionState,
                selectionState,
                corridorDraftState,
                Objects.requireNonNull(corridorEditService, "corridorEditService"));
        BoundaryInteractionController boundaryInteractionController = new BoundaryInteractionController(
                mapState,
                loadingService,
                sessionState,
                selectionState,
                Objects.requireNonNull(boundaryEditService, "boundaryEditService"));
        this.stairInteractionController = new StairInteractionController(
                mapState,
                loadingService,
                sessionState,
                selectionState,
                stairDraftState,
                this.stairEditService);
        this.transitionInteractionController = new TransitionInteractionController(
                mapState,
                loadingService,
                sessionState,
                selectionState,
                transitionDraftState,
                Objects.requireNonNull(transitionEditService, "transitionEditService"));
        this.interactionController = new DungeonEditorGridInteractionController(
                mapState,
                sessionState,
                clusterSelectionDragController,
                roomPaintInteractionController,
                corridorInteractionController,
                boundaryInteractionController,
                this.stairInteractionController,
                this.transitionInteractionController);
        this.mapDropdownController = new DungeonMapDropdownController(
                Objects.requireNonNull(mapCatalogService, "mapCatalogService"),
                new MapReloadHandle());
        installBindings();
        sessionState.addListener(this::refreshFromSessionState);
        selectionState.addListener(this::refreshSelectionState);
        selectionState.addListener(this::refreshCorridorStatePane);
        selectionState.addListener(this::refreshStairStatePane);
        selectionState.addListener(this::refreshRoomNarrationStatePane);
        selectionState.addListener(this::refreshTransitionStatePane);
        layoutPreviewState.addListener(this::refreshLayoutPreviewState);
        paintPreviewState.addListener(this::refreshPaintPreviewState);
        corridorDraftState.addListener(this::refreshCorridorStatePane);
        stairDraftState.addListener(this::refreshStairStatePane);
        transitionDraftState.addListener(this::refreshTransitionStatePane);
        transitionDraftState.addListener(this::refreshTransitionTargetOptions);
        refreshFromSessionState();
        refreshSelectionState();
        refreshLayoutPreviewState();
        refreshPaintPreviewState();
        refreshCorridorStatePane();
        refreshStairStatePane();
        refreshTransitionStatePane();
        refreshTransitionTargetOptions();
        refreshRoomNarrationStatePane();
    }

    void refreshFromMapState() {
        boolean mapChanged = !Objects.equals(previousMapId, mapState.activeMapId());
        controls.showMaps(mapState.maps(), mapState.activeMapId(), mapState.loading());
        controls.showLevels(
                mapState.activeMap().reachableLevels(),
                mapState.activeProjectionLevel(),
                mapState.loading(),
                mapState.activeMapId() != null);
        controls.showOverlaySettings(mapState.levelOverlaySettings(), mapState.loading());
        workspace.setProjectionLevel(mapState.activeProjectionLevel());
        if (mapChanged && sessionState.selectedTool() == DungeonEditorTool.STAIR_CREATE) {
            stairDraftState.resetForLevel(mapState.activeProjectionLevel());
        }
        if (mapChanged) {
            loadedTargetTransitionMapId = null;
            targetTransitions = List.of();
        }
        refreshFromSessionState();
        refreshRoomNarrationStatePane();
        previousMapId = mapState.activeMapId();
    }

    private void installBindings() {
        controls.setOnMapSelected(this::loadSelectedMap);
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
        statePane.setOnStairInputLevelChanged(stairDraftState::setInputLevel);
        statePane.setOnStairLevelDecrementRequested(() -> stairDraftState.adjustInputLevel(-1));
        statePane.setOnStairLevelIncrementRequested(() -> stairDraftState.adjustInputLevel(1));
        statePane.setOnStairAddRequested(stairDraftState::addExitLevel);
        statePane.setOnStairExitRemoveRequested(stairDraftState::removeExitLevel);
        statePane.setOnTransitionNameChanged(transitionDraftState::setName);
        statePane.setOnTransitionDestinationTypeChanged(transitionDraftState::setDestinationType);
        statePane.setOnTransitionBidirectionalChanged(transitionDraftState::setBidirectional);
        statePane.setOnTransitionTargetMapChanged(transitionDraftState::setTargetDungeonMapId);
        statePane.setOnTransitionTargetTransitionChanged(transitionDraftState::setTargetTransitionId);
        statePane.setOnTransitionTargetOverworldChanged(target ->
                transitionDraftState.setOverworldTarget(
                        target == null ? null : target.mapId(),
                        target == null ? null : target.tileId()));
        statePane.setOnPreparedTransitionSelected(transitionDraftState::setPreparedTransitionId);
        workspace.setInteractionHandler(interactionController);
    }

    private void refreshFromSessionState() {
        DungeonEditorTool selectedTool = sessionState.selectedTool();
        boolean enteringStairCreate = selectedTool == DungeonEditorTool.STAIR_CREATE
                && previousTool != DungeonEditorTool.STAIR_CREATE;
        controls.selectViewMode(sessionState.viewMode());
        controls.showDisplayedTool(selectedTool);
        workspace.setViewMode(sessionState.viewMode());
        if (selectedTool != DungeonEditorTool.SELECT || sessionState.viewMode() != features.world.dungeonmap.canvas.base.DungeonViewMode.GRID) {
            interactionController.clear();
        }
        if (enteringStairCreate) {
            stairDraftState.resetForLevel(mapState.activeProjectionLevel());
        }
        statePane.refresh(selectedTool);
        refreshCorridorStatePane();
        refreshStairStatePane();
        refreshTransitionStatePane();
        refreshTransitionTargetOptions();
        previousTool = selectedTool;
    }

    private void refreshLayoutPreviewState() {
        workspace.setPreviewMapModel(layoutPreviewState.previewMap());
    }

    private void refreshPaintPreviewState() {
        workspace.setPreviewPaintShape(paintPreviewState.previewShape(), paintPreviewState.deleteMode());
    }

    private void refreshSelectionState() {
        workspace.setSelectedTargetKey(selectionState.selectedTargetKey());
    }

    private void refreshCorridorStatePane() {
        if (corridorDraftState.hasPendingStart()) {
            statePane.showCorridorStatus("Start gewählt, Zielraum anklicken");
            return;
        }
        String selectedTargetKey = selectionState.selectedTargetKey();
        if (Corridor.isTargetKey(selectedTargetKey)) {
            statePane.showCorridorStatus("Gewählt: " + DungeonEditorSelectionLabels.corridorLabel(selectedTargetKey));
            return;
        }
        statePane.showCorridorStatus(null);
    }

    private void refreshStairStatePane() {
        if (sessionState.selectedTool() != DungeonEditorTool.STAIR_CREATE
                && sessionState.selectedTool() != DungeonEditorTool.STAIR_DELETE
                && !DungeonStair.isTargetKey(selectionState.selectedTargetKey())) {
            statePane.showStairDraft(null);
            return;
        }
        if (sessionState.selectedTool() == DungeonEditorTool.STAIR_DELETE) {
            String selectedTargetKey = selectionState.selectedTargetKey();
            String summary = DungeonStair.isTargetKey(selectedTargetKey)
                    ? "Gewählt: " + DungeonEditorSelectionLabels.stairLabel(selectedTargetKey)
                    : "Treppenfeld anklicken, um zu löschen";
            statePane.showStairDraft(
                    new DungeonEditorStatePane.StairDraftCard(null, List.of(), summary, false));
            return;
        }
        statePane.showStairDraft(
                new DungeonEditorStatePane.StairDraftCard(
                        stairDraftState.inputLevel(),
                        stairDraftState.exitLevels(),
                        stairDraftState.displayStatus(),
                        true));
    }

    private void refreshTransitionStatePane() {
        if (sessionState.selectedTool() != DungeonEditorTool.TRANSITION_CREATE
                && sessionState.selectedTool() != DungeonEditorTool.TRANSITION_DELETE
                && !DungeonTransition.isTargetKey(selectionState.selectedTargetKey())) {
            statePane.showTransitionDraft(null);
            return;
        }
        if (sessionState.selectedTool() == DungeonEditorTool.TRANSITION_DELETE) {
            String selectedTargetKey = selectionState.selectedTargetKey();
            String summary = DungeonTransition.isTargetKey(selectedTargetKey)
                    ? "Gewählt: " + DungeonEditorSelectionLabels.transitionLabel(selectedTargetKey)
                    : "Übergangsfeld anklicken, um zu löschen";
            statePane.showTransitionDraft(new DungeonEditorStatePane.TransitionDraftCard(
                    transitionDraftState.name(),
                    transitionDraftState.destinationType(),
                    transitionDraftState.bidirectional(),
                    transitionDraftState.targetDungeonMapId(),
                    transitionDraftState.targetTransitionId(),
                    transitionDraftState.targetOverworldMapId(),
                    transitionDraftState.targetOverworldTileId(),
                    transitionDraftState.preparedTransitionId(),
                    mapState.maps(),
                    targetTransitions,
                    overworldTargets,
                    preparedTransitionCards(),
                    summary,
                    summary));
            return;
        }
        statePane.showTransitionDraft(new DungeonEditorStatePane.TransitionDraftCard(
                transitionDraftState.name(),
                transitionDraftState.destinationType(),
                transitionDraftState.bidirectional(),
                transitionDraftState.targetDungeonMapId(),
                transitionDraftState.targetTransitionId(),
                transitionDraftState.targetOverworldMapId(),
                transitionDraftState.targetOverworldTileId(),
                transitionDraftState.preparedTransitionId(),
                targetMapChoices(),
                targetTransitions,
                overworldTargets,
                preparedTransitionCards(),
                transitionSummary(),
                transitionDraftState.displayStatus()));
    }

    private void refreshRoomNarrationStatePane() {
        RoomCluster cluster = selectedCluster();
        if (cluster == null) {
            statePane.showRoomNarrationEditors(List.of(), this::saveRoomNarration);
            return;
        }
        statePane.showRoomNarrationEditors(cluster.rooms().stream()
                .filter(Objects::nonNull)
                .sorted(Comparator
                        .comparing(Room::name, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                        .thenComparing(Room::roomId, Comparator.nullsLast(Long::compareTo)))
                .map(this::roomNarrationCard)
                .toList(), this::saveRoomNarration);
    }

    private DungeonEditorStatePane.RoomNarrationCard roomNarrationCard(Room room) {
        return new DungeonEditorStatePane.RoomNarrationCard(
                room.roomId() == null ? 0L : room.roomId(),
                room.name(),
                room.narration().visualDescription(),
                RoomExitCatalog.describe(room).stream()
                        .map(exit -> new DungeonEditorStatePane.RoomExitCard(
                                exit.label(),
                                exit.roomCell(),
                                exit.direction(),
                                room.narration().exitDescription(exit.roomCell(), exit.direction())))
                        .toList());
    }

    private void saveRoomNarration(long roomId, RoomNarration narration) {
        if (roomId <= 0) {
            return;
        }
        statePane.setRoomNarrationSaveState(roomId, true, "Speichert...");
        UiAsyncTasks.submitVoid(
                () -> roomNarrationService.saveNarration(roomId, narration),
                () -> {
                    statePane.setRoomNarrationSaveState(roomId, false, "Gespeichert");
                    loadingService.reload(mapState.activeMapId());
                },
                throwable -> {
                    UiErrorReporter.reportBackgroundFailure("DungeonEditorCoordinator.saveRoomNarration()", throwable);
                    statePane.setRoomNarrationSaveState(roomId, false, "Raumbeschreibung konnte nicht gespeichert werden.");
                });
    }

    private RoomCluster selectedCluster() {
        String targetKey = selectionState.selectedTargetKey();
        if (!RoomCluster.isTargetKey(targetKey)) {
            return null;
        }
        return mapState.activeMap().findCluster(RoomCluster.clusterIdFromKey(targetKey));
    }

    private void loadSelectedMap(DungeonMapCatalogEntry entry) {
        if (entry != null) {
            loadingService.loadMap(entry.mapId());
        }
    }

    private List<DungeonMapCatalogEntry> targetMapChoices() {
        Long currentMapId = mapState.activeMapId();
        return mapState.maps().stream()
                .filter(map -> map != null && !Objects.equals(map.mapId(), currentMapId))
                .toList();
    }

    private List<DungeonEditorStatePane.PreparedTransitionCard> preparedTransitionCards() {
        return mapState.activeMap().transitions().stream()
                .filter(transition -> transition != null && transition.transitionId() != null && !transition.isPlaced())
                .sorted(Comparator.comparing(DungeonTransition::transitionId))
                .map(transition -> new DungeonEditorStatePane.PreparedTransitionCard(
                        transition.transitionId(),
                        transition.name() + " (" + transition.transitionId() + ")"))
                .toList();
    }

    private String transitionSummary() {
        if (transitionDraftState.preparedTransitionId() != null && transitionDraftState.preparedTransitionId() > 0) {
            return "Vorbereitet: Übergang " + transitionDraftState.preparedTransitionId();
        }
        return switch (transitionDraftState.destinationType()) {
            case OVERWORLD_TILE -> "Overworld-Übergang";
            case DUNGEON_MAP -> transitionDraftState.bidirectional() ? "Dungeon-Übergang (zweiseitig)" : "Dungeon-Übergang";
        };
    }

    private void refreshTransitionTargetOptions() {
        if (sessionState.selectedTool() != DungeonEditorTool.TRANSITION_CREATE) {
            return;
        }
        if (transitionDraftState.preparedTransitionId() != null && transitionDraftState.preparedTransitionId() > 0) {
            return;
        }
        if (transitionDraftState.destinationType() == DungeonTransitionEditRequest.DestinationType.OVERWORLD_TILE) {
            loadOverworldTargetsIfNeeded();
            if (!targetTransitions.isEmpty()) {
                targetTransitions = List.of();
                loadedTargetTransitionMapId = null;
            }
            return;
        }
        if (transitionDraftState.bidirectional()) {
            if (!targetTransitions.isEmpty()) {
                targetTransitions = List.of();
                loadedTargetTransitionMapId = null;
            }
            return;
        }
        Long targetMapId = transitionDraftState.targetDungeonMapId();
        if (targetMapId == null || targetMapId <= 0) {
            if (!targetTransitions.isEmpty()) {
                targetTransitions = List.of();
                loadedTargetTransitionMapId = null;
            }
            return;
        }
        if (Objects.equals(loadedTargetTransitionMapId, targetMapId)) {
            return;
        }
        long requestId = ++targetTransitionRequestSequence;
        UiAsyncTasks.submit(
                () -> transitionTargetCatalogService.loadPlacedTargets(targetMapId),
                results -> {
                    if (requestId != targetTransitionRequestSequence
                            || !Objects.equals(transitionDraftState.targetDungeonMapId(), targetMapId)
                            || transitionDraftState.bidirectional()
                            || transitionDraftState.destinationType() != DungeonTransitionEditRequest.DestinationType.DUNGEON_MAP) {
                        return;
                    }
                    targetTransitions = results == null ? List.of() : results;
                    loadedTargetTransitionMapId = targetMapId;
                    boolean selectionStillValid = targetTransitions.stream()
                            .anyMatch(target -> target != null && Objects.equals(target.transitionId(), transitionDraftState.targetTransitionId()));
                    if (!selectionStillValid && transitionDraftState.targetTransitionId() != null) {
                        transitionDraftState.setTargetTransitionId(null);
                    }
                    refreshTransitionStatePane();
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("DungeonEditorCoordinator.loadTargetTransitions()", throwable));
    }

    private void loadOverworldTargetsIfNeeded() {
        if (overworldTargetsLoaded) {
            return;
        }
        long requestId = ++overworldTargetRequestSequence;
        UiAsyncTasks.submit(
                WorldReadApi::loadOverworldTransitionTargets,
                results -> {
                    if (requestId != overworldTargetRequestSequence
                            || transitionDraftState.destinationType() != DungeonTransitionEditRequest.DestinationType.OVERWORLD_TILE) {
                        return;
                    }
                    overworldTargets = results == null ? List.of() : results;
                    overworldTargetsLoaded = true;
                    refreshTransitionStatePane();
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("DungeonEditorCoordinator.loadOverworldTargets()", throwable));
    }

    private final class MapReloadHandle implements DungeonMapDropdownController.ReloadHandle {
        @Override
        public void reload(Long preferredMapId) {
            loadingService.reload(preferredMapId);
        }

        @Override
        public Long sessionMapId() {
            return mapState.activeMapId();
        }
    }
}
