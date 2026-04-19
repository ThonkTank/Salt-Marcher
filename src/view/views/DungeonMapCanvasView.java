package src.view.views;

import javafx.beans.property.StringProperty;
import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public class DungeonMapCanvasView extends VBox {

    private final Label status = new Label();

    @SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
    public DungeonMapCanvasView(String titleText) {
        setSpacing(8);
        setPadding(new Insets(16));
        getStyleClass().add("surface-root");

        Label title = new Label(titleText);
        status.setWrapText(true);
        getChildren().addAll(title, status);
    }

    public final StringProperty statusTextProperty() {
        return status.textProperty();
    }
}
