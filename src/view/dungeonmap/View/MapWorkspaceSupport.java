package src.view.dungeonshared.View;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

/**
 * Shared scene-graph helpers for dungeon workspace sidebars.
 */
public final class MapWorkspaceSupport {
    private MapWorkspaceSupport() {
    }

    public static VBox card(String title, Node... content) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("panel-title");
        VBox box = new VBox(6);
        box.getStyleClass().addAll("card-surface", "content-card");
        box.getChildren().add(titleLabel);
        box.getChildren().addAll(content);
        return box;
    }
    public static Label muted(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-muted");
        return label;
    }
    public static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }
}
