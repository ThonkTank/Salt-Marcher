package features.world.dungeonmap.ui.editor.sidebar;

import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

final class WorkflowMessageCard {

    private final Label titleLabel = new Label("Hinweis");
    private final Label messageLabel = new Label();
    private final VBox root;

    public WorkflowMessageCard() {
        titleLabel.getStyleClass().add("dungeon-panel-title");
        messageLabel.getStyleClass().add("text-secondary");
        messageLabel.setWrapText(true);
        root = new VBox(6, titleLabel, messageLabel);
        root.getStyleClass().add("dungeon-editor-card");
        DungeonSidebarCards.setVisible(root, false);
    }

    public Node root() {
        return root;
    }

    public void showMessage(String title, String message) {
        titleLabel.setText(title == null || title.isBlank() ? "Hinweis" : title);
        messageLabel.setText(message == null ? "" : message);
        DungeonSidebarCards.setVisible(root, message != null && !message.isBlank());
    }

    public void clear() {
        messageLabel.setText("");
        DungeonSidebarCards.setVisible(root, false);
    }
}
