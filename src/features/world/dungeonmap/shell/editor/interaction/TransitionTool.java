package features.world.dungeonmap.shell.editor.interaction;

import features.world.api.OverworldTransitionTargetSummary;
import features.world.dungeonmap.application.transition.DungeonTransitionApplicationService;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogEntry;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;
import features.world.dungeonmap.shell.editor.EditorCards;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonEditorTool;
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
    private final DungeonTransitionApplicationService transitionApplicationService;
    private final EditorInteractionState state;
    private final TextArea transitionDescriptionArea = new TextArea();
    private final ComboBox<TransitionDestinationMode> transitionDestinationModeBox = new ComboBox<>();
    private final CheckBox transitionBidirectionalBox = new CheckBox("Zweiseitig");
    private final ComboBox<DungeonMapCatalogEntry> transitionTargetMapBox = new ComboBox<>();
    private final ComboBox<DungeonTransition> transitionTargetTransitionBox = new ComboBox<>();
    private final ComboBox<OverworldTransitionTargetSummary> transitionTargetOverworldBox = new ComboBox<>();
    private final FlowPane preparedTransitionButtons = new FlowPane();
    private final Label transitionSummaryLabel = new Label("Kein Übergang gewählt");
    private final Label transitionStatusLabel = new Label();
    private final VBox transitionCard = EditorCards.card(
            "Übergänge",
            transitionSummaryLabel,
            transitionDescriptionArea,
            transitionDestinationModeBox,
            transitionBidirectionalBox,
            transitionTargetMapBox,
            transitionTargetTransitionBox,
            transitionTargetOverworldBox,
            preparedTransitionButtons,
            transitionStatusLabel);

    private List<DungeonTransition> dungeonTargetOptions = List.of();
    private List<OverworldTransitionTargetSummary> overworldTargetOptions = List.of();
    private Long loadedDungeonTargetMapId;
    private boolean overworldTargetsLoaded;
    private long dungeonTargetRequestSequence;
    private long overworldTargetRequestSequence;
    private Long previousMapId;
    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };
    private boolean syncingTransitionFields;
    private String description = "";
    private TransitionDestinationMode destinationMode = TransitionDestinationMode.OVERWORLD;
    private boolean bidirectional;
    private DungeonTransitionDestination selectedDestination;
    private Long preparedTransitionId;
    private String placementError;

    public TransitionTool(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonEditorSessionState sessionState,
            DungeonTransitionApplicationService transitionApplicationService,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.transitionApplicationService = Objects.requireNonNull(transitionApplicationService, "transitionApplicationService");
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
        invalidateDungeonTargetCache();
        refreshStatePane();
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (event == null || !event.isPrimaryButton()) {
            return false;
        }
        return switch (sessionState.selectedTool()) {
            case TRANSITION_CREATE -> handleCreatePressed(ctx);
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
    public List<EditorInteractionCapability> interactionCapabilities(EditorToolContext ctx, EditorToolPhase phase) {
        DungeonEditorTool tool = sessionState.selectedTool();
        if (tool == DungeonEditorTool.TRANSITION_CREATE) {
            if (ctx == null || ctx.probe() == null) {
                return List.of();
            }
            return List.of(EditorCapabilities.partFallback(this::floorCellRef));
        }
        if (tool == DungeonEditorTool.TRANSITION_DELETE) {
            return List.of(EditorCapabilities.owner(candidate -> candidate instanceof DungeonSelectionRef.TransitionRef));
        }
        return List.of();
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

    private DungeonSelectionRef floorCellRef(EditorToolContext ctx) {
        if (ctx == null || ctx.probe() == null) {
            return null;
        }
        return new DungeonSelectionRef.FloorCellRef(CubePoint.at(ctx.probe().gridCell(), ctx.probe().levelZ()));
    }

    private boolean handleCreatePressed(EditorToolContext ctx) {
        Long mapId = mapState.activeMapId();
        CellCoord cell = selectedFloorCell(ctx);
        if (mapId == null || cell == null) {
            return false;
        }
        clearPlacementError();
        state.clearSelection();
        CubePoint anchor = CubePoint.at(cell, mapState.activeProjectionLevel());
        Long selectedPreparedTransitionId = preparedTransitionId;
        boolean placingPrepared = selectedPreparedTransitionId != null && selectedPreparedTransitionId > 0;
        loadingService.submitMutation(
                () -> {
                    if (placingPrepared) {
                        transitionApplicationService.placePrepared(selectedPreparedTransitionId, anchor);
                    } else {
                        transitionApplicationService.create(mapId, anchor, description, selectedDestination, bidirectional);
                    }
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> {
                },
                throwable -> {
                    showPlacementError(throwable == null
                            ? defaultCreateFailureMessage(placingPrepared)
                            : throwable.getMessage());
                    UiErrorReporter.reportBackgroundFailure("TransitionTool.handleCreatePressed()", throwable);
                });
        return true;
    }

    private boolean handleDeletePressed(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        Long mapId = mapState.activeMapId();
        if (mapId == null || event == null || event.gridCell() == null) {
            return false;
        }
        DungeonSelectionRef.TransitionRef transitionRef = selectedTransitionRef(ctx == null ? null : ctx.hitRef());
        DungeonTransition transition = transitionRef == null ? null : mapState.activeMap().findTransition(transitionRef.transitionId());
        if (transition == null || transition.transitionId() == null) {
            state.clearSelection();
            return false;
        }
        state.selectRef(ctx == null ? null : ctx.resolvedRef());
        loadingService.submitMutation(
                () -> {
                    transitionApplicationService.delete(transition.transitionId());
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.clearSelection(),
                throwable -> UiErrorReporter.reportBackgroundFailure("TransitionTool.handleDeletePressed()", throwable));
        return true;
    }

    private void initializeStatePane() {
        transitionDescriptionArea.setPromptText("Beschreibung");
        transitionDescriptionArea.setWrapText(true);
        transitionDescriptionArea.setPrefRowCount(3);
        transitionTargetTransitionBox.setPromptText("Ziel-Übergang");
        transitionTargetOverworldBox.setPromptText("Overworld-Ziel");
        transitionDestinationModeBox.setItems(FXCollections.observableArrayList(TransitionDestinationMode.values()));
        transitionDestinationModeBox.setConverter(new javafx.util.StringConverter<>() {
            @Override
            public String toString(TransitionDestinationMode value) {
                return value == null ? "" : value.label;
            }

            @Override
            public TransitionDestinationMode fromString(String string) {
                return null;
            }
        });
        transitionDestinationModeBox.valueProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingTransitionFields) {
                setDestinationMode(newValue);
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
                setSelectedDungeonMapId(newValue == null ? null : newValue.mapId());
            }
        });
        transitionTargetTransitionBox.setConverter(new javafx.util.StringConverter<>() {
            @Override
            public String toString(DungeonTransition transition) {
                return dungeonTargetLabel(transition);
            }

            @Override
            public DungeonTransition fromString(String string) {
                return null;
            }
        });
        transitionTargetTransitionBox.valueProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingTransitionFields) {
                setSelectedDungeonTarget(newValue);
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
                setSelectedOverworldTarget(newValue);
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
        previousMapId = mapState.activeMapId();
        if (mapChanged) {
            invalidateDungeonTargetCache();
        }
        if (preparedTransitionId != null
                && mapState.activeMap().preparedTransitions().stream()
                .noneMatch(transition -> transition != null && Objects.equals(transition.transitionId(), preparedTransitionId))) {
            preparedTransitionId = null;
        }
        if (destinationMode == TransitionDestinationMode.DUNGEON && !dungeonTargetMapStillSelectable()) {
            selectedDestination = null;
        }
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
        DungeonTransition selectedTransition = mapState.activeMap().transition(state.selectedRef());
        String summary = selectedTransition != null
                ? "Gewählt: " + transitionLabel(selectedTransition.transitionId())
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
        boolean dungeonTarget = destinationMode == TransitionDestinationMode.DUNGEON;
        setCreateControlsVisible(
                dungeonTarget,
                dungeonTarget && !bidirectional,
                destinationMode == TransitionDestinationMode.OVERWORLD);
        renderPreparedTransitionButtons(preparedTransitionCards(), preparedTransitionId);
        String status = displayStatus();
        transitionStatusLabel.setText(status == null ? "" : status);
    }

    private void syncFields() {
        syncingTransitionFields = true;
        transitionDescriptionArea.setText(description == null ? "" : description);
        transitionDestinationModeBox.setValue(destinationMode);
        transitionBidirectionalBox.setSelected(bidirectional);
        List<DungeonMapCatalogEntry> maps = targetMapChoices();
        transitionTargetMapBox.setItems(FXCollections.observableArrayList(maps));
        transitionTargetMapBox.setValue(maps.stream()
                .filter(map -> map != null && Objects.equals(map.mapId(), selectedDungeonMapId()))
                .findFirst()
                .orElse(null));
        transitionTargetTransitionBox.setItems(FXCollections.observableArrayList(dungeonTargetOptions));
        transitionTargetTransitionBox.setValue(selectedDungeonTarget());
        transitionTargetOverworldBox.setItems(FXCollections.observableArrayList(overworldTargetOptions));
        transitionTargetOverworldBox.setValue(selectedOverworldTarget());
        syncingTransitionFields = false;
    }

    private void setCreateControlsVisible(boolean showDungeonTargetControls, boolean showTargetTransitionBox, boolean showOverworldTargetBox) {
        boolean creating = activeTool == DungeonEditorTool.TRANSITION_CREATE;
        transitionDescriptionArea.setManaged(creating);
        transitionDescriptionArea.setVisible(creating);
        transitionDestinationModeBox.setManaged(creating);
        transitionDestinationModeBox.setVisible(creating);
        transitionTargetMapBox.setManaged(showDungeonTargetControls);
        transitionTargetMapBox.setVisible(showDungeonTargetControls);
        transitionBidirectionalBox.setManaged(showDungeonTargetControls);
        transitionBidirectionalBox.setVisible(showDungeonTargetControls);
        transitionTargetTransitionBox.setManaged(showTargetTransitionBox);
        transitionTargetTransitionBox.setVisible(showTargetTransitionBox);
        transitionTargetOverworldBox.setManaged(showOverworldTargetBox);
        transitionTargetOverworldBox.setVisible(showOverworldTargetBox);
        preparedTransitionButtons.setManaged(creating);
        preparedTransitionButtons.setVisible(creating);
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
        if (destinationMode == TransitionDestinationMode.OVERWORLD) {
            loadOverworldTargetsIfNeeded();
            if (!dungeonTargetOptions.isEmpty() || loadedDungeonTargetMapId != null) {
                dungeonTargetOptions = List.of();
                loadedDungeonTargetMapId = null;
            }
            refreshStatePane();
            return;
        }
        if (bidirectional) {
            if (!dungeonTargetOptions.isEmpty() || loadedDungeonTargetMapId != null) {
                dungeonTargetOptions = List.of();
                loadedDungeonTargetMapId = null;
            }
            refreshStatePane();
            return;
        }
        Long targetMapId = selectedDungeonMapId();
        if (targetMapId == null || targetMapId <= 0) {
            if (!dungeonTargetOptions.isEmpty() || loadedDungeonTargetMapId != null) {
                dungeonTargetOptions = List.of();
                loadedDungeonTargetMapId = null;
            }
            refreshStatePane();
            return;
        }
        if (Objects.equals(loadedDungeonTargetMapId, targetMapId)) {
            refreshStatePane();
            return;
        }
        long requestId = ++dungeonTargetRequestSequence;
        UiAsyncTasks.submit(
                () -> transitionApplicationService.loadDungeonTargets(targetMapId),
                results -> {
                    if (requestId != dungeonTargetRequestSequence
                            || !Objects.equals(selectedDungeonMapId(), targetMapId)
                            || bidirectional
                            || destinationMode != TransitionDestinationMode.DUNGEON) {
                        return;
                    }
                    dungeonTargetOptions = results == null ? List.of() : results;
                    loadedDungeonTargetMapId = targetMapId;
                    if (selectedDungeonTarget() == null
                            && selectedDestination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon
                            && dungeon.transitionId() != null
                            && Objects.equals(dungeon.mapId(), targetMapId)) {
                        selectedDestination = new DungeonTransitionDestination.DungeonMapDestination(targetMapId, null);
                    }
                    refreshStatePane();
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("TransitionTool.loadDungeonTargets()", throwable));
    }

    private void loadOverworldTargetsIfNeeded() {
        if (overworldTargetsLoaded) {
            return;
        }
        long requestId = ++overworldTargetRequestSequence;
        UiAsyncTasks.submit(
                transitionApplicationService::loadOverworldTargets,
                results -> {
                    if (requestId != overworldTargetRequestSequence
                            || destinationMode != TransitionDestinationMode.OVERWORLD) {
                        return;
                    }
                    overworldTargetOptions = results == null ? List.of() : results;
                    overworldTargetsLoaded = true;
                    if (selectedOverworldTarget() == null
                            && selectedDestination instanceof DungeonTransitionDestination.OverworldTileDestination) {
                        selectedDestination = null;
                    }
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
        return mapState.activeMap().preparedTransitions().stream()
                .filter(transition -> transition != null && transition.transitionId() != null)
                .sorted(Comparator.comparing(DungeonTransition::transitionId))
                .map(transition -> new PreparedTransitionCard(transition.transitionId(), transition.label()))
                .toList();
    }

    private String transitionSummary() {
        if (preparedTransitionId != null && preparedTransitionId > 0) {
            return "Vorbereitet: Übergang " + preparedTransitionId;
        }
        return switch (destinationMode) {
            case OVERWORLD -> "Overworld-Übergang";
            case DUNGEON -> bidirectional ? "Dungeon-Übergang (zweiseitig)" : "Dungeon-Übergang";
        };
    }

    private void invalidateDungeonTargetCache() {
        dungeonTargetOptions = List.of();
        loadedDungeonTargetMapId = null;
    }

    private boolean dungeonTargetMapStillSelectable() {
        Long targetMapId = selectedDungeonMapId();
        if (targetMapId == null) {
            return false;
        }
        return targetMapChoices().stream()
                .anyMatch(map -> map != null && Objects.equals(map.mapId(), targetMapId));
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

    private void setDestinationMode(TransitionDestinationMode destinationMode) {
        TransitionDestinationMode next = destinationMode == null ? TransitionDestinationMode.OVERWORLD : destinationMode;
        if (this.destinationMode == next) {
            return;
        }
        this.destinationMode = next;
        preparedTransitionId = null;
        selectedDestination = null;
        placementError = null;
        refreshTransitionTargetOptions();
    }

    private void setBidirectional(boolean bidirectional) {
        if (this.bidirectional == bidirectional) {
            return;
        }
        this.bidirectional = bidirectional;
        Long targetMapId = selectedDungeonMapId();
        if (destinationMode == TransitionDestinationMode.DUNGEON && targetMapId != null) {
            selectedDestination = dungeonDestination(targetMapId, bidirectional ? null : selectedDungeonTransitionId());
        }
        placementError = null;
        refreshTransitionTargetOptions();
    }

    private void setSelectedDungeonMapId(Long targetMapId) {
        if (Objects.equals(selectedDungeonMapId(), targetMapId)) {
            return;
        }
        selectedDestination = dungeonDestination(targetMapId, null);
        placementError = null;
        refreshTransitionTargetOptions();
    }

    private void setSelectedDungeonTarget(DungeonTransition transition) {
        DungeonTransitionDestination next = transition == null
                ? dungeonDestination(selectedDungeonMapId(), null)
                : new DungeonTransitionDestination.DungeonMapDestination(transition.mapId(), transition.transitionId());
        if (Objects.equals(selectedDestination, next)) {
            return;
        }
        selectedDestination = next;
        placementError = null;
        refreshStatePane();
    }

    private void setSelectedOverworldTarget(OverworldTransitionTargetSummary summary) {
        DungeonTransitionDestination next = summary == null
                ? null
                : new DungeonTransitionDestination.OverworldTileDestination(summary.mapId(), summary.tileId());
        if (Objects.equals(selectedDestination, next)) {
            return;
        }
        selectedDestination = next;
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
        Long targetMapId = selectedDungeonMapId();
        return switch (destinationMode) {
            case OVERWORLD -> selectedDestination instanceof DungeonTransitionDestination.OverworldTileDestination
                    ? "Zum Platzieren Feld anklicken"
                    : "Overworld-Ziel wählen";
            case DUNGEON -> targetMapId == null || targetMapId <= 0
                    ? "Zielkarte wählen"
                    : bidirectional || hasSelectedDungeonTarget()
                    ? "Zum Platzieren Feld anklicken"
                    : "Ziel-Übergang wählen";
        };
    }

    private DungeonTransition selectedDungeonTarget() {
        if (!(selectedDestination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon)
                || dungeon.transitionId() == null) {
            return null;
        }
        return dungeonTargetOptions.stream()
                .filter(transition -> transition != null
                        && transition.mapId() == dungeon.mapId()
                        && Objects.equals(transition.transitionId(), dungeon.transitionId()))
                .findFirst()
                .orElse(null);
    }

    private OverworldTransitionTargetSummary selectedOverworldTarget() {
        if (!(selectedDestination instanceof DungeonTransitionDestination.OverworldTileDestination overworld)) {
            return null;
        }
        return overworldTargetOptions.stream()
                .filter(summary -> summary != null
                        && summary.mapId() == overworld.mapId()
                        && summary.tileId() == overworld.tileId())
                .findFirst()
                .orElse(null);
    }

    private Long selectedDungeonTransitionId() {
        return selectedDestination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon
                ? dungeon.transitionId()
                : null;
    }

    private Long selectedDungeonMapId() {
        return selectedDestination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon
                ? dungeon.mapId()
                : null;
    }

    private static DungeonTransitionDestination.DungeonMapDestination dungeonDestination(Long targetMapId, Long transitionId) {
        return targetMapId == null ? null : new DungeonTransitionDestination.DungeonMapDestination(targetMapId, transitionId);
    }

    private boolean hasSelectedDungeonTarget() {
        return selectedDestination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon
                && dungeon.transitionId() != null
                && dungeon.transitionId() > 0;
    }

    private static DungeonSelectionRef.TransitionRef selectedTransitionRef(DungeonSelectionRef ref) {
        return ref instanceof DungeonSelectionRef.TransitionRef transitionRef
                ? transitionRef
                : null;
    }

    private static CellCoord selectedFloorCell(EditorToolContext ctx) {
        return ctx != null && ctx.hitRef() instanceof DungeonSelectionRef.FloorCellRef floorCellRef
                ? floorCellRef.cell().projectedCell()
                : null;
    }

    private static String transitionLabel(Long transitionId) {
        return transitionId == null ? "Übergang" : "Übergang " + transitionId;
    }

    private static String dungeonTargetLabel(DungeonTransition transition) {
        if (transition == null) {
            return "";
        }
        StringBuilder label = new StringBuilder(transition.label());
        if (transition.description() != null && !transition.description().isBlank()) {
            label.append(" · ").append(transition.description());
        }
        CubePoint anchor = transition.anchor();
        if (anchor != null) {
            label.append(" · ")
                    .append(anchor.x())
                    .append(", ")
                    .append(anchor.y())
                    .append(", z=")
                    .append(anchor.z());
        }
        return label.toString();
    }

    private static String defaultCreateFailureMessage(boolean placingPrepared) {
        return placingPrepared
                ? "Übergang konnte nicht platziert werden"
                : "Übergang konnte nicht erstellt werden";
    }

    private enum TransitionDestinationMode {
        OVERWORLD("Overworld"),
        DUNGEON("Dungeon");

        private final String label;

        TransitionDestinationMode(String label) {
            this.label = label;
        }
    }

    private record PreparedTransitionCard(long transitionId, String label) {
    }
}
