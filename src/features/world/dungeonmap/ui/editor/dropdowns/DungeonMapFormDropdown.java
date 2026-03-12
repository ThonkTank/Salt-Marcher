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
import java.util.function.Supplier;
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
    private final Button deleteButton = new Button("Dungeon löschen");
    private final Button confirmDeleteButton = new Button("Löschen bestätigen");
    private final Button submitButton = new Button("Erstellen");
    private final Button confirmShrinkButton = new Button("Verkleinerung bestätigen");

    private Consumer<Result> onSubmit = result -> { };
    private Runnable onDelete = () -> { };
    private BiFunction<Integer, Integer, String> shrinkImpactProvider = (width, height) -> "";
    private Supplier<String> deleteImpactProvider = () -> "";
    private String submitLabel = "Erstellen";

    public DungeonMapFormDropdown() {
        panel.getStyleClass().add("dropdown-window");
        panel.setPadding(new Insets(12));

        titleLabel.getStyleClass().add("dropdown-title");
        impactLabel.getStyleClass().add("dropdown-impact");
        impactLabel.setWrapText(true);
        impactLabel.setVisible(false);
        impactLabel.setManaged(false);
        deleteButton.getStyleClass().add("danger");
        deleteButton.setVisible(false);
        deleteButton.setManaged(false);
        confirmDeleteButton.getStyleClass().add("danger");
        confirmDeleteButton.setVisible(false);
        confirmDeleteButton.setManaged(false);
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
        HBox actions = new HBox(8, cancelButton, spacer, deleteButton, confirmDeleteButton, confirmShrinkButton, submitButton);
        actions.getStyleClass().add("dropdown-actions");

        panel.getChildren().addAll(titleLabel, grid, impactLabel, actions);
        dropdown = new AnchoredDropdown(panel);
        dropdown.setOnHidden(this::resetTransientState);

        cancelButton.setOnAction(event -> dropdown.hide());
        deleteButton.setOnAction(event -> prepareDeleteConfirmation());
        confirmDeleteButton.setOnAction(event -> onDelete.run());
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
        submitLabel = "Erstellen";
        submitButton.setText(submitLabel);
        this.onSubmit = onSubmit == null ? result -> { } : onSubmit;
        this.onDelete = () -> { };
        this.shrinkImpactProvider = (width, height) -> "";
        this.deleteImpactProvider = () -> "";
        deleteButton.setVisible(false);
        deleteButton.setManaged(false);
        resetTransientState();
        dropdown.show(anchor);
        dropdown.requestFocus(nameField);
        nameField.selectAll();
    }

    public void showEdit(
            Node anchor,
            DungeonMap map,
            BiFunction<Integer, Integer, String> shrinkImpactProvider,
            Supplier<String> deleteImpactProvider,
            Consumer<Result> onSubmit,
            Runnable onDelete
    ) {
        titleLabel.setText("Dungeon bearbeiten");
        nameField.setText(map.name());
        widthSpinner.getValueFactory().setValue(map.width());
        heightSpinner.getValueFactory().setValue(map.height());
        submitLabel = "Speichern";
        submitButton.setText(submitLabel);
        this.shrinkImpactProvider = shrinkImpactProvider == null ? (width, height) -> "" : shrinkImpactProvider;
        this.deleteImpactProvider = deleteImpactProvider == null ? () -> "" : deleteImpactProvider;
        this.onSubmit = onSubmit == null ? result -> { } : onSubmit;
        this.onDelete = onDelete == null ? () -> { } : onDelete;
        deleteButton.setVisible(true);
        deleteButton.setManaged(true);
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
            confirmDeleteButton.setVisible(false);
            confirmDeleteButton.setManaged(false);
            confirmShrinkButton.setVisible(true);
            confirmShrinkButton.setManaged(true);
            submitButton.setText("Werte prüfen");
            dropdown.requestFocus(confirmShrinkButton);
            return;
        }
        onSubmit.accept(result);
    }

    private void resetTransientState() {
        impactLabel.setText("");
        impactLabel.setVisible(false);
        impactLabel.setManaged(false);
        confirmShrinkButton.setVisible(false);
        confirmShrinkButton.setManaged(false);
        confirmDeleteButton.setVisible(false);
        confirmDeleteButton.setManaged(false);
        submitButton.setText(submitLabel);
    }

    private void resetShrinkConfirmation() {
        if (confirmDeleteButton.isVisible()) {
            return;
        }
        resetTransientState();
    }

    private void prepareDeleteConfirmation() {
        impactLabel.setText(deleteImpactProvider.get());
        impactLabel.setVisible(true);
        impactLabel.setManaged(true);
        confirmShrinkButton.setVisible(false);
        confirmShrinkButton.setManaged(false);
        confirmDeleteButton.setVisible(true);
        confirmDeleteButton.setManaged(true);
        submitButton.setText(submitLabel);
        dropdown.requestFocus(confirmDeleteButton);
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
