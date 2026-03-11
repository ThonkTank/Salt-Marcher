package ui.components;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

public final class ConfirmationDropdown {

    private final AnchoredDropdown dropdown;
    private final VBox panel = new VBox(8);
    private final Label titleLabel = new Label();
    private final Label messageLabel = new Label();
    private final Button cancelButton = new Button("Abbrechen");
    private final Button confirmButton = new Button("Bestätigen");
    private Runnable onConfirm = () -> { };

    public ConfirmationDropdown() {
        panel.getStyleClass().addAll("dropdown-window", "dropdown-confirm");
        panel.setPadding(new Insets(10));

        titleLabel.getStyleClass().add("dropdown-title");
        messageLabel.getStyleClass().add("dropdown-message");
        messageLabel.setWrapText(true);

        dropdown = new AnchoredDropdown(panel);

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox actions = new HBox(8, cancelButton, spacer, confirmButton);
        actions.getStyleClass().add("dropdown-actions");

        cancelButton.setOnAction(event -> dropdown.hide());
        confirmButton.setOnAction(event -> onConfirm.run());

        panel.getChildren().addAll(titleLabel, messageLabel, actions);
    }

    public void show(Node anchor, String title, String message, String confirmLabel, Runnable onConfirm) {
        titleLabel.setText(title);
        messageLabel.setText(message);
        confirmButton.setText(confirmLabel);
        this.onConfirm = onConfirm == null ? () -> { } : onConfirm;
        dropdown.show(anchor);
        dropdown.requestFocus(cancelButton);
    }

    public void hide() {
        dropdown.hide();
    }
}
