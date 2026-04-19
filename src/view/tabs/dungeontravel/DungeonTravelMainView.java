package src.view.tabs.dungeontravel;

import javafx.beans.property.StringProperty;
import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class DungeonTravelMainView extends VBox {

    private final Label status = new Label();

    public DungeonTravelMainView() {
        setSpacing(8);
        setPadding(new Insets(16));
        getStyleClass().add("surface-root");

        Label title = new Label("Travel workspace");
        status.setWrapText(true);
        getChildren().addAll(title, status);
    }

    public StringProperty statusTextProperty() {
        return status.textProperty();
    }
}
