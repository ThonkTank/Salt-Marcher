package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.room.RoomNarration;
import features.world.dungeonmap.model.structures.room.RoomExitNarration;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.layout.VBox;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class DungeonEditorStatePane {

    private final VBox content = new VBox();
    private final Label activeToolLabel = new Label(DungeonEditorTool.SELECT.label());
    private final Label wallPathLabel = new Label("Kein Startpunkt");
    private final Label corridorLabel = new Label("Kein Korridor gewählt");
    private final VBox narrationContent = new VBox(8);
    private final Map<Long, Button> narrationSaveButtons = new LinkedHashMap<>();
    private final Map<Long, Label> narrationStatusLabels = new LinkedHashMap<>();

    public DungeonEditorStatePane() {
        content.getStyleClass().add("dungeon-editor-sidebar");
        Button cancelWallPathButton = new Button("Pfad verwerfen");
        Button resetDoorButton = new Button("Auf Auto zurücksetzen");
        Button deleteWaypointButton = new Button("Zwischenpunkt löschen");
        cancelWallPathButton.setDisable(true);
        resetDoorButton.setDisable(true);
        deleteWaypointButton.setDisable(true);
        content.getChildren().addAll(
                card("Werkzeug", activeToolLabel),
                card("Wand", wallPathLabel, cancelWallPathButton),
                card("Korridor", corridorLabel, resetDoorButton, deleteWaypointButton),
                card("Raumbeschreibung", narrationContent));
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
        corridorLabel.setText(text == null || text.isBlank() ? "Kein Korridor gewählt" : text);
    }

    public void showRoomNarrationEditors(List<RoomNarrationCard> cards, SaveRoomNarrationHandler saveHandler) {
        narrationContent.getChildren().clear();
        narrationSaveButtons.clear();
        narrationStatusLabels.clear();
        if (cards == null || cards.isEmpty()) {
            narrationContent.getChildren().add(text("Cluster mit Raum wählen"));
            return;
        }
        for (RoomNarrationCard card : cards) {
            if (card == null) {
                continue;
            }
            TextArea visualArea = createTextArea(card.visualDescription());
            Label visualTitle = new Label("Visueller Eindruck");
            visualTitle.getStyleClass().add("text-muted");

            VBox roomBox = new VBox(6, visualTitle, visualArea);
            List<TextArea> exitAreas = new java.util.ArrayList<>();
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
                java.util.ArrayList<RoomExitNarration> exitNarrations = new java.util.ArrayList<>();
                for (int index = 0; index < card.exits().size(); index++) {
                    RoomExitCard exit = card.exits().get(index);
                    exitNarrations.add(new RoomExitNarration(exit.roomCell(), exit.direction(), exitAreas.get(index).getText()));
                }
                saveHandler.save(card.roomId(), new RoomNarration(visualArea.getText(), exitNarrations));
            });
            roomBox.getChildren().addAll(statusLabel, saveButton);
            narrationContent.getChildren().add(card(card.roomName(), roomBox));
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
}
