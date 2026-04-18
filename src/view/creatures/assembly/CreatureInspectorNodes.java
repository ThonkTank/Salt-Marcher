package src.view.creatures.assembly;

import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;

final class CreatureInspectorNodes {

    private CreatureInspectorNodes() {
    }

    static VBox section(String title, Node... content) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("editor-panel-title");
        VBox box = new VBox(6);
        box.getStyleClass().add("editor-card");
        box.getChildren().add(titleLabel);
        box.getChildren().addAll(content);
        return box;
    }

    static Node labeled(String label, @Nullable String value) {
        VBox box = new VBox(2);
        Label labelNode = new Label(label);
        labelNode.getStyleClass().add("text-muted");
        Label valueNode = new Label(value == null || value.isBlank() ? "—" : value);
        valueNode.setWrapText(true);
        box.getChildren().addAll(labelNode, valueNode);
        return box;
    }
}
