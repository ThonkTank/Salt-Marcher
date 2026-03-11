package features.world.dungeonmap.ui.editor.dropdowns;

import features.world.dungeonmap.model.DungeonMap;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Spinner;
import javafx.scene.control.SpinnerValueFactory;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import ui.components.AnchoredDropdown;

import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.UnaryOperator;

public final class DungeonMapFormDropdown {

    public record Result(String name, int width, int height) {}

    private final VBox panel = new VBox(10);
    private final AnchoredDropdown dropdown;
    private final Label titleLabel = new Label();
    private final TextField nameField = new TextField();
    private final Spinner<Integer> widthSpinner = createDimensionSpinner();
    private final Spinner<Integer> heightSpinner = createDimensionSpinner();
    private final Label impactLabel = new Label();
    private final Button cancelButton = new Button("Abbrechen");
    private final Button submitButton = new Button("Erstellen");
    private final Button confirmShrinkButton = new Button("Verkleinerung bestätigen");

    private Consumer<Result> onSubmit = result -> { };
    private BiFunction<Integer, Integer, String> shrinkImpactProvider = (width, height) -> "";

    public DungeonMapFormDropdown() {
        panel.getStyleClass().add("dropdown-window");
        panel.setPadding(new Insets(12));

        titleLabel.getStyleClass().add("dropdown-title");
        impactLabel.getStyleClass().add("dropdown-impact");
        impactLabel.setWrapText(true);
        impactLabel.setVisible(false);
        impactLabel.setManaged(false);
        confirmShrinkButton.setVisible(false);
        confirmShrinkButton.setManaged(false);

        GridPane grid = new GridPane();
        grid.setHgap(10);
        grid.setVgap(10);
        grid.add(new Label("Name:"), 0, 0);
        grid.add(nameField, 1, 0);
        grid.add(new Label("Breite:"), 0, 1);
        grid.add(widthSpinner, 1, 1);
        grid.add(new Label("Höhe:"), 0, 2);
        grid.add(heightSpinner, 1, 2);

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox actions = new HBox(8, cancelButton, spacer, confirmShrinkButton, submitButton);
        actions.getStyleClass().add("dropdown-actions");

        panel.getChildren().addAll(titleLabel, grid, impactLabel, actions);
        dropdown = new AnchoredDropdown(panel);
        dropdown.setOnHidden(this::resetTransientState);

        cancelButton.setOnAction(event -> dropdown.hide());
        submitButton.setOnAction(event -> submit(false));
        confirmShrinkButton.setOnAction(event -> submit(true));
        nameField.setOnAction(event -> submit(false));
        widthSpinner.valueProperty().addListener((obs, oldValue, newValue) -> resetShrinkConfirmation());
        heightSpinner.valueProperty().addListener((obs, oldValue, newValue) -> resetShrinkConfirmation());
        widthSpinner.getEditor().textProperty().addListener((obs, oldValue, newValue) -> resetShrinkConfirmation());
        heightSpinner.getEditor().textProperty().addListener((obs, oldValue, newValue) -> resetShrinkConfirmation());
    }

    public void showCreate(Node anchor, Consumer<Result> onSubmit) {
        titleLabel.setText("Neuen Dungeon anlegen");
        nameField.setText("Neuer Dungeon");
        widthSpinner.getValueFactory().setValue(24);
        heightSpinner.getValueFactory().setValue(24);
        submitButton.setText("Erstellen");
        this.onSubmit = onSubmit == null ? result -> { } : onSubmit;
        this.shrinkImpactProvider = (width, height) -> "";
        resetTransientState();
        dropdown.show(anchor);
        dropdown.requestFocus(nameField);
        nameField.selectAll();
    }

    public void showEdit(
            Node anchor,
            DungeonMap map,
            BiFunction<Integer, Integer, String> shrinkImpactProvider,
            Consumer<Result> onSubmit
    ) {
        titleLabel.setText("Dungeon bearbeiten");
        nameField.setText(map.name());
        widthSpinner.getValueFactory().setValue(map.width());
        heightSpinner.getValueFactory().setValue(map.height());
        submitButton.setText("Speichern");
        this.shrinkImpactProvider = shrinkImpactProvider == null ? (width, height) -> "" : shrinkImpactProvider;
        this.onSubmit = onSubmit == null ? result -> { } : onSubmit;
        resetTransientState();
        dropdown.show(anchor);
        dropdown.requestFocus(nameField);
        nameField.selectAll();
    }

    public void hide() {
        dropdown.hide();
    }

    private void submit(boolean confirmedShrink) {
        if (!commitSpinnerValue(widthSpinner) || !commitSpinnerValue(heightSpinner)) {
            return;
        }
        String name = nameField.getText() == null ? "" : nameField.getText().strip();
        if (name.isBlank()) {
            dropdown.requestFocus(nameField);
            return;
        }
        Result result = new Result(name, widthSpinner.getValue(), heightSpinner.getValue());
        String shrinkImpactText = shrinkImpactProvider.apply(result.width(), result.height());
        if (!confirmedShrink && shrinkImpactText != null && !shrinkImpactText.isBlank()) {
            impactLabel.setText(shrinkImpactText);
            impactLabel.setVisible(true);
            impactLabel.setManaged(true);
            confirmShrinkButton.setVisible(true);
            confirmShrinkButton.setManaged(true);
            submitButton.setText("Werte prüfen");
            dropdown.requestFocus(confirmShrinkButton);
            return;
        }
        onSubmit.accept(result);
    }

    private void resetTransientState() {
        resetShrinkConfirmation();
    }

    private void resetShrinkConfirmation() {
        impactLabel.setText("");
        impactLabel.setVisible(false);
        impactLabel.setManaged(false);
        confirmShrinkButton.setVisible(false);
        confirmShrinkButton.setManaged(false);
    }

    private static Spinner<Integer> createDimensionSpinner() {
        Spinner<Integer> spinner = new Spinner<>();
        spinner.setValueFactory(new SpinnerValueFactory.IntegerSpinnerValueFactory(1, Integer.MAX_VALUE, 24));
        spinner.setEditable(true);
        spinner.setPrefWidth(120);
        UnaryOperator<TextFormatter.Change> filter = change -> {
            String next = change.getControlNewText();
            return next.isEmpty() || next.matches("[1-9][0-9]*") ? change : null;
        };
        spinner.getEditor().setTextFormatter(new TextFormatter<>(filter));
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
