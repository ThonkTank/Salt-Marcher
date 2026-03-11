package ui.components;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

public final class MessageDropdown {

    private final AnchoredDropdown dropdown;
    private final VBox panel = new VBox(8);
    private final Label titleLabel = new Label();
    private final Label messageLabel = new Label();
    private final Button closeButton = new Button("Schließen");

    public MessageDropdown() {
        panel.getStyleClass().addAll("dropdown-window", "dropdown-notice");
        panel.setPadding(new Insets(10));

        titleLabel.getStyleClass().add("dropdown-title");
        messageLabel.getStyleClass().add("dropdown-message");
        messageLabel.setWrapText(true);

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox actions = new HBox(8, spacer, closeButton);
        actions.getStyleClass().add("dropdown-actions");

        closeButton.setOnAction(event -> dropdown.hide());

        panel.getChildren().addAll(titleLabel, messageLabel, actions);
        dropdown = new AnchoredDropdown(panel);
    }

    public void show(Node anchor, String title, String message) {
        titleLabel.setText(title);
        messageLabel.setText(message);
        dropdown.show(anchor);
        dropdown.requestFocus(closeButton);
    }

    public void hide() {
        dropdown.hide();
    }
}
