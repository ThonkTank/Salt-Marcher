package features.world.dungeon.shell.editor.interaction.state;

import features.world.api.OverworldTransitionTargetSummary;
import features.world.dungeon.application.stair.DungeonStairApplicationService;
import features.world.dungeon.application.transition.DungeonTransitionApplicationService;
import features.world.dungeon.application.transition.TransitionConnectionBuilder;
import features.world.dungeon.catalog.application.DungeonMapCatalogEntry;
import features.world.dungeon.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeon.dungeonmap.application.DungeonMapApplicationService;
import features.world.dungeon.dungeonmap.application.DungeonMapLoadingService;
import features.world.dungeon.dungeonmap.api.DoorDescription;
import features.world.dungeon.dungeonmap.api.PreviewAddedTransitionRequest;
import features.world.dungeon.dungeonmap.api.PreviewReplacedTransitionRequest;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.dungeonmap.cluster.model.Cluster;
import features.world.dungeon.model.structures.room.Room;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeon.model.structures.connection.DungeonConnection;
import features.world.dungeon.model.structures.transition.DungeonTransition;
import features.world.dungeon.model.structures.transition.DungeonTransitionDestination;
import features.world.dungeon.stair.model.StairPathPatternKind;
import features.world.dungeon.stair.model.StairPathPatternSpec;
import features.world.dungeon.shell.editor.state.EditorCards;
import features.world.dungeon.shell.editor.interaction.input.EditorInteractionCapability;
import features.world.dungeon.shell.editor.interaction.input.EditorTool;
import features.world.dungeon.shell.editor.interaction.input.EditorToolContext;
import features.world.dungeon.shell.editor.interaction.input.EditorToolPhase;
import features.world.dungeon.shell.editor.interaction.tasks.EditorCapabilities;
import features.world.dungeon.state.DungeonEditorSessionState;
import features.world.dungeon.state.DungeonEditorTool;
import features.world.dungeon.dungeonmap.state.DungeonMapState;
import features.world.dungeon.state.EditorInteractionState;
import features.world.dungeon.state.EditorPreview;
import javafx.collections.FXCollections;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Editor tool for transition create, place, and delete interactions.
 *
 * <p>This tool owns transition form state and gesture interpretation, but canonical connection construction and
 * validation stay in transition workflow seams instead of being reimplemented in UI code.</p>
 */
public final class TransitionTool implements EditorTool {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonEditorSessionState sessionState;
    private final DungeonMapApplicationService mapApplicationService;
    private final DungeonTransitionApplicationService transitionApplicationService;
    private final EditorInteractionState state;

    private final TextArea transitionDescriptionArea = new TextArea();
    private final ComboBox<TransitionDestinationMode> transitionDestinationModeBox = new ComboBox<>();
    private final ComboBox<TransitionPlacementMode> transitionPlacementModeBox = new ComboBox<>();
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
            transitionPlacementModeBox,
            transitionBidirectionalBox,
            transitionTargetMapBox,
            transitionTargetTransitionBox,
            transitionTargetOverworldBox,
            preparedTransitionButtons,
            transitionStatusLabel);

    private final Label stairSummaryLabel = new Label("Keine Übergangstreppe aktiv");
    private final Label stairAnchorLabel = new Label("Kein Treppenanker");
    private final Label stairShapeInputLabel = fieldLabel("Form");
    private final Label stairDirectionInputLabel = fieldLabel("Richtung");
    private final Label stairDimension1Label = fieldLabel("Maß");
    private final Label stairDimension2Label = fieldLabel("Maß");
    private final Label stairExitLevelInputLabel = fieldLabel("Exit-Level");
    private final Label stairExitChipsLabel = fieldLabel("Exits");
    private final ComboBox<StairPathPatternKind> stairShapeBox = new ComboBox<>();
    private final ComboBox<CardinalDirection> stairDirectionBox = new ComboBox<>();
    private final TextField stairDimension1Field = new TextField();
    private final TextField stairDimension2Field = new TextField();
    private final TextField stairExitLevelField = new TextField();
    private final Button stairAddExitButton = new Button("Hinzufügen");
    private final FlowPane stairExitChips = new FlowPane();
    private final Button stairApplyButton = new Button("Übernehmen");
    private final Button stairCancelButton = new Button("Abbrechen");
    private final Label stairStatusLabel = new Label();
    private final VBox stairShapeBlock = fieldBlock(stairShapeInputLabel, stairShapeBox);
    private final VBox stairDirectionBlock = fieldBlock(stairDirectionInputLabel, stairDirectionBox);
    private final VBox stairDimension1Block = fieldBlock(stairDimension1Label, stairDimension1Field);
    private final VBox stairDimension2Block = fieldBlock(stairDimension2Label, stairDimension2Field);
    private final HBox stairExitLevelRow = new HBox(6, stairExitLevelField, stairAddExitButton);
    private final VBox stairExitLevelBlock = fieldBlock(stairExitLevelInputLabel, stairExitLevelRow);
    private final VBox stairExitChipsBlock = fieldBlock(stairExitChipsLabel, stairExitChips);
    private final HBox stairShapeRow = fieldRow(stairShapeBlock);
    private final HBox stairDirectionDimensionRow = fieldRow(stairDirectionBlock, stairDimension1Block);
    private final HBox stairDimension2Row = fieldRow(stairDimension2Block);
    private final VBox stairFieldsBox = new VBox(
            8,
            stairShapeRow,
            stairDirectionDimensionRow,
            stairDimension2Row,
            stairExitLevelBlock,
            stairExitChipsBlock);
    private final Region stairActionSpacer = new Region();
    private final HBox stairActionRow = new HBox(6, stairActionSpacer, stairApplyButton, stairCancelButton);
    private final VBox stairFormBox = new VBox(8, stairFieldsBox, stairActionRow);
    private final VBox stairCard = EditorCards.card("Treppen-Übergang", stairSummaryLabel, stairAnchorLabel, stairFormBox, stairStatusLabel);
    private final VBox statePane = new VBox(10);

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
    private boolean syncingStairFields;
    private String description = "";
    private TransitionDestinationMode destinationMode = TransitionDestinationMode.OVERWORLD;
    private TransitionPlacementMode placementMode = TransitionPlacementMode.DOOR;
    private boolean bidirectional;
    private DungeonTransitionDestination selectedDestination;
    private Long preparedTransitionId;
    private String placementError;

    private GridPoint stairAnchorCell;
    private Integer stairAnchorLevelZ;
    private final LinkedHashSet<Integer> stairStopLevels = new LinkedHashSet<>();
    private boolean stairDraftDirty;
    private String stairStatusOverride;

    public TransitionTool(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonEditorSessionState sessionState,
            DungeonMapApplicationService mapApplicationService,
            DungeonTransitionApplicationService transitionApplicationService,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.mapApplicationService = Objects.requireNonNull(mapApplicationService, "mapApplicationService");
        this.transitionApplicationService = Objects.requireNonNull(transitionApplicationService, "transitionApplicationService");
        this.state = Objects.requireNonNull(state, "state");
        initializeStatePane();
        clearStairDraft(false);
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
        clearStairDraft(false);
        invalidateDungeonTargetCache();
        refreshStatePane();
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (event == null) {
            return false;
        }
        if (sessionState.selectedTool() == DungeonEditorTool.TRANSITION_CREATE
                && event.isSecondaryButton()
                && stairDraftActive()) {
            clearStairDraft(true);
            return true;
        }
        if (!event.isPrimaryButton()) {
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
        if (tool == DungeonEditorTool.TRANSITION_DELETE) {
            return List.of(EditorCapabilities.owner(candidate -> candidate instanceof DungeonSelectionRef.TransitionRef));
        }
        if (tool != DungeonEditorTool.TRANSITION_CREATE || ctx == null || ctx.probe() == null) {
            return List.of();
        }
        int levelZ = ctx.probe().levelZ();
        if (placementMode == TransitionPlacementMode.DOOR) {
            return List.of(
                    EditorCapabilities.part(ref -> ref instanceof DungeonSelectionRef.DoorRef doorRef
                            && doorPlacementSource(ctx.activeMap(), doorRef, levelZ)),
                    EditorCapabilities.owner(ref -> ref instanceof DungeonSelectionRef.TransitionRef));
        }
        return List.of(
                EditorCapabilities.owner(ref -> ref instanceof DungeonSelectionRef.TransitionRef),
                EditorCapabilities.partFallback(this::roomFloorRef));
    }

    @Override
    public Node statePaneContent() {
        if (activeTool == null) {
            return null;
        }
        refreshCard();
        statePane.getChildren().setAll(transitionCard);
        if (activeTool == DungeonEditorTool.TRANSITION_CREATE && stairPaneVisible()) {
            renderStairPane();
            statePane.getChildren().add(stairCard);
        }
        return statePane;
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
        transitionPlacementModeBox.setItems(FXCollections.observableArrayList(TransitionPlacementMode.values()));
        transitionPlacementModeBox.setConverter(new javafx.util.StringConverter<>() {
            @Override
            public String toString(TransitionPlacementMode value) {
                return value == null ? "" : value.label;
            }

            @Override
            public TransitionPlacementMode fromString(String string) {
                return null;
            }
        });
        transitionPlacementModeBox.valueProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingTransitionFields) {
                setPlacementMode(newValue);
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

        stairSummaryLabel.setWrapText(true);
        stairAnchorLabel.setWrapText(true);
        stairStatusLabel.setWrapText(true);
        stairStatusLabel.getStyleClass().add("text-muted");
        stairExitLevelField.setPromptText("z");
        stairExitChips.setHgap(6);
        stairExitChips.setVgap(6);
        stairExitChips.setMaxWidth(Double.MAX_VALUE);
        stairFormBox.setFillWidth(true);
        stairFieldsBox.setFillWidth(true);
        stairCard.setFillWidth(true);
        stairActionRow.getStyleClass().add("editor-action-row");
        HBox.setHgrow(stairActionSpacer, Priority.ALWAYS);
        HBox.setHgrow(stairExitLevelField, Priority.ALWAYS);
        stairExitLevelRow.setMaxWidth(Double.MAX_VALUE);
        stairShapeBox.setItems(FXCollections.observableArrayList(StairPathPatternKind.values()));
        stairShapeBox.setConverter(new javafx.util.StringConverter<>() {
            @Override
            public String toString(StairPathPatternKind value) {
                return value == null ? "" : value.label();
            }

            @Override
            public StairPathPatternKind fromString(String string) {
                return null;
            }
        });
        stairDirectionBox.setItems(FXCollections.observableArrayList(CardinalDirection.values()));
        stairDirectionBox.setConverter(new javafx.util.StringConverter<>() {
            @Override
            public String toString(CardinalDirection value) {
                return value == null ? "" : value.label();
            }

            @Override
            public CardinalDirection fromString(String string) {
                return null;
            }
        });
        stairShapeBox.valueProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingStairFields) {
                onStairFieldChanged();
            }
        });
        stairDirectionBox.valueProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingStairFields) {
                onStairFieldChanged();
            }
        });
        stairDimension1Field.textProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingStairFields) {
                onStairFieldChanged();
            }
        });
        stairDimension2Field.textProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingStairFields) {
                onStairFieldChanged();
            }
        });
        stairExitLevelField.setOnAction(event -> addExitLevel());
        stairAddExitButton.setOnAction(event -> addExitLevel());
        stairApplyButton.setOnAction(event -> commitStairDraft());
        stairCancelButton.setOnAction(event -> clearStairDraft(true));
    }

    private void refreshFromMapState() {
        boolean mapChanged = !Objects.equals(previousMapId, mapState.activeMapId());
        previousMapId = mapState.activeMapId();
        if (mapChanged) {
            invalidateDungeonTargetCache();
            clearStairDraft(false);
        }
        if (preparedTransitionId != null
                && mapState.activeMap().preparedTransitions().stream()
                .noneMatch(transition -> transition != null && Objects.equals(transition.transitionId(), preparedTransitionId))) {
            preparedTransitionId = null;
        }
        if (destinationMode == TransitionDestinationMode.DUNGEON && !dungeonTargetMapStillSelectable()) {
            selectedDestination = null;
        }
        if (placementMode == TransitionPlacementMode.STAIR && stairDraftActive()) {
            refreshStairPreview();
        }
        refreshTransitionTargetOptions();
        refreshStatePane();
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
                ? "Gewählt: " + dungeonTargetLabel(selectedTransition)
                : "Übergang anklicken, um zu löschen";
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
        transitionStatusLabel.setText(displayStatus());
    }

    private void syncFields() {
        syncingTransitionFields = true;
        transitionDescriptionArea.setText(description == null ? "" : description);
        transitionDestinationModeBox.setValue(destinationMode);
        transitionPlacementModeBox.setValue(placementMode);
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
        transitionPlacementModeBox.setManaged(creating);
        transitionPlacementModeBox.setVisible(creating);
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

    private boolean handleCreatePressed(EditorToolContext ctx) {
        if (placementMode == TransitionPlacementMode.DOOR) {
            return handleDoorCreatePressed(ctx);
        }
        return handleStairCreatePressed(ctx);
    }

    private boolean handleDoorCreatePressed(EditorToolContext ctx) {
        DungeonMap layout = ctx == null ? null : ctx.activeMap();
        int levelZ = ctx == null || ctx.probe() == null ? mapState.activeProjectionLevel() : ctx.probe().levelZ();
        DungeonSelectionRef sourceRef = ctx == null ? null : ctx.hitRef();
        Long mapId = mapState.activeMapId();
        boolean validSource = sourceRef instanceof DungeonSelectionRef.DoorRef doorRef
                && doorPlacementSource(layout, doorRef, levelZ);
        if (mapId == null || !validSource) {
            return false;
        }
        clearPlacementError();
        state.clearSelection();
        Long selectedPreparedTransitionId = preparedTransitionId;
        boolean placingPrepared = selectedPreparedTransitionId != null && selectedPreparedTransitionId > 0;
        loadingService.submitMutation(
                () -> {
                    if (placingPrepared) {
                        transitionApplicationService.placePrepared(selectedPreparedTransitionId, sourceRef, levelZ);
                    } else {
                        transitionApplicationService.create(mapId, description, selectedDestination, bidirectional, sourceRef, levelZ);
                    }
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> {
                    preparedTransitionId = null;
                    clearStairDraft(false);
                },
                throwable -> {
                    showPlacementError(throwable == null
                            ? defaultCreateFailureMessage(placingPrepared)
                            : throwable.getMessage());
                    UiErrorReporter.reportBackgroundFailure("TransitionTool.handleDoorCreatePressed()", throwable);
                });
        return true;
    }

    private boolean handleStairCreatePressed(EditorToolContext ctx) {
        DungeonSelectionRef hit = ctx == null ? null : ctx.hitRef();
        if (!(hit instanceof DungeonSelectionRef.FloorCellRef floorCellRef)) {
            return false;
        }
        clearPlacementError();
        state.clearSelection();
        startStairDraft(floorCellRef.cell(), floorCellRef.cell().z());
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

    private DungeonSelectionRef roomFloorRef(EditorToolContext ctx) {
        if (ctx == null || ctx.probe() == null || ctx.activeMap() == null) {
            return null;
        }
        GridPoint cell = ctx.probe().gridCell();
        int levelZ = ctx.probe().levelZ();
        return roomWithFloorAtCell(ctx.activeMap(), cell, levelZ) == null
                ? null
                : new DungeonSelectionRef.FloorCellRef(GridPoint.cell(cell.x2() / 2, cell.y2() / 2, levelZ));
    }

    private static Room roomWithFloorAtCell(DungeonMap layout, GridPoint cell, int levelZ) {
        Cluster cluster = layout == null || cell == null ? null : layout.clusterAtCell(cell, levelZ);
        Room room = cluster == null ? null : cluster.roomTopology().roomAt(cell, levelZ);
        return room != null && cluster.roomTopology().structureFor(room).surfaceAtLevel(levelZ).floor().contains(cell)
                ? room
                : null;
    }

    private void renderStairPane() {
        TransitionStairDraftResolution resolution = resolveCurrentStairDraft(true);
        stairSummaryLabel.setText(stairSummaryText());
        stairAnchorLabel.setText(stairAnchorText());
        StairPathPatternKind shapeKind = currentStairShape();
        updateStairFieldLayout(shapeKind);
        renderExitChips();
        stairApplyButton.setDisable(stairAnchorCell == null || !placementReadyForCommit());
        stairCancelButton.setDisable(!stairDraftActive());
        stairStatusLabel.setText(stairStatusText(resolution));
    }

    private void startStairDraft(GridPoint cell, int levelZ) {
        stairAnchorCell = cell;
        stairAnchorLevelZ = levelZ;
        stairDraftDirty = true;
        stairStopLevels.clear();
        stairStopLevels.add(levelZ);
        clearStairStatusOverride();
        syncingStairFields = true;
        stairShapeBox.setValue(StairPathPatternKind.STACK);
        stairDirectionBox.setValue(CardinalDirection.defaultDirection());
        stairDimension1Field.setText("2");
        stairDimension2Field.setText("2");
        stairExitLevelField.clear();
        syncingStairFields = false;
        refreshStairPreview();
        refreshStatePane();
    }

    private void clearStairDraft(boolean refresh) {
        stairAnchorCell = null;
        stairAnchorLevelZ = null;
        stairDraftDirty = false;
        stairStopLevels.clear();
        clearStairStatusOverride();
        syncingStairFields = true;
        stairShapeBox.setValue(StairPathPatternKind.STACK);
        stairDirectionBox.setValue(CardinalDirection.defaultDirection());
        stairDimension1Field.setText("2");
        stairDimension2Field.setText("2");
        stairExitLevelField.clear();
        syncingStairFields = false;
        state.clearPreview();
        if (refresh) {
            refreshStatePane();
        }
    }

    private void refreshStairPreview() {
        if (activeTool != DungeonEditorTool.TRANSITION_CREATE || !stairDraftActive()) {
            state.clearPreview();
            return;
        }
        TransitionStairDraftResolution resolution = resolveCurrentStairDraft(true);
        DungeonConnection localConnection = resolution.localConnection();
        if (localConnection == null) {
            state.clearPreview();
            return;
        }
        DungeonTransition previewTransition = previewTransitionForConnection(localConnection);
        if (previewTransition == null) {
            state.clearPreview();
            return;
        }
        DungeonMap layout = mapState.activeMap();
        DungeonMap previewLayout = previewTransition.transitionId() == null
                ? mapApplicationService.previewAddedTransition(new PreviewAddedTransitionRequest(layout, previewTransition))
                : mapApplicationService.previewReplacedTransition(new PreviewReplacedTransitionRequest(layout, previewTransition));
        state.showPreview(new EditorPreview.LayoutPreview(previewLayout));
    }

    private void commitStairDraft() {
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        TransitionStairDraftResolution resolution = resolveCurrentStairDraft(false);
        if (resolution.draft() == null) {
            stairStatusOverride = resolution.validationMessage();
            refreshStatePane();
            return;
        }
        Long selectedPreparedTransitionId = preparedTransitionId;
        boolean placingPrepared = selectedPreparedTransitionId != null && selectedPreparedTransitionId > 0;
        clearStairStatusOverride();
        clearPlacementError();
        loadingService.submitMutation(
                () -> {
                    if (placingPrepared) {
                        transitionApplicationService.placePreparedStair(selectedPreparedTransitionId, resolution.draft());
                    } else {
                        transitionApplicationService.createStair(mapId, description, selectedDestination, bidirectional, resolution.draft());
                    }
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> {
                    preparedTransitionId = null;
                    clearStairDraft(false);
                },
                throwable -> {
                    stairStatusOverride = throwable == null || throwable.getMessage() == null
                            ? defaultCreateFailureMessage(placingPrepared)
                            : throwable.getMessage();
                    UiErrorReporter.reportBackgroundFailure("TransitionTool.commitStairDraft()", throwable);
                    refreshStatePane();
                });
    }

    private TransitionStairDraftResolution resolveCurrentStairDraft(boolean allowSingleStop) {
        if (stairAnchorCell == null || stairAnchorLevelZ == null) {
            return new TransitionStairDraftResolution(null, null, "Raum-Floor-Tile anklicken.");
        }
        StairPathPatternKind shape = currentStairShape();
        CardinalDirection direction = currentDirection();
        int dimension1 = resolvedDimension(stairDimension1Field.getText());
        int dimension2 = resolvedDimension(stairDimension2Field.getText());
        StairPathPatternSpec shapeSpec = new StairPathPatternSpec(shape, direction, dimension1, dimension2);
        LinkedHashSet<Integer> stopLevels = stairStopLevels.stream()
                .filter(Objects::nonNull)
                .sorted()
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        stopLevels.add(stairAnchorLevelZ);
        int minLevel = stopLevels.stream().min(Integer::compareTo).orElse(stairAnchorLevelZ);
        int maxLevel = stopLevels.stream().max(Integer::compareTo).orElse(stairAnchorLevelZ);
        DungeonStairApplicationService.StairDraft draft = new DungeonStairApplicationService.StairDraft(
                null,
                stairAnchorCell,
                stairAnchorLevelZ,
                shapeSpec,
                minLevel,
                maxLevel,
                stopLevels);
        Long mapId = mapState.activeMapId();
        DungeonMap layout = mapState.activeMap();
        if (mapId == null || layout == null) {
            return new TransitionStairDraftResolution(null, null, "Kein aktiver Dungeon geladen");
        }
        try {
            DungeonConnection localConnection = TransitionConnectionBuilder.buildStairConnection(
                    layout,
                    mapId,
                    preparedTransitionId,
                    draft,
                    allowSingleStop,
                    preparedTransitionId);
            String status = stopLevels.size() < 2
                    ? "Mindestens einen weiteren Exit hinzufügen"
                    : "Zum Speichern Übernehmen.";
            return new TransitionStairDraftResolution(draft, localConnection, status);
        } catch (IllegalArgumentException ex) {
            return new TransitionStairDraftResolution(null, null, ex.getMessage());
        }
    }

    private DungeonTransition previewTransitionForConnection(DungeonConnection localConnection) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || localConnection == null) {
            return null;
        }
        DungeonTransition base = preparedTransition();
        return new DungeonTransition(
                base == null ? null : base.transitionId(),
                mapId,
                base == null ? description : base.description(),
                localConnection,
                base == null ? selectedDestination : base.destination(),
                base == null ? null : base.linkedTransitionId(),
                base == null ? null : base.stairPlacementSpec());
    }

    private DungeonTransition preparedTransition() {
        return preparedTransitionId == null ? null : mapState.activeMap().findTransition(preparedTransitionId);
    }

    private boolean stairDraftActive() {
        return stairAnchorCell != null && stairAnchorLevelZ != null;
    }

    private boolean stairPaneVisible() {
        return placementMode == TransitionPlacementMode.STAIR || stairDraftActive();
    }

    private void onStairFieldChanged() {
        clearStairStatusOverride();
        if (!stairDraftActive()) {
            refreshStatePane();
            return;
        }
        stairDraftDirty = true;
        refreshStairPreview();
        refreshStatePane();
    }

    private void addExitLevel() {
        clearStairStatusOverride();
        if (!stairDraftActive()) {
            refreshStatePane();
            return;
        }
        Integer level = parseInteger(stairExitLevelField.getText());
        if (level == null) {
            stairStatusOverride = "Exit-Level ist ungültig";
            refreshStatePane();
            return;
        }
        if (!stairStopLevels.add(level)) {
            stairStatusOverride = "Exit z=" + level + " ist bereits vorhanden";
            refreshStatePane();
            return;
        }
        stairExitLevelField.clear();
        stairDraftDirty = true;
        refreshStairPreview();
        refreshStatePane();
    }

    private void renderExitChips() {
        stairExitChips.getChildren().clear();
        for (Integer level : stairStopLevels.stream().filter(Objects::nonNull).sorted().toList()) {
            boolean anchorLevel = Objects.equals(stairAnchorLevelZ, level);
            HBox chip = new HBox(2);
            chip.getStyleClass().addAll("chip", anchorLevel ? "chip-type" : "chip-cr");
            Label label = new Label(anchorLevel ? "z=" + level + " · Anker" : "z=" + level);
            chip.getChildren().add(label);
            if (!anchorLevel) {
                Button remove = new Button("\u00d7");
                remove.getStyleClass().addAll("flat", "compact", "chip-remove-btn");
                remove.setAccessibleText("Entfernen: Exit z=" + level);
                remove.setOnMouseClicked(event -> event.consume());
                remove.setOnAction(event -> removeExitLevel(level));
                chip.getChildren().add(remove);
            }
            stairExitChips.getChildren().add(chip);
        }
    }

    private void removeExitLevel(int level) {
        clearStairStatusOverride();
        if (Objects.equals(stairAnchorLevelZ, level)) {
            refreshStatePane();
            return;
        }
        if (!stairStopLevels.remove(level)) {
            refreshStatePane();
            return;
        }
        stairDraftDirty = true;
        refreshStairPreview();
        refreshStatePane();
    }

    private void updateStairFieldLayout(StairPathPatternKind shape) {
        StairPathPatternKind resolvedShape = shape == null ? StairPathPatternKind.STACK : shape;
        boolean showDirection = resolvedShape.needsDirection();
        boolean showDimension1 = resolvedShape.needsParameter1();
        boolean showDimension2 = resolvedShape.needsParameter2();
        stairDimension1Label.setText(showDimension1 ? resolvedShape.parameter1Label() : "");
        stairDimension2Label.setText(showDimension2 ? resolvedShape.parameter2Label() : "");
        setNodeVisibility(stairDirectionBlock, showDirection);
        setNodeVisibility(stairDimension1Block, showDimension1);
        setNodeVisibility(stairDimension2Block, showDimension2);
        setNodeVisibility(stairDirectionDimensionRow, showDirection || showDimension1);
        setNodeVisibility(stairDimension2Row, showDimension2);
        stairDimension1Field.setPromptText(showDimension1 ? stairDimension1Label.getText() : "");
        stairDimension2Field.setPromptText(showDimension2 ? stairDimension2Label.getText() : "");
    }

    private StairPathPatternKind currentStairShape() {
        StairPathPatternKind shape = stairShapeBox.getValue();
        return shape == null ? StairPathPatternKind.STACK : shape;
    }

    private CardinalDirection currentDirection() {
        CardinalDirection direction = stairDirectionBox.getValue();
        return direction == null ? CardinalDirection.defaultDirection() : direction;
    }

    private String stairSummaryText() {
        return preparedTransitionId != null
                ? "Vorbereitet: Übergang " + preparedTransitionId + " als Treppe"
                : "Neue Übergangstreppe";
    }

    private String stairAnchorText() {
        if (stairAnchorCell == null || stairAnchorLevelZ == null) {
            return "Kein Treppenanker";
        }
        return "Anker: z=" + stairAnchorLevelZ + " · " + (stairAnchorCell.x2() / 2) + "," + (stairAnchorCell.y2() / 2);
    }

    private String stairStatusText(TransitionStairDraftResolution resolution) {
        if (stairStatusOverride != null && !stairStatusOverride.isBlank()) {
            return stairStatusOverride;
        }
        return resolution.validationMessage();
    }

    private void clearStairStatusOverride() {
        stairStatusOverride = null;
    }

    private boolean placementReadyForCommit() {
        if (preparedTransitionId != null && preparedTransitionId > 0) {
            return true;
        }
        if (destinationMode == TransitionDestinationMode.OVERWORLD) {
            return selectedDestination instanceof DungeonTransitionDestination.OverworldTileDestination;
        }
        if (!(selectedDestination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon)) {
            return false;
        }
        return bidirectional || dungeon.transitionId() != null;
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
            case OVERWORLD -> placementMode == TransitionPlacementMode.DOOR
                    ? "Overworld-Tür"
                    : "Overworld-Treppe";
            case DUNGEON -> {
                String base = placementMode == TransitionPlacementMode.DOOR ? "Dungeon-Tür" : "Dungeon-Treppe";
                yield bidirectional ? base + " (zweiseitig)" : base;
            }
        };
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

    private void setPlacementMode(TransitionPlacementMode placementMode) {
        TransitionPlacementMode next = placementMode == null ? TransitionPlacementMode.DOOR : placementMode;
        if (this.placementMode == next) {
            return;
        }
        this.placementMode = next;
        clearPlacementError();
        if (next != TransitionPlacementMode.STAIR) {
            clearStairDraft(false);
        }
        refreshStatePane();
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

    private String displayStatus() {
        if (placementError != null && !placementError.isBlank()) {
            return placementError;
        }
        if (activeTool == DungeonEditorTool.TRANSITION_DELETE) {
            return transitionSummaryLabel.getText();
        }
        if (placementMode == TransitionPlacementMode.STAIR && stairDraftActive()) {
            return stairStatusText(resolveCurrentStairDraft(true));
        }
        Long targetMapId = selectedDungeonMapId();
        String targetState = switch (destinationMode) {
            case OVERWORLD -> selectedDestination instanceof DungeonTransitionDestination.OverworldTileDestination
                    ? null
                    : "Overworld-Ziel wählen";
            case DUNGEON -> targetMapId == null || targetMapId <= 0
                    ? "Zielkarte wählen"
                    : bidirectional || hasSelectedDungeonTarget()
                    ? null
                    : "Ziel-Übergang wählen";
        };
        if (targetState != null) {
            return targetState;
        }
        if (placementMode == TransitionPlacementMode.DOOR) {
            return preparedTransitionId != null
                    ? "Tür anklicken"
                    : "Tür anklicken";
        }
        return stairDraftActive()
                ? stairStatusText(resolveCurrentStairDraft(true))
                : "Raum-Floor-Tile anklicken";
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

    private boolean hasSelectedDungeonTarget() {
        return selectedDestination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon
                && dungeon.transitionId() != null
                && dungeon.transitionId() > 0;
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

    private static boolean doorPlacementSource(
            DungeonMap layout,
            DungeonSelectionRef.DoorRef doorRef,
            int levelZ
    ) {
        DoorDescription description = layout == null || doorRef == null
                ? null
                : layout.describeDoor(doorRef);
        return description != null
                && description.levelZ() == levelZ
                && description.supportsTransitionPlacement();
    }

    private void refreshStatePane() {
        refreshCallback.run();
    }

    private static DungeonTransitionDestination.DungeonMapDestination dungeonDestination(Long targetMapId, Long transitionId) {
        return targetMapId == null ? null : new DungeonTransitionDestination.DungeonMapDestination(targetMapId, transitionId);
    }

    private static DungeonSelectionRef.TransitionRef selectedTransitionRef(DungeonSelectionRef ref) {
        return ref instanceof DungeonSelectionRef.TransitionRef transitionRef
                ? transitionRef
                : null;
    }

    private static String dungeonTargetLabel(DungeonTransition transition) {
        if (transition == null) {
            return "";
        }
        StringBuilder label = new StringBuilder(transition.label());
        if (transition.description() != null && !transition.description().isBlank()) {
            label.append(" · ").append(transition.description());
        }
        if (transition.localConnection() != null && transition.localConnection().doorCarrier() != null) {
            label.append(" · Tür");
        } else if (transition.localConnection() != null && transition.localConnection().stairCarrier() != null) {
            label.append(" · Treppe");
            label.append(" · z=").append(transition.localConnection().stairCarrier().anchorLevelZ());
        }
        return label.toString();
    }

    private static int resolvedDimension(String value) {
        Integer parsed = parseInteger(value);
        return parsed == null ? 0 : parsed;
    }

    private static Integer parseInteger(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static VBox fieldBlock(Label label, Node field) {
        VBox block = new VBox(3, label, field);
        block.setFillWidth(true);
        block.setMaxWidth(Double.MAX_VALUE);
        block.setMinWidth(0);
        HBox.setHgrow(block, Priority.ALWAYS);
        configureGrowingRegion(field);
        return block;
    }

    private static HBox fieldRow(Node... blocks) {
        HBox row = new HBox(8);
        row.setFillHeight(true);
        row.setMaxWidth(Double.MAX_VALUE);
        row.setMinWidth(0);
        for (Node block : blocks) {
            if (block == null) {
                continue;
            }
            if (block instanceof Region region) {
                region.setMaxWidth(Double.MAX_VALUE);
                region.setMinWidth(0);
            }
            HBox.setHgrow(block, Priority.ALWAYS);
            row.getChildren().add(block);
        }
        return row;
    }

    private static void setNodeVisibility(Node node, boolean visible) {
        if (node == null) {
            return;
        }
        node.setManaged(visible);
        node.setVisible(visible);
    }

    private static void configureGrowingRegion(Node node) {
        if (!(node instanceof Region region)) {
            return;
        }
        region.setMaxWidth(Double.MAX_VALUE);
        region.setMinWidth(0);
    }

    private static Label fieldLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-muted");
        label.setWrapText(true);
        label.setMaxWidth(Double.MAX_VALUE);
        label.setMinWidth(0);
        return label;
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

    private enum TransitionPlacementMode {
        DOOR("Tür"),
        STAIR("Treppe");

        private final String label;

        TransitionPlacementMode(String label) {
            this.label = label;
        }
    }

    private record PreparedTransitionCard(long transitionId, String label) {
    }

    private record TransitionStairDraftResolution(
            DungeonStairApplicationService.StairDraft draft,
            DungeonConnection localConnection,
            String validationMessage
    ) {
        private TransitionStairDraftResolution {
            validationMessage = validationMessage == null ? "" : validationMessage;
        }
    }
}
