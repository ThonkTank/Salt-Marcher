package ui;

import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

/**
 * Persistent lower-right panel ("scene context").
 * Shows what is currently happening in the game: encounter roster,
 * combat tracker, or a placeholder. Owned by AppShell, not by any view.
 * Views push content here via callbacks wired in SaltMarcherApp.
 */
public class ScenePane extends VBox {

    private final StackPane contentArea = new StackPane();
    private final Label placeholder;

    public ScenePane() {
        getStyleClass().add("scene-pane");
        setPrefWidth(380);
        setMinWidth(280);

        placeholder = new Label("Keine aktive Szene");
        placeholder.getStyleClass().add("text-muted");
        placeholder.setMaxWidth(Double.MAX_VALUE);
        placeholder.setMaxHeight(Double.MAX_VALUE);
        placeholder.setAlignment(Pos.CENTER);

        contentArea.getChildren().setAll(placeholder);
        contentArea.setAlignment(Pos.TOP_LEFT);
        VBox.setVgrow(contentArea, Priority.ALWAYS);
        getChildren().add(contentArea);
    }

    /** Replace scene content. Pass null to show the placeholder. */
    public void setContent(Node content) {
        if (content == null) {
            contentArea.getChildren().setAll(placeholder);
        } else {
            contentArea.getChildren().setAll(content);
        }
    }

}
