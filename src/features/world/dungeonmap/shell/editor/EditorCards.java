package features.world.dungeonmap.shell.editor;

import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class EditorCards {

    private EditorCards() {
    }

    public static VBox card(String title, Node... content) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("editor-panel-title");
        VBox box = new VBox(6);
        box.getStyleClass().add("editor-card");
        box.getChildren().add(titleLabel);
        box.getChildren().addAll(content);
        return box;
    }
}
