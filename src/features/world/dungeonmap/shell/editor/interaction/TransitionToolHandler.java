package features.world.dungeonmap.shell.editor.interaction;

import features.world.api.OverworldTransitionTargetSummary;
import features.world.api.WorldReadApi;
import features.world.dungeonmap.application.transition.DungeonTransitionEditRequest;
import features.world.dungeonmap.application.transition.DungeonTransitionTargetCatalogService;
import features.world.dungeonmap.application.transition.DungeonTransitionTargetSummary;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapCatalogEntry;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.DungeonTransitionDraftState;
import features.world.dungeonmap.state.EditorSelectionState;
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

public final class TransitionToolHandler implements EditorToolHandler {

    private final TransitionInteractionController controller;
    private final DungeonTransitionDraftState transitionDraftState;
    private final DungeonTransitionTargetCatalogService transitionTargetCatalogService;
    private final DungeonMapState mapState;
    private final EditorSelectionState selectionState;
    private final TextArea transitionDescriptionArea = new TextArea();
    private final ComboBox<DungeonTransitionEditRequest.DestinationType> transitionDestinationTypeBox = new ComboBox<>();
    private final CheckBox transitionBidirectionalBox = new CheckBox("Zweiseitig");
    private final ComboBox<DungeonMapCatalogEntry> transitionTargetMapBox = new ComboBox<>();
    private final ComboBox<DungeonTransitionTargetSummary> transitionTargetTransitionBox = new ComboBox<>();
    private final ComboBox<OverworldTransitionTargetSummary> transitionTargetOverworldBox = new ComboBox<>();
    private final FlowPane preparedTransitionButtons = new FlowPane();
    private final Label transitionSummaryLabel = new Label("Kein Übergang gewählt");
    private final Label transitionStatusLabel = new Label();
    private final VBox transitionCard = createCard(
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

    public TransitionToolHandler(
            TransitionInteractionController controller,
            DungeonTransitionDraftState transitionDraftState,
            DungeonTransitionTargetCatalogService transitionTargetCatalogService,
            DungeonMapState mapState,
            EditorSelectionState selectionState
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.transitionDraftState = Objects.requireNonNull(transitionDraftState, "transitionDraftState");
        this.transitionTargetCatalogService = Objects.requireNonNull(transitionTargetCatalogService, "transitionTargetCatalogService");
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.selectionState = Objects.requireNonNull(selectionState, "selectionState");
        initializeStatePane();
        this.transitionDraftState.addListener(this::refreshStatePane);
        this.transitionDraftState.addListener(this::refreshTransitionTargetOptions);
        this.selectionState.addListener(this::refreshStatePane);
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
        transitionDraftState.clearPlacementError();
        invalidateTargetCache();
        controller.clear();
        refreshStatePane();
    }

    @Override
    public boolean handlePressed(DungeonCanvasPointerEvent event) {
        return controller.handlePressed(event);
    }

    @Override
    public boolean handleDragged(DungeonCanvasPointerEvent event) {
        return controller.handleDragged(event);
    }

    @Override
    public boolean handleReleased(DungeonCanvasPointerEvent event) {
        return controller.handleReleased(event);
    }

    @Override
    public Node statePaneContent() {
        refreshCard();
        return activeTool == DungeonEditorTool.TRANSITION_CREATE || activeTool == DungeonEditorTool.TRANSITION_DELETE
                ? transitionCard
                : null;
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
        refreshCallback = callback == null ? () -> { } : callback;
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
                transitionDraftState.setDestinationType(newValue);
            }
        });
        transitionBidirectionalBox.selectedProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingTransitionFields) {
                transitionDraftState.setBidirectional(Boolean.TRUE.equals(newValue));
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
                transitionDraftState.setTargetDungeonMapId(newValue == null ? null : newValue.mapId());
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
                transitionDraftState.setTargetTransitionId(newValue == null ? null : newValue.transitionId());
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
                transitionDraftState.setOverworldTarget(
                        newValue == null ? null : newValue.mapId(),
                        newValue == null ? null : newValue.tileId());
            }
        });
        transitionDescriptionArea.textProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingTransitionFields) {
                transitionDraftState.setDescription(newValue);
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
        String selectedTargetKey = selectionState.selectedTargetKey();
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
        boolean dungeonTarget = transitionDraftState.destinationType() == DungeonTransitionEditRequest.DestinationType.DUNGEON_MAP;
        setCreateControlsVisible(
                dungeonTarget,
                dungeonTarget && !transitionDraftState.bidirectional(),
                transitionDraftState.destinationType() == DungeonTransitionEditRequest.DestinationType.OVERWORLD_TILE);
        renderPreparedTransitionButtons(preparedTransitionCards(), transitionDraftState.preparedTransitionId());
        transitionStatusLabel.setText(blankToEmpty(transitionDraftState.displayStatus()));
    }

    private void syncFields() {
        syncingTransitionFields = true;
        transitionDescriptionArea.setText(blankToEmpty(transitionDraftState.description()));
        transitionDestinationTypeBox.setValue(transitionDraftState.destinationType());
        transitionBidirectionalBox.setSelected(transitionDraftState.bidirectional());
        List<DungeonMapCatalogEntry> maps = targetMapChoices();
        transitionTargetMapBox.setItems(FXCollections.observableArrayList(maps));
        transitionTargetMapBox.setValue(maps.stream()
                .filter(map -> map != null && Objects.equals(map.mapId(), transitionDraftState.targetDungeonMapId()))
                .findFirst()
                .orElse(null));
        transitionTargetTransitionBox.setItems(FXCollections.observableArrayList(targetTransitions));
        transitionTargetTransitionBox.setValue(targetTransitions.stream()
                .filter(target -> target != null && Objects.equals(target.transitionId(), transitionDraftState.targetTransitionId()))
                .findFirst()
                .orElse(null));
        transitionTargetOverworldBox.setItems(FXCollections.observableArrayList(overworldTargets));
        transitionTargetOverworldBox.setValue(overworldTargets.stream()
                .filter(target -> target != null
                        && target.mapId() == (transitionDraftState.targetOverworldMapId() == null ? -1L : transitionDraftState.targetOverworldMapId())
                        && target.tileId() == (transitionDraftState.targetOverworldTileId() == null ? -1L : transitionDraftState.targetOverworldTileId()))
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
            button.setOnAction(event -> transitionDraftState.setPreparedTransitionId(prepared.transitionId()));
            preparedTransitionButtons.getChildren().add(button);
        }
    }

    private void refreshTransitionTargetOptions() {
        if (activeTool != DungeonEditorTool.TRANSITION_CREATE) {
            return;
        }
        if (transitionDraftState.preparedTransitionId() != null && transitionDraftState.preparedTransitionId() > 0) {
            refreshStatePane();
            return;
        }
        if (transitionDraftState.destinationType() == DungeonTransitionEditRequest.DestinationType.OVERWORLD_TILE) {
            loadOverworldTargetsIfNeeded();
            if (!targetTransitions.isEmpty() || loadedTargetTransitionMapId != null) {
                targetTransitions = List.of();
                loadedTargetTransitionMapId = null;
            }
            refreshStatePane();
            return;
        }
        if (transitionDraftState.bidirectional()) {
            if (!targetTransitions.isEmpty() || loadedTargetTransitionMapId != null) {
                targetTransitions = List.of();
                loadedTargetTransitionMapId = null;
            }
            refreshStatePane();
            return;
        }
        Long targetMapId = transitionDraftState.targetDungeonMapId();
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
                        return;
                    }
                    refreshStatePane();
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("TransitionToolHandler.loadTargetTransitions()", throwable));
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
                    refreshStatePane();
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("TransitionToolHandler.loadOverworldTargets()", throwable));
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
        if (transitionDraftState.preparedTransitionId() != null && transitionDraftState.preparedTransitionId() > 0) {
            return "Vorbereitet: Übergang " + transitionDraftState.preparedTransitionId();
        }
        return switch (transitionDraftState.destinationType()) {
            case OVERWORLD_TILE -> "Overworld-Übergang";
            case DUNGEON_MAP -> transitionDraftState.bidirectional() ? "Dungeon-Übergang (zweiseitig)" : "Dungeon-Übergang";
        };
    }

    private void invalidateTargetCache() {
        targetTransitions = List.of();
        loadedTargetTransitionMapId = null;
    }

    private static VBox createCard(String title, Node... content) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("editor-panel-title");
        VBox box = new VBox(6);
        box.getStyleClass().add("editor-card");
        box.getChildren().add(titleLabel);
        box.getChildren().addAll(content);
        return box;
    }

    private static String blankToEmpty(String text) {
        return text == null ? "" : text;
    }

    private static String transitionLabel(String targetKey) {
        Long transitionId = DungeonTransition.transitionIdFromKey(targetKey);
        return transitionId == null ? "Übergang" : "Übergang " + transitionId;
    }

    private record PreparedTransitionCard(long transitionId, String label) {
    }
}
