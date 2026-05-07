package src.view.statetabs.encounter;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

public final class EncounterStateView extends VBox {

    private final ContentArea contentArea = new ContentArea();

    public EncounterStateView() {
        setSpacing(0);
        setPadding(new Insets(0));
        getStyleClass().add("surface-root");
        setFillWidth(true);
        setVgrow(contentArea, Priority.ALWAYS);
        getChildren().add(contentArea);
    }

    public void showContent(Node node) {
        if (contentArea.shows(node)) {
            return;
        }
        contentArea.showOnly(node);
    }

    private static final class ContentArea extends StackPane {

        private boolean shows(Node node) {
            return getChildren().size() == 1 && java.util.Objects.equals(getChildren().get(0), node);
        }

        private void showOnly(Node node) {
            getChildren().setAll(node);
        }
    }
}
