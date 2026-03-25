package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.application.transition.DungeonTransitionEditRequest;
import features.world.dungeonmap.application.transition.DungeonTransitionTargetSummary;
import features.world.dungeonmap.loading.DungeonMapCatalogEntry;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.stair.StairShape;
import features.world.dungeonmap.model.structures.room.RoomExitNarration;
import features.world.dungeonmap.model.structures.room.RoomNarration;
import features.world.api.OverworldTransitionTargetSummary;
import javafx.collections.FXCollections;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.IntConsumer;

public final class DungeonEditorStatePane {

    private final VBox content = new VBox();
    private final Label activeToolLabel = new Label(DungeonEditorTool.SELECT.label());
    private final Label stairSummaryLabel = new Label("Keine Treppe gewählt");
    private final ComboBox<StairShape> stairShapeBox = new ComboBox<>();
    private final FlowPane stairDirectionButtons = new FlowPane();
    private final Button stairNorthButton = new Button("N");
    private final Button stairEastButton = new Button("O");
    private final Button stairSouthButton = new Button("S");
    private final Button stairWestButton = new Button("W");
    private final TextField stairDimension1Field = new TextField();
    private final TextField stairDimension2Field = new TextField();
    private final Label stairDimension1Label = new Label("Maß 1");
    private final Label stairDimension2Label = new Label("Maß 2");
    private final HBox stairDimension1Row = new HBox(6, stairDimension1Label, stairDimension1Field);
    private final HBox stairDimension2Row = new HBox(6, stairDimension2Label, stairDimension2Field);
    private final TextField stairInputField = new TextField();
    private final Button stairLevelDownButton = new Button("-");
    private final Button stairLevelUpButton = new Button("+");
    private final Button stairAddButton = new Button("Hinzufügen");
    private final FlowPane stairExitTokens = new FlowPane();
    private final Label stairStatusLabel = new Label();
    private final HBox stairInputRow = new HBox(6, stairInputField, stairLevelDownButton, stairLevelUpButton, stairAddButton);
    private final VBox stairEditorContent = new VBox(
            6,
            stairShapeBox,
            stairDirectionButtons,
            stairDimension1Row,
            stairDimension2Row,
            stairInputRow,
            stairExitTokens);
    private final VBox stairCard = card("Treppen-Ausgänge", stairSummaryLabel, stairEditorContent, stairStatusLabel);
    private final TextArea transitionDescriptionArea = new TextArea();
    private final ComboBox<DungeonTransitionEditRequest.DestinationType> transitionDestinationTypeBox = new ComboBox<>();
    private final CheckBox transitionBidirectionalBox = new CheckBox("Zweiseitig");
    private final ComboBox<DungeonMapCatalogEntry> transitionTargetMapBox = new ComboBox<>();
    private final ComboBox<DungeonTransitionTargetSummary> transitionTargetTransitionBox = new ComboBox<>();
    private final ComboBox<OverworldTransitionTargetSummary> transitionTargetOverworldBox = new ComboBox<>();
    private final FlowPane preparedTransitionButtons = new FlowPane();
    private final Label transitionSummaryLabel = new Label("Kein Übergang gewählt");
    private final Label transitionStatusLabel = new Label();
    private final VBox transitionCard = card(
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
    private final VBox narrationContent = new VBox(8);
    private final VBox narrationCard = card("Raumbeschreibung", narrationContent);
    private final Map<Long, Button> narrationSaveButtons = new LinkedHashMap<>();
    private final Map<Long, Label> narrationStatusLabels = new LinkedHashMap<>();
    private IntConsumer onStairInputLevelChanged = level -> { };
    private Runnable onStairLevelDecrementRequested = () -> { };
    private Runnable onStairLevelIncrementRequested = () -> { };
    private Runnable onStairAddRequested = () -> { };
    private IntConsumer onStairExitRemoveRequested = level -> { };
    private Consumer<StairShape> onStairShapeChanged = value -> { };
    private Consumer<CardinalDirection> onStairDirectionChanged = value -> { };
    private IntConsumer onStairDimension1Changed = value -> { };
    private IntConsumer onStairDimension2Changed = value -> { };
    private Consumer<String> onTransitionDescriptionChanged = value -> { };
    private Consumer<DungeonTransitionEditRequest.DestinationType> onTransitionDestinationTypeChanged = value -> { };
    private Consumer<Boolean> onTransitionBidirectionalChanged = value -> { };
    private Consumer<Long> onTransitionTargetMapChanged = value -> { };
    private Consumer<Long> onTransitionTargetTransitionChanged = value -> { };
    private Consumer<OverworldTransitionTargetSummary> onTransitionTargetOverworldChanged = value -> { };
    private Consumer<Long> onPreparedTransitionSelected = value -> { };
    private boolean syncingStairInput;
    private boolean syncingStairShape;
    private boolean syncingStairDimensions;
    private boolean syncingTransitionFields;
    private Node toolStateContent;

    public DungeonEditorStatePane() {
        content.getStyleClass().add("dungeon-editor-sidebar");
        content.getChildren().add(card("Werkzeug", activeToolLabel));
        stairInputField.setTextFormatter(new TextFormatter<>(change ->
                change.getControlNewText().matches("-?\\d*") ? change : null));
        stairDimension1Field.setTextFormatter(new TextFormatter<>(change ->
                change.getControlNewText().matches("-?\\d*") ? change : null));
        stairDimension2Field.setTextFormatter(new TextFormatter<>(change ->
                change.getControlNewText().matches("-?\\d*") ? change : null));
        stairInputField.setPrefColumnCount(4);
        stairInputField.setMaxWidth(70);
        stairDimension1Field.setPrefColumnCount(4);
        stairDimension1Field.setMaxWidth(70);
        stairDimension2Field.setPrefColumnCount(4);
        stairDimension2Field.setMaxWidth(70);
        stairLevelDownButton.getStyleClass().add("compact");
        stairLevelUpButton.getStyleClass().add("compact");
        stairShapeBox.setItems(FXCollections.observableArrayList(StairShape.values()));
        stairShapeBox.setConverter(new javafx.util.StringConverter<>() {
            @Override
            public String toString(StairShape value) {
                return value == null ? "" : value.label();
            }

            @Override
            public StairShape fromString(String string) {
                return null;
            }
        });
        stairShapeBox.valueProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingStairShape) {
                onStairShapeChanged.accept(newValue);
            }
        });
        stairInputField.textProperty().addListener((obs, oldValue, newValue) -> handleStairInputChanged(newValue));
        stairDimension1Field.textProperty().addListener((obs, oldValue, newValue) ->
                handleStairDimensionChanged(newValue, onStairDimension1Changed));
        stairDimension2Field.textProperty().addListener((obs, oldValue, newValue) ->
                handleStairDimensionChanged(newValue, onStairDimension2Changed));
        stairInputField.setOnAction(event -> onStairAddRequested.run());
        stairDimension1Field.setOnAction(event -> handleStairDimensionChanged(stairDimension1Field.getText(), onStairDimension1Changed));
        stairDimension2Field.setOnAction(event -> handleStairDimensionChanged(stairDimension2Field.getText(), onStairDimension2Changed));
        stairLevelDownButton.setOnAction(event -> onStairLevelDecrementRequested.run());
        stairLevelUpButton.setOnAction(event -> onStairLevelIncrementRequested.run());
        stairAddButton.setOnAction(event -> onStairAddRequested.run());
        stairInputRow.setAlignment(Pos.CENTER_LEFT);
        stairDimension1Row.setAlignment(Pos.CENTER_LEFT);
        stairDimension2Row.setAlignment(Pos.CENTER_LEFT);
        configureDirectionButton(stairNorthButton, CardinalDirection.NORTH);
        configureDirectionButton(stairEastButton, CardinalDirection.EAST);
        configureDirectionButton(stairSouthButton, CardinalDirection.SOUTH);
        configureDirectionButton(stairWestButton, CardinalDirection.WEST);
        stairDirectionButtons.setHgap(6);
        stairDirectionButtons.setVgap(6);
        stairDirectionButtons.getChildren().setAll(stairNorthButton, stairEastButton, stairSouthButton, stairWestButton);
        stairExitTokens.setHgap(6);
        stairExitTokens.setVgap(6);
        stairStatusLabel.setWrapText(true);
        transitionDescriptionArea.setPromptText("Beschreibung");
        transitionDescriptionArea.setWrapText(true);
        transitionDescriptionArea.setPrefRowCount(3);
        transitionTargetTransitionBox.setPromptText("Ziel-Übergang");
        transitionTargetOverworldBox.setPromptText("Overworld-Ziel");
        transitionDestinationTypeBox.setItems(FXCollections.observableArrayList(DungeonTransitionEditRequest.DestinationType.values()));
        transitionDestinationTypeBox.valueProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingTransitionFields) {
                onTransitionDestinationTypeChanged.accept(newValue);
            }
        });
        transitionBidirectionalBox.selectedProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingTransitionFields) {
                onTransitionBidirectionalChanged.accept(Boolean.TRUE.equals(newValue));
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
                onTransitionTargetMapChanged.accept(newValue == null ? null : newValue.mapId());
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
                onTransitionTargetTransitionChanged.accept(newValue == null ? null : newValue.transitionId());
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
                onTransitionTargetOverworldChanged.accept(newValue);
            }
        });
        transitionDescriptionArea.textProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncingTransitionFields) {
                onTransitionDescriptionChanged.accept(newValue);
            }
        });
        preparedTransitionButtons.setHgap(6);
        preparedTransitionButtons.setVgap(6);
        transitionStatusLabel.setWrapText(true);
        showStairDraft(null);
        showTransitionDraft(null);
        showRoomNarrationEditors(List.of(), null);
    }

    public Node content() {
        return content;
    }

    public void refresh(DungeonEditorTool activeTool) {
        refresh(activeTool, null);
    }

    public void refresh(DungeonEditorTool activeTool, Node extraContent) {
        DungeonEditorTool shownTool = activeTool == null ? DungeonEditorTool.SELECT : activeTool;
        activeToolLabel.setText(shownTool.label());
        if (toolStateContent != null) {
            content.getChildren().remove(toolStateContent);
        }
        toolStateContent = extraContent;
        if (toolStateContent != null && !content.getChildren().contains(toolStateContent)) {
            content.getChildren().add(1, toolStateContent);
        }
    }

    public void setOnStairInputLevelChanged(IntConsumer onStairInputLevelChanged) {
        this.onStairInputLevelChanged = onStairInputLevelChanged == null ? level -> { } : onStairInputLevelChanged;
    }

    public void setOnStairLevelDecrementRequested(Runnable onStairLevelDecrementRequested) {
        this.onStairLevelDecrementRequested = onStairLevelDecrementRequested == null ? () -> { } : onStairLevelDecrementRequested;
    }

    public void setOnStairLevelIncrementRequested(Runnable onStairLevelIncrementRequested) {
        this.onStairLevelIncrementRequested = onStairLevelIncrementRequested == null ? () -> { } : onStairLevelIncrementRequested;
    }

    public void setOnStairAddRequested(Runnable onStairAddRequested) {
        this.onStairAddRequested = onStairAddRequested == null ? () -> { } : onStairAddRequested;
    }

    public void setOnStairExitRemoveRequested(IntConsumer onStairExitRemoveRequested) {
        this.onStairExitRemoveRequested = onStairExitRemoveRequested == null ? level -> { } : onStairExitRemoveRequested;
    }

    public void setOnStairShapeChanged(Consumer<StairShape> onStairShapeChanged) {
        this.onStairShapeChanged = onStairShapeChanged == null ? value -> { } : onStairShapeChanged;
    }

    public void setOnStairDirectionChanged(Consumer<CardinalDirection> onStairDirectionChanged) {
        this.onStairDirectionChanged = onStairDirectionChanged == null ? value -> { } : onStairDirectionChanged;
    }

    public void setOnStairDimension1Changed(IntConsumer onStairDimension1Changed) {
        this.onStairDimension1Changed = onStairDimension1Changed == null ? value -> { } : onStairDimension1Changed;
    }

    public void setOnStairDimension2Changed(IntConsumer onStairDimension2Changed) {
        this.onStairDimension2Changed = onStairDimension2Changed == null ? value -> { } : onStairDimension2Changed;
    }

    public void setOnTransitionDescriptionChanged(Consumer<String> onTransitionDescriptionChanged) {
        this.onTransitionDescriptionChanged = onTransitionDescriptionChanged == null ? value -> { } : onTransitionDescriptionChanged;
    }

    public void setOnTransitionDestinationTypeChanged(Consumer<DungeonTransitionEditRequest.DestinationType> onTransitionDestinationTypeChanged) {
        this.onTransitionDestinationTypeChanged = onTransitionDestinationTypeChanged == null ? value -> { } : onTransitionDestinationTypeChanged;
    }

    public void setOnTransitionBidirectionalChanged(Consumer<Boolean> onTransitionBidirectionalChanged) {
        this.onTransitionBidirectionalChanged = onTransitionBidirectionalChanged == null ? value -> { } : onTransitionBidirectionalChanged;
    }

    public void setOnTransitionTargetMapChanged(Consumer<Long> onTransitionTargetMapChanged) {
        this.onTransitionTargetMapChanged = onTransitionTargetMapChanged == null ? value -> { } : onTransitionTargetMapChanged;
    }

    public void setOnTransitionTargetTransitionChanged(Consumer<Long> onTransitionTargetTransitionChanged) {
        this.onTransitionTargetTransitionChanged = onTransitionTargetTransitionChanged == null ? value -> { } : onTransitionTargetTransitionChanged;
    }

    public void setOnTransitionTargetOverworldChanged(Consumer<OverworldTransitionTargetSummary> onTransitionTargetOverworldChanged) {
        this.onTransitionTargetOverworldChanged = onTransitionTargetOverworldChanged == null ? value -> { } : onTransitionTargetOverworldChanged;
    }

    public void setOnPreparedTransitionSelected(Consumer<Long> onPreparedTransitionSelected) {
        this.onPreparedTransitionSelected = onPreparedTransitionSelected == null ? value -> { } : onPreparedTransitionSelected;
    }

    public void showStairDraft(StairDraftCard card) {
        if (card == null) {
            content.getChildren().remove(stairCard);
            stairSummaryLabel.setText("Keine Treppe gewählt");
            stairStatusLabel.setText("");
            syncStairInput(null);
            syncStairShape(null, CardinalDirection.defaultDirection());
            syncStairDimensions(null, null);
            stairExitTokens.getChildren().clear();
            return;
        }
        stairSummaryLabel.setText(card.editable() ? "Aktuelle Ebene als Ausgang hinzufügen" : card.statusMessage());
        stairEditorContent.setManaged(card.editable());
        stairEditorContent.setVisible(card.editable());
        stairStatusLabel.setText(card.editable() ? blankToEmpty(card.statusMessage()) : "");
        stairLevelDownButton.setDisable(!card.editable());
        stairLevelUpButton.setDisable(!card.editable());
        stairInputField.setDisable(!card.editable());
        stairAddButton.setDisable(!card.editable());
        stairShapeBox.setDisable(!card.editable());
        syncStairShape(card.shape(), card.direction());
        syncStairDimensions(card.dimension1(), card.dimension2());
        updateStairShapeVisibility(card.shape(), card.editable());
        syncStairInput(card.inputLevel());
        renderStairTokens(card.exitLevels());
        if (!content.getChildren().contains(stairCard)) {
            content.getChildren().add(1, stairCard);
        }
    }

    public void showTransitionDraft(TransitionDraftCard card) {
        if (card == null) {
            content.getChildren().remove(transitionCard);
            transitionSummaryLabel.setText("Kein Übergang gewählt");
            transitionStatusLabel.setText("");
            preparedTransitionButtons.getChildren().clear();
            return;
        }
        transitionSummaryLabel.setText(card.summary());
        syncingTransitionFields = true;
        transitionDescriptionArea.setText(card.description() == null ? "" : card.description());
        transitionDestinationTypeBox.setValue(card.destinationType());
        transitionBidirectionalBox.setSelected(card.bidirectional());
        transitionTargetMapBox.setItems(FXCollections.observableArrayList(card.maps()));
        DungeonMapCatalogEntry selectedMap = card.maps().stream()
                .filter(map -> map != null && Objects.equals(map.mapId(), card.targetDungeonMapId()))
                .findFirst()
                .orElse(null);
        transitionTargetMapBox.setValue(selectedMap);
        transitionTargetTransitionBox.setItems(FXCollections.observableArrayList(card.targetTransitions()));
        DungeonTransitionTargetSummary selectedTransition = card.targetTransitions().stream()
                .filter(target -> target != null && Objects.equals(target.transitionId(), card.targetTransitionId()))
                .findFirst()
                .orElse(null);
        transitionTargetTransitionBox.setValue(selectedTransition);
        transitionTargetOverworldBox.setItems(FXCollections.observableArrayList(card.overworldTargets()));
        OverworldTransitionTargetSummary selectedOverworldTarget = card.overworldTargets().stream()
                .filter(target -> target != null
                        && target.mapId() == (card.targetOverworldMapId() == null ? -1L : card.targetOverworldMapId())
                        && target.tileId() == (card.targetOverworldTileId() == null ? -1L : card.targetOverworldTileId()))
                .findFirst()
                .orElse(null);
        transitionTargetOverworldBox.setValue(selectedOverworldTarget);
        syncingTransitionFields = false;
        transitionTargetMapBox.setVisible(card.destinationType() == DungeonTransitionEditRequest.DestinationType.DUNGEON_MAP);
        transitionTargetMapBox.setManaged(card.destinationType() == DungeonTransitionEditRequest.DestinationType.DUNGEON_MAP);
        transitionBidirectionalBox.setVisible(card.destinationType() == DungeonTransitionEditRequest.DestinationType.DUNGEON_MAP);
        transitionBidirectionalBox.setManaged(card.destinationType() == DungeonTransitionEditRequest.DestinationType.DUNGEON_MAP);
        transitionTargetTransitionBox.setVisible(card.destinationType() == DungeonTransitionEditRequest.DestinationType.DUNGEON_MAP && !card.bidirectional());
        transitionTargetTransitionBox.setManaged(card.destinationType() == DungeonTransitionEditRequest.DestinationType.DUNGEON_MAP && !card.bidirectional());
        transitionTargetOverworldBox.setVisible(card.destinationType() == DungeonTransitionEditRequest.DestinationType.OVERWORLD_TILE);
        transitionTargetOverworldBox.setManaged(card.destinationType() == DungeonTransitionEditRequest.DestinationType.OVERWORLD_TILE);
        renderPreparedTransitionButtons(card.preparedTransitions(), card.preparedTransitionId());
        transitionStatusLabel.setText(blankToEmpty(card.statusMessage()));
        if (!content.getChildren().contains(transitionCard)) {
            content.getChildren().add(1, transitionCard);
        }
    }

    public void showRoomNarrationEditors(List<RoomNarrationCard> cards, SaveRoomNarrationHandler saveHandler) {
        narrationContent.getChildren().clear();
        narrationSaveButtons.clear();
        narrationStatusLabels.clear();
        if (cards == null || cards.isEmpty()) {
            content.getChildren().remove(narrationCard);
            return;
        }
        if (!content.getChildren().contains(narrationCard)) {
            content.getChildren().add(narrationCard);
        }
        for (RoomNarrationCard card : cards) {
            if (card != null) {
                narrationContent.getChildren().add(buildNarrationCardUi(card, saveHandler));
            }
        }
    }

    public void setRoomNarrationSaveState(Long roomId, boolean busy, String status) {
        Button saveButton = narrationSaveButtons.get(roomId);
        if (saveButton != null) {
            saveButton.setDisable(busy);
            saveButton.setText(busy ? "Speichert..." : "Speichern");
        }
        Label statusLabel = narrationStatusLabels.get(roomId);
        if (statusLabel != null) {
            statusLabel.setText(status == null ? "" : status);
        }
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

    private static TextArea createTextArea(String text) {
        TextArea area = new TextArea(text == null ? "" : text);
        area.setWrapText(true);
        area.setPrefRowCount(3);
        return area;
    }

    private void handleStairInputChanged(String value) {
        if (syncingStairInput) {
            return;
        }
        if (value == null || value.isBlank() || "-".equals(value.trim())) {
            return;
        }
        try {
            onStairInputLevelChanged.accept(Integer.parseInt(value.trim()));
        } catch (NumberFormatException ignored) {
            // The state owner keeps the canonical numeric value and will re-render it on refresh.
        }
    }

    private void syncStairInput(Integer level) {
        syncingStairInput = true;
        stairInputField.setText(level == null ? "" : Integer.toString(level));
        syncingStairInput = false;
    }

    private void syncStairShape(StairShape shape, CardinalDirection direction) {
        syncingStairShape = true;
        stairShapeBox.setValue(shape);
        updateDirectionSelection(direction == null ? CardinalDirection.defaultDirection() : direction);
        syncingStairShape = false;
    }

    private void syncStairDimensions(Integer dimension1, Integer dimension2) {
        syncingStairDimensions = true;
        stairDimension1Field.setText(dimension1 == null ? "" : Integer.toString(dimension1));
        stairDimension2Field.setText(dimension2 == null ? "" : Integer.toString(dimension2));
        syncingStairDimensions = false;
    }

    private void handleStairDimensionChanged(String value, IntConsumer consumer) {
        if (syncingStairDimensions) {
            return;
        }
        if (value == null || value.isBlank() || "-".equals(value.trim())) {
            return;
        }
        try {
            consumer.accept(Integer.parseInt(value.trim()));
        } catch (NumberFormatException ignored) {
            // The state owner keeps the canonical numeric value and will re-render it on refresh.
        }
    }

    private void configureDirectionButton(Button button, CardinalDirection direction) {
        button.getStyleClass().add("compact");
        button.setOnAction(event -> {
            if (!syncingStairShape) {
                onStairDirectionChanged.accept(direction);
            }
        });
    }

    private void updateDirectionSelection(CardinalDirection selectedDirection) {
        setDirectionButtonSelected(stairNorthButton, selectedDirection == CardinalDirection.NORTH);
        setDirectionButtonSelected(stairEastButton, selectedDirection == CardinalDirection.EAST);
        setDirectionButtonSelected(stairSouthButton, selectedDirection == CardinalDirection.SOUTH);
        setDirectionButtonSelected(stairWestButton, selectedDirection == CardinalDirection.WEST);
    }

    private static void setDirectionButtonSelected(Button button, boolean selected) {
        if (selected) {
            if (!button.getStyleClass().contains("selected")) {
                button.getStyleClass().add("selected");
            }
            return;
        }
        button.getStyleClass().remove("selected");
    }

    private void updateStairShapeVisibility(StairShape shape, boolean editable) {
        StairShape resolvedShape = shape == null ? StairShape.LADDER : shape;
        boolean showDirection = editable && resolvedShape.needsDirection();
        stairDirectionButtons.setManaged(showDirection);
        stairDirectionButtons.setVisible(showDirection);
        stairDimension1Label.setText(stairDimension1Label(resolvedShape));
        stairDimension2Label.setText("Tiefe");
        boolean showDimension1 = editable && (resolvedShape.needsSideLength()
                || resolvedShape.needsDimensions()
                || resolvedShape.needsRadius());
        boolean showDimension2 = editable && resolvedShape.needsDimensions();
        stairDimension1Row.setManaged(showDimension1);
        stairDimension1Row.setVisible(showDimension1);
        stairDimension2Row.setManaged(showDimension2);
        stairDimension2Row.setVisible(showDimension2);
    }

    private static String stairDimension1Label(StairShape shape) {
        if (shape == StairShape.SQUARE) {
            return "Seitenlänge";
        }
        if (shape == StairShape.RECTANGULAR) {
            return "Breite";
        }
        if (shape == StairShape.CIRCULAR) {
            return "Radius";
        }
        return "Maß";
    }

    private void renderStairTokens(List<Integer> exitLevels) {
        stairExitTokens.getChildren().clear();
        for (Integer level : exitLevels == null ? List.<Integer>of() : exitLevels) {
            if (level != null) {
                stairExitTokens.getChildren().add(createStairToken(level));
            }
        }
    }

    private Node createStairToken(int level) {
        Label label = new Label("z=" + level);
        Button removeButton = new Button("x");
        removeButton.getStyleClass().add("chip-remove-btn");
        removeButton.setOnAction(event -> onStairExitRemoveRequested.accept(level));
        HBox token = new HBox(4, label, removeButton);
        token.setAlignment(Pos.CENTER_LEFT);
        token.getStyleClass().addAll("chip", "chip-cr");
        return token;
    }

    private static String blankToEmpty(String text) {
        return text == null ? "" : text;
    }

    private void renderPreparedTransitionButtons(List<PreparedTransitionCard> preparedTransitions, Long selectedId) {
        preparedTransitionButtons.getChildren().clear();
        for (PreparedTransitionCard prepared : preparedTransitions == null ? List.<PreparedTransitionCard>of() : preparedTransitions) {
            if (prepared == null) {
                continue;
            }
            Button button = new Button(prepared.label());
            button.getStyleClass().add("compact");
            if (Objects.equals(prepared.transitionId(), selectedId) && !button.getStyleClass().contains("selected")) {
                button.getStyleClass().add("selected");
            }
            button.setOnAction(event -> onPreparedTransitionSelected.accept(prepared.transitionId()));
            preparedTransitionButtons.getChildren().add(button);
        }
    }

    private VBox buildNarrationCardUi(RoomNarrationCard card, SaveRoomNarrationHandler saveHandler) {
        TextArea visualArea = createTextArea(card.visualDescription());
        Label visualTitle = new Label("Visueller Eindruck");
        visualTitle.getStyleClass().add("text-muted");

        VBox roomBox = new VBox(6, visualTitle, visualArea);
        List<TextArea> exitAreas = new ArrayList<>();
        for (RoomExitCard exit : card.exits()) {
            Label exitTitle = new Label(exit.label());
            exitTitle.getStyleClass().add("text-muted");
            TextArea exitArea = createTextArea(exit.description());
            exitAreas.add(exitArea);
            roomBox.getChildren().addAll(exitTitle, exitArea);
        }

        Label statusLabel = new Label();
        statusLabel.setWrapText(true);
        Button saveButton = new Button("Speichern");
        narrationSaveButtons.put(card.roomId(), saveButton);
        narrationStatusLabels.put(card.roomId(), statusLabel);
        saveButton.setOnAction(event -> {
            if (saveHandler == null) {
                return;
            }
            ArrayList<RoomExitNarration> exitNarrations = new ArrayList<>();
            for (int index = 0; index < card.exits().size(); index++) {
                RoomExitCard exit = card.exits().get(index);
                exitNarrations.add(new RoomExitNarration(exit.roomCell(), exit.direction(), exitAreas.get(index).getText()));
            }
            saveHandler.save(card.roomId(), new RoomNarration(visualArea.getText(), exitNarrations));
        });
        roomBox.getChildren().addAll(statusLabel, saveButton);
        return card(card.roomName(), roomBox);
    }

    public record RoomNarrationCard(
            long roomId,
            String roomName,
            String visualDescription,
            List<RoomExitCard> exits
    ) {
    }

    public record RoomExitCard(
            String label,
            Point2i roomCell,
            Point2i direction,
            String description
    ) {
    }

    @FunctionalInterface
    public interface SaveRoomNarrationHandler {
        void save(long roomId, RoomNarration narration);
    }

    public record StairDraftCard(
            Integer inputLevel,
            StairShape shape,
            CardinalDirection direction,
            Integer dimension1,
            Integer dimension2,
            List<Integer> exitLevels,
            String statusMessage,
            boolean editable
    ) {
    }

    public record TransitionDraftCard(
            String description,
            DungeonTransitionEditRequest.DestinationType destinationType,
            boolean bidirectional,
            Long targetDungeonMapId,
            Long targetTransitionId,
            Long targetOverworldMapId,
            Long targetOverworldTileId,
            Long preparedTransitionId,
            List<DungeonMapCatalogEntry> maps,
            List<DungeonTransitionTargetSummary> targetTransitions,
            List<OverworldTransitionTargetSummary> overworldTargets,
            List<PreparedTransitionCard> preparedTransitions,
            String summary,
            String statusMessage
    ) {
    }

    public record PreparedTransitionCard(
            long transitionId,
            String label
    ) {
    }
}
