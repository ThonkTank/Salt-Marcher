package src.view.statetabs.encounter;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

public final class EncounterStateView extends VBox {

    private final StackPane contentArea = new StackPane();

    public EncounterStateView() {
        setSpacing(0);
        setPadding(new Insets(0));
        getStyleClass().add("surface-root");
        setFillWidth(true);
        VBox.setVgrow(contentArea, Priority.ALWAYS);
        getChildren().add(contentArea);
    }

    public void showContent(Node node) {
        if (contentArea.getChildren().size() == 1 && contentArea.getChildren().get(0) == node) {
            return;
        }
        contentArea.getChildren().setAll(node);
    }
}
