package features.world.dungeonmap.ui.editor.sidebar;

import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

final class LinkStatusCard {

    private static final String DEFAULT_MESSAGE = "Erste Verbindung klicken, dann zweite Verbindung klicken.";
    private static final String PENDING_MESSAGE = "Link-Start gewählt - zweite Verbindung klicken";

    private final Label statusLabel = new Label(DEFAULT_MESSAGE);
    private final Button cancelButton = new Button("Abbrechen");
    private final VBox root;
    private Runnable onCancel = () -> { };

    public LinkStatusCard() {
        statusLabel.getStyleClass().add("text-muted");
        cancelButton.getStyleClass().add("compact");
        cancelButton.setOnAction(event -> onCancel.run());
        root = DungeonSidebarCards.createCard("Link", new VBox(6, statusLabel, cancelButton));
        cancelButton.setVisible(false);
        cancelButton.setManaged(false);
        DungeonSidebarCards.setVisible(root, false);
    }

    public Node root() {
        return root;
    }

    public void showDefaultPrompt() {
        statusLabel.setText(DEFAULT_MESSAGE);
        cancelButton.setVisible(false);
        cancelButton.setManaged(false);
        DungeonSidebarCards.setVisible(root, true);
    }

    public void showPending() {
        statusLabel.setText(PENDING_MESSAGE);
        cancelButton.setVisible(true);
        cancelButton.setManaged(true);
        DungeonSidebarCards.setVisible(root, true);
    }

    public void reset() {
        statusLabel.setText(DEFAULT_MESSAGE);
        cancelButton.setVisible(false);
        cancelButton.setManaged(false);
        DungeonSidebarCards.setVisible(root, false);
    }

    public void setOnCancel(Runnable onCancel) {
        this.onCancel = onCancel == null ? () -> { } : onCancel;
    }
}
