package src.view.views;

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
        title.getStyleClass().add("section-header");
        result.setWrapText(true);
        getChildren().addAll(title, result);
    }

    public void showResult(String text) {
        result.setText(text);
    }
}
