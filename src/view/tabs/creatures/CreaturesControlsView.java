package src.view.tabs.creatures;

import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class CreaturesControlsView extends VBox {

    private final Button loadButton = new Button("Load catalog");

    public CreaturesControlsView() {
        setSpacing(10);
        setPadding(new Insets(12));
        getStyleClass().add("surface-root");

        Label title = new Label("Creatures");
        getChildren().addAll(title, loadButton);
    }

    public void onLoad(Runnable action) {
        loadButton.setOnAction(event -> action.run());
    }
}
