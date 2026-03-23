package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.room.RoomNarration;
import features.world.dungeonmap.model.structures.room.RoomExitNarration;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.layout.VBox;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class DungeonEditorStatePane {

    private final VBox content = new VBox();
    private final Label activeToolLabel = new Label(DungeonEditorTool.SELECT.label());
    private final Label corridorLabel = new Label("Kein Korridor gewählt");
    private final VBox corridorCard = card("Korridor", corridorLabel);
    private final Label stairSummaryLabel = new Label("Keine Treppe gewählt");
    private final Label stairValidationLabel = new Label();
    private final Button stairUndoButton = new Button("Punkt rückgängig");
    private final Button stairDiscardButton = new Button("Verwerfen");
    private final Button stairSaveButton = new Button("Treppe speichern");
    private final VBox stairCard = card("Treppe", stairSummaryLabel, stairValidationLabel, stairUndoButton, stairDiscardButton, stairSaveButton);
    private final VBox narrationContent = new VBox(8);
    private final VBox narrationCard = card("Raumbeschreibung", narrationContent);
    private final Map<Long, Button> narrationSaveButtons = new LinkedHashMap<>();
    private final Map<Long, Label> narrationStatusLabels = new LinkedHashMap<>();

    public DungeonEditorStatePane() {
        content.getStyleClass().add("dungeon-editor-sidebar");
        content.getChildren().add(card("Werkzeug", activeToolLabel));
        stairValidationLabel.setWrapText(true);
        showCorridorStatus(null);
        showStairDraft(null, null, null, null);
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

    public void showStairDraft(StairDraftCard card, Runnable onUndo, Runnable onDiscard, Runnable onSave) {
        if (card == null) {
            content.getChildren().remove(stairCard);
            stairSummaryLabel.setText("Keine Treppe gewählt");
            stairValidationLabel.setText("");
            stairUndoButton.setOnAction(null);
            stairDiscardButton.setOnAction(null);
            stairSaveButton.setOnAction(null);
            stairUndoButton.setDisable(true);
            stairDiscardButton.setDisable(true);
            stairSaveButton.setDisable(true);
            return;
        }
        stairSummaryLabel.setText(card.summary());
        stairValidationLabel.setText(card.validationMessage() == null ? "" : card.validationMessage());
        stairUndoButton.setDisable(!card.canUndo());
        stairDiscardButton.setDisable(!card.canDiscard());
        stairSaveButton.setDisable(!card.canSave());
        stairUndoButton.setOnAction(event -> {
            if (onUndo != null) {
                onUndo.run();
            }
        });
        stairDiscardButton.setOnAction(event -> {
            if (onDiscard != null) {
                onDiscard.run();
            }
        });
        stairSaveButton.setOnAction(event -> {
            if (onSave != null) {
                onSave.run();
            }
        });
        if (!content.getChildren().contains(stairCard)) {
            content.getChildren().add(1, stairCard);
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
            if (card == null) {
                continue;
            }
            narrationContent.getChildren().add(buildNarrationCardUi(card, saveHandler));
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

    private static Label text(String text) {
        Label label = new Label(text);
        label.setWrapText(true);
        return label;
    }

    private static TextArea createTextArea(String text) {
        TextArea area = new TextArea(text == null ? "" : text);
        area.setWrapText(true);
        area.setPrefRowCount(3);
        return area;
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
            List<CubePoint> nodes,
            String summary,
            String validationMessage,
            boolean canUndo,
            boolean canDiscard,
            boolean canSave
    ) {
    }
}
