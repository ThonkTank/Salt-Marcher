package ui.mapeditor;

import javafx.geometry.Insets;
import javafx.scene.control.*;
import javafx.scene.layout.GridPane;

/**
 * Modal dialog for creating a new hex map.
 * Returns a two-element result: [name, radius] on success, null on cancel.
 */
public class NewMapDialog extends Dialog<NewMapDialog.Result> {

    public record Result(String name, int radius) {}

    public NewMapDialog() {
        setTitle("Neue Karte");
        setHeaderText("Hexagonale Karte erstellen");

        ButtonType createType = new ButtonType("Erstellen", ButtonBar.ButtonData.OK_DONE);
        getDialogPane().getButtonTypes().addAll(createType, ButtonType.CANCEL);

        GridPane grid = new GridPane();
        grid.setHgap(10);
        grid.setVgap(10);
        grid.setPadding(new Insets(16));

        TextField nameField = new TextField("Neue Karte");
        nameField.setPromptText("Kartenname");

        Spinner<Integer> radiusSpinner = new Spinner<>(1, 20, 5);
        radiusSpinner.setEditable(true);
        radiusSpinner.setPrefWidth(80);

        grid.add(new Label("Name:"), 0, 0);
        grid.add(nameField, 1, 0);
        grid.add(new Label("Radius:"), 0, 1);
        grid.add(radiusSpinner, 1, 1);

        getDialogPane().setContent(grid);

        // Disable create button when name is empty
        Button createBtn = (Button) getDialogPane().lookupButton(createType);
        createBtn.disableProperty().bind(nameField.textProperty().isEmpty());

        setResultConverter(btn -> {
            if (btn == createType) {
                return new Result(nameField.getText().trim(), radiusSpinner.getValue());
            }
            return null;
        });

        // Focus name field on open
        nameField.selectAll();
        setOnShown(e -> nameField.requestFocus());
    }
}
