package features.world.dungeonmap.ui.editor.dialogs;

import features.world.dungeonmap.model.DungeonMap;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonBar;
import javafx.scene.control.ButtonType;
import javafx.scene.control.Dialog;
import javafx.scene.control.Label;
import javafx.scene.control.Spinner;
import javafx.scene.control.SpinnerValueFactory;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.layout.GridPane;

import java.util.function.UnaryOperator;

public class EditDungeonMapDialog extends Dialog<EditDungeonMapDialog.Result> {

    public record Result(String name, int width, int height) {}

    public EditDungeonMapDialog(DungeonMap map) {
        setTitle("Dungeon bearbeiten");
        setHeaderText("Dungeon-Metadaten anpassen");

        ButtonType saveType = new ButtonType("Speichern", ButtonBar.ButtonData.OK_DONE);
        getDialogPane().getButtonTypes().addAll(saveType, ButtonType.CANCEL);

        GridPane grid = new GridPane();
        grid.setHgap(10);
        grid.setVgap(10);
        grid.setPadding(new Insets(16));

        TextField nameField = new TextField(map.name());
        Spinner<Integer> widthSpinner = createDimensionSpinner(map.width());
        Spinner<Integer> heightSpinner = createDimensionSpinner(map.height());

        grid.add(new Label("Name:"), 0, 0);
        grid.add(nameField, 1, 0);
        grid.add(new Label("Breite:"), 0, 1);
        grid.add(widthSpinner, 1, 1);
        grid.add(new Label("Höhe:"), 0, 2);
        grid.add(heightSpinner, 1, 2);

        getDialogPane().setContent(grid);

        Button saveButton = (Button) getDialogPane().lookupButton(saveType);
        saveButton.disableProperty().bind(nameField.textProperty().isEmpty()
                .or(widthSpinner.getEditor().textProperty().isEmpty())
                .or(heightSpinner.getEditor().textProperty().isEmpty()));

        saveButton.addEventFilter(javafx.event.ActionEvent.ACTION, event -> {
            if (!commitSpinnerValue(widthSpinner) || !commitSpinnerValue(heightSpinner)) {
                event.consume();
            }
        });

        setResultConverter(button -> button == saveType
                ? new Result(nameField.getText().trim(), widthSpinner.getValue(), heightSpinner.getValue())
                : null);
    }

    private static Spinner<Integer> createDimensionSpinner(int initialValue) {
        Spinner<Integer> spinner = new Spinner<>();
        spinner.setValueFactory(new SpinnerValueFactory.IntegerSpinnerValueFactory(1, Integer.MAX_VALUE, initialValue));
        spinner.setEditable(true);
        spinner.setPrefWidth(120);
        UnaryOperator<TextFormatter.Change> filter = change -> {
            String next = change.getControlNewText();
            return next.isEmpty() || next.matches("[1-9][0-9]*") ? change : null;
        };
        spinner.getEditor().setTextFormatter(new TextFormatter<>(filter));
        spinner.getEditor().setText(Integer.toString(initialValue));
        return spinner;
    }

    private static boolean commitSpinnerValue(Spinner<Integer> spinner) {
        try {
            spinner.increment(0);
            return spinner.getValue() != null && spinner.getValue() > 0;
        } catch (RuntimeException ex) {
            return false;
        }
    }
}
