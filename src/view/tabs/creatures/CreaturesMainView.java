package src.view.tabs.creatures;

import javafx.beans.property.StringProperty;
import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class CreaturesMainView extends VBox {

    private final Label body = new Label();

    public CreaturesMainView() {
        setSpacing(8);
        setPadding(new Insets(16));
        getStyleClass().add("surface-root");

        Label title = new Label("Creature catalog");
        body.setWrapText(true);
        getChildren().addAll(title, body);
    }

    public StringProperty summaryTextProperty() {
        return body.textProperty();
    }
}
