package features.world.hexmap.ui.editor.dialogs;

import javafx.geometry.Insets;
import javafx.scene.control.*;
import javafx.scene.layout.GridPane;

/**
 * Modaler Dialog zum Erstellen einer neuen Hex-Karte.
 * Liefert bei Erfolg ein typisiertes Result (name, radius), sonst null bei Abbruch.
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

        // Erstellen-Button deaktivieren, wenn der Name leer ist
        Button createBtn = (Button) getDialogPane().lookupButton(createType);
        createBtn.disableProperty().bind(nameField.textProperty().isEmpty());

        setResultConverter(btn -> {
            if (btn == createType) {
                return new Result(nameField.getText().trim(), radiusSpinner.getValue());
            }
            return null;
        });

        // Beim Oeffnen den Fokus auf das Namensfeld setzen
        nameField.selectAll();
        setOnShown(e -> nameField.requestFocus());
    }
}
