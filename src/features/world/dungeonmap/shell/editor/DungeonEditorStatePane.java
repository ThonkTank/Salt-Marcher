package features.world.dungeonmap.shell.editor;

import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class DungeonEditorStatePane {

    private final VBox content = new VBox();
    private final Label activeToolLabel = new Label(DungeonEditorTool.SELECT.label());
    private Node toolStateContent;

    public DungeonEditorStatePane() {
        content.getStyleClass().add("dungeon-editor-sidebar");
        content.getChildren().add(card("Werkzeug", activeToolLabel));
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
