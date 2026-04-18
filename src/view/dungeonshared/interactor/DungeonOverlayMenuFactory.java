package src.view.dungeonshared.interactor;

import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.CustomMenuItem;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Region;

final class DungeonOverlayMenuFactory {

    private DungeonOverlayMenuFactory() {
    }

    static CustomMenuItem menuItem(Node content) {
        CustomMenuItem item = new CustomMenuItem(content, false);
        item.getStyleClass().add("dungeon-overlay-menu-item");
        return item;
    }

    static HBox row(String label, Region... content) {
        Label title = new Label(label);
        title.getStyleClass().add("text-muted");
        HBox row = new HBox(8);
        row.setAlignment(Pos.CENTER_LEFT);
        row.getChildren().add(title);
        row.getChildren().addAll(content);
        return row;
    }
}
