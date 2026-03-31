package features.world.dungeonmap.shell.editor.interaction;

import features.world.api.OverworldTransitionTargetSummary;
import features.world.api.WorldReadApi;
import features.world.dungeonmap.application.transition.DungeonTransitionEditRequest;
import features.world.dungeonmap.application.transition.DungeonTransitionEditService;
import features.world.dungeonmap.application.transition.DungeonTransitionTargetCatalogService;
import features.world.dungeonmap.application.transition.DungeonTransitionTargetSummary;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapCatalogEntry;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.shell.editor.EditorCards;
import features.world.dungeonmap.shell.interaction.DungeonHitResult;
import features.world.dungeonmap.shell.interaction.DungeonHitService;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorInteractionState;
import javafx.collections.FXCollections;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.VBox;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class TransitionTool implements EditorTool {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonEditorSessionState sessionState;
    private final DungeonTransitionEditService transitionEditService;
    private final DungeonTransitionTargetCatalogService targetCatalogService;
    private final EditorInteractionState state;
    private final TextArea transitionDescriptionArea = new TextArea();
    private final ComboBox<DungeonTransitionEditRequest.DestinationType> transitionDestinationTypeBox = new ComboBox<>();
    private final CheckBox transitionBidirectionalBox = new CheckBox("Zweiseitig");
    private final ComboBox<DungeonMapCatalogEntry> transitionTargetMapBox = new ComboBox<>();
    private final ComboBox<DungeonTransitionTargetSummary> transitionTargetTransitionBox = new ComboBox<>();
    private final ComboBox<OverworldTransitionTargetSummary> transitionTargetOverworldBox = new ComboBox<>();
    private final FlowPane preparedTransitionButtons = new FlowPane();
    private final Label transitionSummaryLabel = new Label("Kein Übergang gewählt");
    private final Label transitionStatusLabel = new Label();
    private final VBox transitionCard = EditorCards.card(
            "Übergänge",
            transitionSummaryLabel,
            transitionDescriptionArea,
            transitionDestinationTypeBox,
            transitionBidirectionalBox,
            transitionTargetMapBox,
            transitionTargetTransitionBox,
            transitionTargetOverworldBox,
            preparedTransitionButtons,
            transitionStatusLabel);

    private List<DungeonTransitionTargetSummary> targetTransitions = List.of();
    private List<OverworldTransitionTargetSummary> overworldTargets = List.of();
    private Long loadedTargetTransitionMapId;
    private boolean overworldTargetsLoaded;
    private long targetTransitionRequestSequence;
    private long overworldTargetRequestSequence;
    private Long previousMapId;
    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };
    private boolean syncingTransitionFields;
    private String description = "";
    private DungeonTransitionEditRequest.DestinationType destinationType = DungeonTransitionEditRequest.DestinationType.OVERWORLD_TILE;
    private boolean bidirectional;
    private Long targetDungeonMapId;
    private Long targetTransitionId;
    private Long targetOverworldMapId;
    private Long targetOverworldTileId;
    private Long preparedTransitionId;
    private String placementError;

    public TransitionTool(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonEditorSessionState sessionState,
            DungeonTransitionEditService transitionEditService,
            DungeonTransitionTargetCatalogService targetCatalogService,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.transitionEditService = Objects.requireNonNull(transitionEditService, "transitionEditService");
        this.targetCatalogService = Objects.requireNonNull(targetCatalogService, "targetCatalogService");
        this.state = Objects.requireNonNull(state, "state");
        initializeStatePane();
        this.mapState.addListener(this::refreshFromMapState);
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(DungeonEditorTool.TRANSITION_CREATE, DungeonEditorTool.TRANSITION_DELETE);
    }

    @Override
    public void activate(DungeonEditorTool tool) {
        activeTool = tool;
        if (tool == DungeonEditorTool.TRANSITION_CREATE) {
            refreshTransitionTargetOptions();
        }
        refreshStatePane();
    }

    @Override
    public void deactivate() {
        activeTool = null;
        clearPlacementError();
        invalidateTargetCache();
        clear();
        refreshStatePane();
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (event == null || !event.isPrimaryButton()) {
            return false;
        }
        return switch (sessionState.selectedTool()) {
            case TRANSITION_CREATE -> handleCreatePressed(event);
            case TRANSITION_DELETE -> handleDeletePressed(ctx);
            default -> false;
        };
    }

    @Override
    public boolean dragged(EditorToolContext ctx) {
        return false;
    }

    @Override
    public boolean released(EditorToolContext ctx) {
        return false;
    }

    @Override
    public Node statePaneContent() {
        if (activeTool == null) {
            return null;
        }
        refreshCard();
        return activeTool == DungeonEditorTool.TRANSITION_CREATE || activeTool == DungeonEditorTool.TRANSITION_DELETE
                ? transitionCard
                : null;
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
        refreshCallback = callback == null ? () -> { } : callback;
    }

    private boolean handleCreatePressed(DungeonCanvasPointerEvent event) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || event.gridCell() == null) {
            return false;
        }
        clearPlacementError();
        state.clearSelection();
        if (preparedTransitionId != null && preparedTransitionId > 0) {
            loadingService.submitReloadingWrite(
                    () -> transitionEditService.placePrepared(
                            preparedTransitionId,
                            event.gridCell(),
                            mapState.activeProjectionLevel()),
                    mapId,
                    null,
                    throwable -> {
                        showPlacementError(throwable == null ? "Übergang konnte nicht platziert werden" : throwable.getMessage());
                        UiErrorReporter.reportBackgroundFailure("TransitionTool.handleCreatePressed()", throwable);
                    });
            return true;
        }
        loadingService.submitReloadingWrite(
                () -> transitionEditService.create(
                        mapState.activeMap(),
                        event.gridCell(),
                        mapState.activeProjectionLevel(),
                        createRequest()),
                mapId,
                null,
                throwable -> {
                    showPlacementError(throwable == null ? "Übergang konnte nicht erstellt werden" : throwable.getMessage());
                    UiErrorReporter.reportBackgroundFailure("TransitionTool.handleCreatePressed()", throwable);
                });
        return true;
    }

    private boolean handleDeletePressed(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        Long mapId = mapState.activeMapId();
        if (mapId == null || event.gridCell() == null) {
            return false;
        }
        DungeonHitResult hitResult = ctx.hitResult();
        DungeonHitService.DungeonHitTarget coarseHit = hitResult == null ? null : hitResult.coarseTarget();
        DungeonTransition transition = coarseHit instanceof DungeonHitService.DungeonHitTarget.TransitionTarget transitionTarget
                ? transitionTarget.transition()
                : null;
        if (transition == null || transition.transitionId() == null) {
            state.clearSelection();
            return false;
        }
        state.selectTarget(transition.targetKey());
        loadingService.submitReloadingWrite(
                () -> transitionEditService.delete(transition.transitionId()),
                mapId,
                null,
                throwable -> UiErrorReporter.reportBackgroundFailure("TransitionTool.handleDeletePressed()", throwable));
        return true;
    }

    private void clear() {
        clearPlacementError();
    }

    private void initializeStatePane() {
        transitionDescriptionArea.setPromptText("Beschreibung");
        transitionDescriptionArea.setWrapText(true);
        transitionDescriptionArea.setPrefRowCount(3);
        transitionTargetTransitionBox.setPromptText("Ziel-Übergang");
        transitionTargetOverworldBox.setPromptText("Overworld-Ziel");
        transitionDestinationTypeBox.setItems(FXCollections.observableArrayList(DungeonTransitionEditRequest.DestinationType.values()));
        transitionDestinationTypeBox.setConverter(new javafx.util.StringConverter<>() {
            @Override
            public String toString(DungeonTransitionEditRequest.DestinationType value) {
                if (value == null) {
                    return "";
                }
                return switch (value) {
                    case OVERWORLD_TILE -> "Overworld";
                    case DUNGEON_MAP -> "Dungeon";
                };
            }

            @Override
            public DungeonTransitionEditRequest.DestinationType fromString(String string) {
                return null;
            }
        });
        transitionDestinationTypeBox.valueProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingTransitionFields) {
                setDestinationType(newValue);
            }
        });
        transitionBidirectionalBox.selectedProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingTransitionFields) {
                setBidirectional(Boolean.TRUE.equals(newValue));
            }
        });
        transitionTargetMapBox.setConverter(new javafx.util.StringConverter<>() {
            @Override
            public String toString(DungeonMapCatalogEntry entry) {
                return entry == null ? "" : entry.name() + " (" + entry.mapId() + ")";
            }

            @Override
            public DungeonMapCatalogEntry fromString(String string) {
                return null;
            }
        });
        transitionTargetMapBox.valueProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingTransitionFields) {
                setTargetDungeonMapId(newValue == null ? null : newValue.mapId());
            }
        });
        transitionTargetTransitionBox.setConverter(new javafx.util.StringConverter<>() {
            @Override
            public String toString(DungeonTransitionTargetSummary summary) {
                return summary == null ? "" : summary.label();
            }

            @Override
            public DungeonTransitionTargetSummary fromString(String string) {
                return null;
            }
        });
        transitionTargetTransitionBox.valueProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingTransitionFields) {
                setTargetTransitionId(newValue == null ? null : newValue.transitionId());
            }
        });
        transitionTargetOverworldBox.setConverter(new javafx.util.StringConverter<>() {
            @Override
            public String toString(OverworldTransitionTargetSummary summary) {
                return summary == null ? "" : summary.label();
            }

            @Override
            public OverworldTransitionTargetSummary fromString(String string) {
                return null;
            }
        });
        transitionTargetOverworldBox.valueProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingTransitionFields) {
                setOverworldTarget(
                        newValue == null ? null : newValue.mapId(),
                        newValue == null ? null : newValue.tileId());
            }
        });
        transitionDescriptionArea.textProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingTransitionFields) {
                setDescription(newValue);
            }
        });
        preparedTransitionButtons.setHgap(6);
        preparedTransitionButtons.setVgap(6);
        transitionStatusLabel.setWrapText(true);
    }

    private void refreshFromMapState() {
        boolean mapChanged = !Objects.equals(previousMapId, mapState.activeMapId());
        if (mapChanged) {
            invalidateTargetCache();
        }
        previousMapId = mapState.activeMapId();
        refreshTransitionTargetOptions();
        refreshStatePane();
    }

    private void refreshStatePane() {
        refreshCallback.run();
    }

    private void refreshCard() {
        if (activeTool == DungeonEditorTool.TRANSITION_DELETE) {
            renderDeleteCard();
            return;
        }
        renderCreateCard();
    }

    private void renderDeleteCard() {
        String selectedTargetKey = state.selectedTargetKey();
        String summary = DungeonTransition.isTargetKey(selectedTargetKey)
                ? "Gewählt: " + transitionLabel(selectedTargetKey)
                : "Übergangsfeld anklicken, um zu löschen";
        transitionSummaryLabel.setText(summary);
        syncFields();
        setCreateControlsVisible(false, false, false);
        renderPreparedTransitionButtons(List.of(), null);
        transitionStatusLabel.setText(summary);
    }

    private void renderCreateCard() {
        transitionSummaryLabel.setText(transitionSummary());
        syncFields();
        boolean dungeonTarget = destinationType == DungeonTransitionEditRequest.DestinationType.DUNGEON_MAP;
        setCreateControlsVisible(
                dungeonTarget,
                dungeonTarget && !bidirectional,
                destinationType == DungeonTransitionEditRequest.DestinationType.OVERWORLD_TILE);
        renderPreparedTransitionButtons(preparedTransitionCards(), preparedTransitionId);
        String status = displayStatus();
        transitionStatusLabel.setText(status == null ? "" : status);
    }

    private void syncFields() {
        syncingTransitionFields = true;
        transitionDescriptionArea.setText(description == null ? "" : description);
        transitionDestinationTypeBox.setValue(destinationType);
        transitionBidirectionalBox.setSelected(bidirectional);
        List<DungeonMapCatalogEntry> maps = targetMapChoices();
        transitionTargetMapBox.setItems(FXCollections.observableArrayList(maps));
        transitionTargetMapBox.setValue(maps.stream()
                .filter(map -> map != null && Objects.equals(map.mapId(), targetDungeonMapId))
                .findFirst()
                .orElse(null));
        transitionTargetTransitionBox.setItems(FXCollections.observableArrayList(targetTransitions));
        transitionTargetTransitionBox.setValue(targetTransitions.stream()
                .filter(target -> target != null && Objects.equals(target.transitionId(), targetTransitionId))
                .findFirst()
                .orElse(null));
        transitionTargetOverworldBox.setItems(FXCollections.observableArrayList(overworldTargets));
        transitionTargetOverworldBox.setValue(overworldTargets.stream()
                .filter(target -> target != null
                        && target.mapId() == (targetOverworldMapId == null ? -1L : targetOverworldMapId)
                        && target.tileId() == (targetOverworldTileId == null ? -1L : targetOverworldTileId))
                .findFirst()
                .orElse(null));
        syncingTransitionFields = false;
    }

    private void setCreateControlsVisible(boolean showDungeonTargetControls, boolean showTargetTransitionBox, boolean showOverworldTargetBox) {
        transitionDescriptionArea.setManaged(activeTool == DungeonEditorTool.TRANSITION_CREATE);
        transitionDescriptionArea.setVisible(activeTool == DungeonEditorTool.TRANSITION_CREATE);
        transitionDestinationTypeBox.setManaged(activeTool == DungeonEditorTool.TRANSITION_CREATE);
        transitionDestinationTypeBox.setVisible(activeTool == DungeonEditorTool.TRANSITION_CREATE);
        transitionTargetMapBox.setManaged(showDungeonTargetControls);
        transitionTargetMapBox.setVisible(showDungeonTargetControls);
        transitionBidirectionalBox.setManaged(showDungeonTargetControls);
        transitionBidirectionalBox.setVisible(showDungeonTargetControls);
        transitionTargetTransitionBox.setManaged(showTargetTransitionBox);
        transitionTargetTransitionBox.setVisible(showTargetTransitionBox);
        transitionTargetOverworldBox.setManaged(showOverworldTargetBox);
        transitionTargetOverworldBox.setVisible(showOverworldTargetBox);
        preparedTransitionButtons.setManaged(activeTool == DungeonEditorTool.TRANSITION_CREATE);
        preparedTransitionButtons.setVisible(activeTool == DungeonEditorTool.TRANSITION_CREATE);
    }

    private void renderPreparedTransitionButtons(List<PreparedTransitionCard> preparedTransitions, Long selectedId) {
        preparedTransitionButtons.getChildren().clear();
        for (PreparedTransitionCard prepared : preparedTransitions) {
            Button button = new Button(prepared.label());
            button.getStyleClass().add("compact");
            if (Objects.equals(prepared.transitionId(), selectedId) && !button.getStyleClass().contains("selected")) {
                button.getStyleClass().add("selected");
            }
            button.setOnAction(event -> setPreparedTransitionId(prepared.transitionId()));
            preparedTransitionButtons.getChildren().add(button);
        }
    }

    private void refreshTransitionTargetOptions() {
        if (activeTool != DungeonEditorTool.TRANSITION_CREATE) {
            return;
        }
        if (preparedTransitionId != null && preparedTransitionId > 0) {
            refreshStatePane();
            return;
        }
        if (destinationType == DungeonTransitionEditRequest.DestinationType.OVERWORLD_TILE) {
            loadOverworldTargetsIfNeeded();
            if (!targetTransitions.isEmpty() || loadedTargetTransitionMapId != null) {
                targetTransitions = List.of();
                loadedTargetTransitionMapId = null;
            }
            refreshStatePane();
            return;
        }
        if (bidirectional) {
            if (!targetTransitions.isEmpty() || loadedTargetTransitionMapId != null) {
                targetTransitions = List.of();
                loadedTargetTransitionMapId = null;
            }
            refreshStatePane();
            return;
        }
        Long targetMapId = targetDungeonMapId;
        if (targetMapId == null || targetMapId <= 0) {
            if (!targetTransitions.isEmpty() || loadedTargetTransitionMapId != null) {
                targetTransitions = List.of();
                loadedTargetTransitionMapId = null;
            }
            refreshStatePane();
            return;
        }
        if (Objects.equals(loadedTargetTransitionMapId, targetMapId)) {
            refreshStatePane();
            return;
        }
        long requestId = ++targetTransitionRequestSequence;
        UiAsyncTasks.submit(
                () -> targetCatalogService.loadPlacedTargets(targetMapId),
                results -> {
                    if (requestId != targetTransitionRequestSequence
                            || !Objects.equals(targetDungeonMapId, targetMapId)
                            || bidirectional
                            || destinationType != DungeonTransitionEditRequest.DestinationType.DUNGEON_MAP) {
                        return;
                    }
                    targetTransitions = results == null ? List.of() : results;
                    loadedTargetTransitionMapId = targetMapId;
                    boolean selectionStillValid = targetTransitions.stream()
                            .anyMatch(target -> target != null && Objects.equals(target.transitionId(), targetTransitionId));
                    if (!selectionStillValid && targetTransitionId != null) {
                        setTargetTransitionId(null);
                        return;
                    }
                    refreshStatePane();
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("TransitionTool.loadTargetTransitions()", throwable));
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
                            || destinationType != DungeonTransitionEditRequest.DestinationType.OVERWORLD_TILE) {
                        return;
                    }
                    overworldTargets = results == null ? List.of() : results;
                    overworldTargetsLoaded = true;
                    refreshStatePane();
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("TransitionTool.loadOverworldTargets()", throwable));
    }

    private List<DungeonMapCatalogEntry> targetMapChoices() {
        Long currentMapId = mapState.activeMapId();
        return mapState.maps().stream()
                .filter(map -> map != null && !Objects.equals(map.mapId(), currentMapId))
                .toList();
    }

    private List<PreparedTransitionCard> preparedTransitionCards() {
        return mapState.activeMap().transitions().stream()
                .filter(transition -> transition != null && transition.transitionId() != null && !transition.isPlaced())
                .sorted(Comparator.comparing(DungeonTransition::transitionId))
                .map(transition -> new PreparedTransitionCard(transition.transitionId(), transition.label()))
                .toList();
    }

    private String transitionSummary() {
        if (preparedTransitionId != null && preparedTransitionId > 0) {
            return "Vorbereitet: Übergang " + preparedTransitionId;
        }
        return switch (destinationType) {
            case OVERWORLD_TILE -> "Overworld-Übergang";
            case DUNGEON_MAP -> bidirectional ? "Dungeon-Übergang (zweiseitig)" : "Dungeon-Übergang";
        };
    }

    private void invalidateTargetCache() {
        targetTransitions = List.of();
        loadedTargetTransitionMapId = null;
    }

    private void setDescription(String description) {
        String next = description == null ? "" : description.trim();
        if (Objects.equals(this.description, next)) {
            return;
        }
        this.description = next;
        placementError = null;
        refreshStatePane();
    }

    private void setDestinationType(DungeonTransitionEditRequest.DestinationType destinationType) {
        DungeonTransitionEditRequest.DestinationType next = destinationType == null
                ? DungeonTransitionEditRequest.DestinationType.OVERWORLD_TILE
                : destinationType;
        if (this.destinationType == next) {
            return;
        }
        this.destinationType = next;
        preparedTransitionId = null;
        targetTransitionId = null;
        targetDungeonMapId = null;
        targetOverworldMapId = null;
        targetOverworldTileId = null;
        placementError = null;
        refreshTransitionTargetOptions();
    }

    private void setBidirectional(boolean bidirectional) {
        if (this.bidirectional == bidirectional) {
            return;
        }
        this.bidirectional = bidirectional;
        if (bidirectional) {
            targetTransitionId = null;
        }
        placementError = null;
        refreshTransitionTargetOptions();
    }

    private void setTargetDungeonMapId(Long targetDungeonMapId) {
        if (Objects.equals(this.targetDungeonMapId, targetDungeonMapId)) {
            return;
        }
        this.targetDungeonMapId = targetDungeonMapId;
        targetTransitionId = null;
        placementError = null;
        refreshTransitionTargetOptions();
    }

    private void setTargetTransitionId(Long targetTransitionId) {
        if (Objects.equals(this.targetTransitionId, targetTransitionId)) {
            return;
        }
        this.targetTransitionId = targetTransitionId;
        placementError = null;
        refreshStatePane();
    }

    private void setOverworldTarget(Long targetOverworldMapId, Long targetOverworldTileId) {
        if (Objects.equals(this.targetOverworldMapId, targetOverworldMapId)
                && Objects.equals(this.targetOverworldTileId, targetOverworldTileId)) {
            return;
        }
        this.targetOverworldMapId = targetOverworldMapId;
        this.targetOverworldTileId = targetOverworldTileId;
        placementError = null;
        refreshStatePane();
    }

    private void setPreparedTransitionId(Long preparedTransitionId) {
        if (Objects.equals(this.preparedTransitionId, preparedTransitionId)) {
            return;
        }
        this.preparedTransitionId = preparedTransitionId;
        placementError = null;
        refreshTransitionTargetOptions();
    }

    private void showPlacementError(String message) {
        String next = message == null || message.isBlank() ? null : message.trim();
        if (Objects.equals(placementError, next)) {
            return;
        }
        placementError = next;
        refreshStatePane();
    }

    private void clearPlacementError() {
        if (placementError == null) {
            return;
        }
        placementError = null;
        refreshStatePane();
    }

    private String displayStatus() {
        if (placementError != null && !placementError.isBlank()) {
            return placementError;
        }
        if (preparedTransitionId != null) {
            return "Vorbereiteten Übergang platzieren";
        }
        return switch (destinationType) {
            case OVERWORLD_TILE -> targetOverworldTileId == null || targetOverworldTileId <= 0
                    ? "Overworld-Ziel wählen"
                    : "Zum Platzieren Feld anklicken";
            case DUNGEON_MAP -> targetDungeonMapId == null || targetDungeonMapId <= 0
                    ? "Zielkarte wählen"
                    : bidirectional || (targetTransitionId != null && targetTransitionId > 0)
                    ? "Zum Platzieren Feld anklicken"
                    : "Ziel-Übergang wählen";
        };
    }

    private DungeonTransitionEditRequest createRequest() {
        return new DungeonTransitionEditRequest(
                description,
                destinationType,
                targetDungeonMapId,
                targetTransitionId,
                targetOverworldMapId,
                targetOverworldTileId,
                bidirectional);
    }

    private static String transitionLabel(String targetKey) {
        Long transitionId = DungeonTransition.transitionIdFromKey(targetKey);
        return transitionId == null ? "Übergang" : "Übergang " + transitionId;
    }

    private record PreparedTransitionCard(long transitionId, String label) {
    }
}
