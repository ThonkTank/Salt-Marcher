package ui.components;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

import java.util.function.Consumer;
import javafx.beans.binding.Bindings;

public final class TextInputDropdown {

    private final AnchoredDropdown dropdown;
    private final VBox panel = new VBox(8);
    private final Label titleLabel = new Label();
    private final Label fieldLabel = new Label();
    private final TextField textField = new TextField();
    private final Label errorLabel = new Label();
    private final Button cancelButton = new Button("Abbrechen");
    private final Button submitButton = new Button("Speichern");
    private Consumer<String> onSubmit = value -> { };

    public TextInputDropdown() {
        panel.getStyleClass().addAll("dropdown-window", "dropdown-form");
        panel.setPadding(new Insets(10));

        titleLabel.getStyleClass().add("dropdown-title");
        fieldLabel.getStyleClass().add("text-muted");
        errorLabel.getStyleClass().add("text-warning");
        errorLabel.setWrapText(true);
        errorLabel.setVisible(false);
        errorLabel.setManaged(false);

        dropdown = new AnchoredDropdown(panel);
        dropdown.setOnHidden(this::resetError);

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox actions = new HBox(8, cancelButton, spacer, submitButton);
        actions.getStyleClass().add("dropdown-actions");

        cancelButton.setOnAction(event -> dropdown.hide());
        submitButton.setOnAction(event -> submit());
        textField.setOnAction(event -> submit());
        submitButton.disableProperty().bind(Bindings.createBooleanBinding(
                () -> textField.getText() == null || textField.getText().isBlank(),
                textField.textProperty()));

        panel.getChildren().addAll(titleLabel, fieldLabel, textField, errorLabel, actions);
    }

    public void show(Node anchor, String title, String label, String initialValue, String submitLabel, Consumer<String> onSubmit) {
        titleLabel.setText(title);
        fieldLabel.setText(label);
        textField.setText(initialValue == null ? "" : initialValue);
        textField.selectAll();
        submitButton.setText(submitLabel);
        this.onSubmit = onSubmit == null ? value -> { } : onSubmit;
        resetError();
        dropdown.show(anchor);
        dropdown.requestFocus(textField);
    }

    public void showError(String message) {
        errorLabel.setText(message);
        errorLabel.setVisible(true);
        errorLabel.setManaged(true);
        dropdown.requestFocus(textField);
    }

    public void hide() {
        dropdown.hide();
    }

    private void submit() {
        String value = textField.getText() == null ? "" : textField.getText().strip();
        if (!value.isBlank()) {
            onSubmit.accept(value);
        }
    }

    private void resetError() {
        errorLabel.setText("");
        errorLabel.setVisible(false);
        errorLabel.setManaged(false);
    }
}
