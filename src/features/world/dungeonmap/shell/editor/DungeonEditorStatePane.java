package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.application.transition.DungeonTransitionEditRequest;
import features.world.dungeonmap.application.transition.DungeonTransitionTargetSummary;
import features.world.dungeonmap.loading.DungeonMapCatalogEntry;
import features.world.dungeonmap.model.geometry.Point2i;
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
    private final Label boundaryLabel = new Label("Kein Wandpfad aktiv");
    private final VBox boundaryCard = card("Wandpfad", boundaryLabel);
    private final Label corridorLabel = new Label("Kein Korridor gewählt");
    private final VBox corridorCard = card("Korridor", corridorLabel);
    private final Label stairSummaryLabel = new Label("Keine Treppe gewählt");
    private final TextField stairInputField = new TextField();
    private final Button stairLevelDownButton = new Button("-");
    private final Button stairLevelUpButton = new Button("+");
    private final Button stairAddButton = new Button("Hinzufügen");
    private final FlowPane stairExitTokens = new FlowPane();
    private final Label stairStatusLabel = new Label();
    private final HBox stairInputRow = new HBox(6, stairInputField, stairLevelDownButton, stairLevelUpButton, stairAddButton);
    private final VBox stairEditorContent = new VBox(6, stairInputRow, stairExitTokens);
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
    private Consumer<String> onTransitionDescriptionChanged = value -> { };
    private Consumer<DungeonTransitionEditRequest.DestinationType> onTransitionDestinationTypeChanged = value -> { };
    private Consumer<Boolean> onTransitionBidirectionalChanged = value -> { };
    private Consumer<Long> onTransitionTargetMapChanged = value -> { };
    private Consumer<Long> onTransitionTargetTransitionChanged = value -> { };
    private Consumer<OverworldTransitionTargetSummary> onTransitionTargetOverworldChanged = value -> { };
    private Consumer<Long> onPreparedTransitionSelected = value -> { };
    private boolean syncingStairInput;
    private boolean syncingTransitionFields;

    public DungeonEditorStatePane() {
        content.getStyleClass().add("dungeon-editor-sidebar");
        content.getChildren().add(card("Werkzeug", activeToolLabel));
        stairInputField.setTextFormatter(new TextFormatter<>(change ->
                change.getControlNewText().matches("-?\\d*") ? change : null));
        stairInputField.setPrefColumnCount(4);
        stairInputField.setMaxWidth(70);
        stairLevelDownButton.getStyleClass().add("compact");
        stairLevelUpButton.getStyleClass().add("compact");
        stairInputField.textProperty().addListener((obs, oldValue, newValue) -> handleStairInputChanged(newValue));
        stairInputField.setOnAction(event -> onStairAddRequested.run());
        stairLevelDownButton.setOnAction(event -> onStairLevelDecrementRequested.run());
        stairLevelUpButton.setOnAction(event -> onStairLevelIncrementRequested.run());
        stairAddButton.setOnAction(event -> onStairAddRequested.run());
        stairInputRow.setAlignment(Pos.CENTER_LEFT);
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
        showCorridorStatus(null);
        showBoundaryDraft(null);
        showStairDraft(null);
        showTransitionDraft(null);
        showRoomNarrationEditors(List.of(), null);
    }

    public Node content() {
        return content;
    }

    public void refresh(DungeonEditorTool activeTool) {
        DungeonEditorTool shownTool = activeTool == null ? DungeonEditorTool.SELECT : activeTool;
        activeToolLabel.setText(shownTool.label());
    }

    public void showCorridorStatus(String text) {
        if (text == null || text.isBlank()) {
            content.getChildren().remove(corridorCard);
            corridorLabel.setText("Kein Korridor gewählt");
            return;
        }
        corridorLabel.setText(text);
        if (!content.getChildren().contains(corridorCard)) {
            content.getChildren().add(1, corridorCard);
        }
    }

    public void showBoundaryDraft(String text) {
        if (text == null || text.isBlank()) {
            content.getChildren().remove(boundaryCard);
            boundaryLabel.setText("Kein Wandpfad aktiv");
            return;
        }
        boundaryLabel.setText(text);
        if (!content.getChildren().contains(boundaryCard)) {
            content.getChildren().add(1, boundaryCard);
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
