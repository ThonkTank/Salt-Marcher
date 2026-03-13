package features.world.dungeonmap.ui.editor.chrome.sidebar;

import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

final class DungeonSidebarCards {

    private DungeonSidebarCards() {
    }

    public static VBox createCard(String title, Node... content) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("dungeon-panel-title");
        VBox box = new VBox(6, titleLabel);
        box.getStyleClass().add("dungeon-editor-card");
        box.getChildren().addAll(content);
        return box;
    }

    public static HBox actionRow(Button... buttons) {
        HBox row = new HBox(8, buttons);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    public static void setVisible(Node node, boolean visible) {
        node.setVisible(visible);
        node.setManaged(visible);
    }
}
