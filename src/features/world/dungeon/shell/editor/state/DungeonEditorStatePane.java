package features.world.dungeon.shell.editor.state;

import features.world.dungeon.state.DungeonEditorTool;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class DungeonEditorStatePane {

    private final VBox content = new VBox();
    private final Label activeToolLabel = new Label(DungeonEditorTool.SELECT.label());

    public DungeonEditorStatePane() {
        content.getStyleClass().add("dungeon-editor-sidebar");
        refresh(DungeonEditorTool.SELECT, null);
    }

    public Node content() {
        return content;
    }

    public void refresh(DungeonEditorTool tool, Node toolContent) {
        activeToolLabel.setText((tool == null ? DungeonEditorTool.SELECT : tool).label());
        content.getChildren().setAll(editorCard("Werkzeug", activeToolLabel));
        if (toolContent != null) {
            content.getChildren().add(toolContent);
        }
    }

    private static VBox editorCard(String title, Node... content) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("editor-panel-title");
        VBox box = new VBox(6);
        box.getStyleClass().add("editor-card");
        box.getChildren().add(titleLabel);
        box.getChildren().addAll(content);
        return box;
    }
}
