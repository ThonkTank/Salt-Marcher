package src.view.tabs.dungeoneditor;

import javafx.beans.property.StringProperty;
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
        status.setWrapText(true);
        getChildren().addAll(title, status);
    }

    public StringProperty statusTextProperty() {
        return status.textProperty();
    }
}
