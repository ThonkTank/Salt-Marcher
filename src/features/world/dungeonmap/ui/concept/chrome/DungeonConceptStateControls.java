package features.world.dungeonmap.ui.concept.chrome;

import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.control.Spinner;
import javafx.scene.control.SpinnerValueFactory;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

import java.text.NumberFormat;
import java.util.Locale;

final class DungeonConceptStateControls {

    static final NumberFormat DECIMAL_FORMAT = NumberFormat.getNumberInstance(Locale.GERMANY);
    static final double INT_FIELD_WIDTH = 54;
    static final double DECIMAL_FIELD_WIDTH = 66;
    static final double METRIC_WIDTH = 72;

    static {
        DECIMAL_FORMAT.setMinimumFractionDigits(0);
        DECIMAL_FORMAT.setMaximumFractionDigits(2);
    }

    private DungeonConceptStateControls() {
    }

    static HBox compactRow(Node... nodes) {
        HBox row = new HBox(8, nodes);
        row.setAlignment(Pos.CENTER_LEFT);
        for (Node node : nodes) {
            if (node instanceof Region region) {
                HBox.setHgrow(region, Priority.NEVER);
            }
        }
        return row;
    }

    static VBox labeledControl(String label, Node control) {
        Label title = new Label(label);
        title.getStyleClass().addAll("small", "text-muted");
        VBox box = new VBox(2, title, control);
        box.getStyleClass().add("concept-compact-field");
        if (control instanceof Region region) {
            region.setMaxWidth(Region.USE_PREF_SIZE);
        }
        return box;
    }

    static VBox metricValue(String label, String value) {
        Label header = new Label(label);
        header.getStyleClass().addAll("small", "text-muted");
        Label body = new Label(value);
        VBox box = new VBox(2, header, body);
        box.setMinWidth(METRIC_WIDTH);
        box.setPrefWidth(METRIC_WIDTH);
        return box;
    }

    static Spinner<Integer> createIntegerSpinner(int min, int max, int value) {
        Spinner<Integer> spinner = new Spinner<>();
        spinner.setValueFactory(new SpinnerValueFactory.IntegerSpinnerValueFactory(min, max, value));
        spinner.setEditable(true);
        spinner.setPrefWidth(INT_FIELD_WIDTH);
        spinner.setMinWidth(INT_FIELD_WIDTH);
        spinner.setMaxWidth(INT_FIELD_WIDTH);
        spinner.getStyleClass().add("concept-compact-spinner");
        spinner.getEditor().setTextFormatter(new TextFormatter<>(change -> change.getText().matches("[0-9]*") ? change : null));
        spinner.getEditor().setAlignment(Pos.CENTER_RIGHT);
        spinner.getEditor().setPrefColumnCount(2);
        return spinner;
    }

    static TextField createDecimalField(String value) {
        TextField field = new TextField(value);
        field.setTextFormatter(new TextFormatter<>(change ->
                change.getControlNewText().matches("[0-9]*([\\.,][0-9]{0,2})?") ? change : null));
        field.setPrefWidth(DECIMAL_FIELD_WIDTH);
        field.setMinWidth(DECIMAL_FIELD_WIDTH);
        field.setMaxWidth(DECIMAL_FIELD_WIDTH);
        field.getStyleClass().add("concept-compact-text-field");
        field.setAlignment(Pos.CENTER_RIGHT);
        field.setPrefColumnCount(3);
        return field;
    }

    static void bindCommit(TextField field, Runnable action) {
        field.setOnAction(event -> action.run());
        field.focusedProperty().addListener((obs, oldValue, focused) -> {
            if (!focused) {
                action.run();
            }
        });
    }

    static void commitSpinnerValue(Spinner<Integer> spinner) {
        if (spinner == null || !spinner.isEditable()) {
            return;
        }
        try {
            spinner.increment(0);
        } catch (RuntimeException ignored) {
        }
    }

    static double parseDecimal(String text, double fallback) {
        if (text == null || text.isBlank()) {
            return fallback;
        }
        try {
            return Double.parseDouble(text.replace(',', '.'));
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    static String formatDecimal(double value) {
        return DECIMAL_FORMAT.format(value);
    }
}
