package features.world.dungeonmap.shell.editor;

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
        content.getChildren().setAll(EditorCards.card("Werkzeug", activeToolLabel));
        if (toolContent != null) {
            content.getChildren().add(toolContent);
        }
    }
}
