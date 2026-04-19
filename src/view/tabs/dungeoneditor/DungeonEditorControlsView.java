package src.view.tabs.dungeoneditor;

import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class DungeonEditorControlsView extends VBox {

    private final Button createButton = new Button("New map");

    public DungeonEditorControlsView() {
        setSpacing(10);
        setPadding(new Insets(12));
        getStyleClass().add("surface-root");

        Label title = new Label("Dungeon Editor");
        getChildren().addAll(title, createButton);
    }

    public void onCreateMap(Runnable action) {
        createButton.setOnAction(event -> action.run());
    }
}
