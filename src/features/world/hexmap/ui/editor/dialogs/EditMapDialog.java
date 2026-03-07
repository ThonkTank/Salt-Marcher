package features.world.hexmap.ui.editor.dialogs;

import features.world.hexmap.model.HexMap;
import javafx.geometry.Insets;
import javafx.scene.control.*;
import javafx.scene.layout.GridPane;

import java.util.function.IntUnaryOperator;

/**
 * Modaler Dialog zum Bearbeiten von Name und Radius einer bestehenden Hex-Karte.
 * Ist mit aktuellen Werten vorbelegt und zeigt eine Warnung bei Radiusverkleinerung.
 */
public class EditMapDialog extends Dialog<EditMapDialog.Result> {

    public record Result(String name, int radius) {}

    public EditMapDialog(HexMap map, IntUnaryOperator removedTilesForRadius) {
        setTitle("Karte bearbeiten");
        setHeaderText("Karteneigenschaften bearbeiten");

        int currentRadius = map.radius() != null ? map.radius() : 0;

        ButtonType saveType = new ButtonType("Speichern", ButtonBar.ButtonData.OK_DONE);
        getDialogPane().getButtonTypes().addAll(saveType, ButtonType.CANCEL);

        GridPane grid = new GridPane();
        grid.setHgap(8);
        grid.setVgap(8);
        grid.setPadding(new Insets(16));

        TextField nameField = new TextField(map.name());
        nameField.setPromptText("Kartenname");

        Spinner<Integer> radiusSpinner = new Spinner<>(0, 20, currentRadius);
        radiusSpinner.setEditable(true);
        radiusSpinner.setPrefWidth(80);
        radiusSpinner.focusedProperty().addListener((obs, was, now) -> {
            if (!now) radiusSpinner.commitValue();
        });

        Label warningLabel = new Label();
        warningLabel.getStyleClass().add("text-warning");
        warningLabel.setWrapText(true);
        warningLabel.setVisible(false);
        warningLabel.setManaged(false);

        radiusSpinner.valueProperty().addListener((obs, oldVal, newVal) -> {
            if (newVal != null && newVal < currentRadius) {
                int lost = removedTilesForRadius.applyAsInt(newVal);
                warningLabel.setText("Radius wird verkleinert \u2014 " + lost + " Felder werden gel\u00f6scht.");
                warningLabel.setVisible(true);
                warningLabel.setManaged(true);
            } else {
                warningLabel.setVisible(false);
                warningLabel.setManaged(false);
            }
        });

        grid.add(new Label("Name:"), 0, 0);
        grid.add(nameField, 1, 0);
        grid.add(new Label("Radius:"), 0, 1);
        grid.add(radiusSpinner, 1, 1);
        grid.add(warningLabel, 0, 2, 2, 1);

        getDialogPane().setContent(grid);

        Button saveBtn = (Button) getDialogPane().lookupButton(saveType);
        saveBtn.disableProperty().bind(nameField.textProperty().isEmpty());

        setResultConverter(btn -> {
            if (btn == saveType) {
                return new Result(nameField.getText().trim(), radiusSpinner.getValue());
            }
            return null;
        });

        nameField.selectAll();
        setOnShown(e -> nameField.requestFocus());
    }

}
