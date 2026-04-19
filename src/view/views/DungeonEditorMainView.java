package src.view.views;

import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class DungeonEditorMainView extends VBox {

    private final Label status = new Label();

    public DungeonEditorMainView() {
        setSpacing(8);
        setPadding(new Insets(16));
        getStyleClass().add("surface-root");

        Label title = new Label("Dungeon workspace");
        title.getStyleClass().add("section-header");
        status.setWrapText(true);
        getChildren().addAll(title, status);
    }

    public void showStatus(String text) {
        status.setText(text);
    }
}
