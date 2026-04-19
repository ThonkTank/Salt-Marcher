package src.view.views;

import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class DungeonTravelStateView extends VBox {

    private final Label body = new Label();

    public DungeonTravelStateView() {
        setSpacing(8);
        setPadding(new Insets(12));
        getStyleClass().add("surface-root");

        Label title = new Label("Travel state");
        body.setWrapText(true);
        getChildren().addAll(title, body);
    }

    public void showState(String text) {
        body.setText(text);
    }
}
