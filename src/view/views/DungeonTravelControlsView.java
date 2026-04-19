package src.view.views;

import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class DungeonTravelControlsView extends VBox {

    private final Button refreshButton = new Button("Refresh");

    public DungeonTravelControlsView() {
        setSpacing(10);
        setPadding(new Insets(12));
        getStyleClass().add("surface-root");

        Label title = new Label("Dungeon Travel");
        title.getStyleClass().add("section-header");
        getChildren().addAll(title, refreshButton);
    }

    public void onRefresh(Runnable action) {
        refreshButton.setOnAction(event -> action.run());
    }
}
