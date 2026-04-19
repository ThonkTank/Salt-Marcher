package src.view.views;

import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class EncounterControlsView extends VBox {

    private final Button generateButton = new Button("Generate");

    public EncounterControlsView() {
        setSpacing(10);
        setPadding(new Insets(12));
        getStyleClass().add("surface-root");

        Label title = new Label("Encounter Builder");
        getChildren().addAll(title, generateButton);
    }

    public void onGenerate(Runnable action) {
        generateButton.setOnAction(event -> action.run());
    }
}
