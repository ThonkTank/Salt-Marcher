package features.world.dungeonmap.shell.editor;

import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class DungeonEditorStatePane {

    private final VBox content = new VBox();
    private final Label activeToolLabel = new Label(DungeonEditorTool.SELECT.label());
    private final Label wallPathLabel = new Label("Kein Startpunkt");
    private final Label corridorLabel = new Label("Kein Korridor gewählt");

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
                card("Korridor", corridorLabel, resetDoorButton, deleteWaypointButton));
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

    private static VBox card(String title, Node... content) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("editor-panel-title");
        VBox box = new VBox(6);
        box.getStyleClass().add("editor-card");
        box.getChildren().add(titleLabel);
        box.getChildren().addAll(content);
        return box;
    }
}
