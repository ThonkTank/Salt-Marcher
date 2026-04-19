package src.view.tabs.encounter;

import javafx.beans.property.StringProperty;
import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class EncounterMainView extends VBox {

    private final Label result = new Label();

    public EncounterMainView() {
        setSpacing(8);
        setPadding(new Insets(16));
        getStyleClass().add("surface-root");

        Label title = new Label("Encounter result");
        result.setWrapText(true);
        getChildren().addAll(title, result);
    }

    public StringProperty resultTextProperty() {
        return result.textProperty();
    }
}
