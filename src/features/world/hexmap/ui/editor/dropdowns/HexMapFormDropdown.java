package features.world.hexmap.ui.editor.dropdowns;

import features.world.hexmap.model.HexMap;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Spinner;
import javafx.scene.control.SpinnerValueFactory;
import javafx.scene.control.TextField;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import ui.components.AnchoredDropdown;

import java.util.function.Consumer;
import java.util.function.IntUnaryOperator;

public final class HexMapFormDropdown {

    public record Result(String name, int radius) {}

    private final VBox panel = new VBox(10);
    private final AnchoredDropdown dropdown;
    private final Label titleLabel = new Label();
    private final TextField nameField = new TextField();
    private final SpinnerValueFactory.IntegerSpinnerValueFactory radiusValueFactory =
            new SpinnerValueFactory.IntegerSpinnerValueFactory(0, 20, 5);
    private final Spinner<Integer> radiusSpinner = new Spinner<>();
    private final Label impactLabel = new Label();
    private final Button cancelButton = new Button("Abbrechen");
    private final Button submitButton = new Button("Erstellen");
    private final Button confirmShrinkButton = new Button("Verkleinerung bestätigen");
    private Consumer<Result> onSubmit = result -> { };
    private IntUnaryOperator removedTilesForRadius = radius -> 0;
    private int originalRadius = 0;

    public HexMapFormDropdown() {
        panel.getStyleClass().add("dropdown-window");
        panel.setPadding(new Insets(12));

        titleLabel.getStyleClass().add("dropdown-title");
        impactLabel.getStyleClass().add("dropdown-impact");
        impactLabel.setWrapText(true);
        impactLabel.setVisible(false);
        impactLabel.setManaged(false);
        confirmShrinkButton.setVisible(false);
        confirmShrinkButton.setManaged(false);

        radiusSpinner.setValueFactory(radiusValueFactory);
        radiusSpinner.setEditable(true);
        radiusSpinner.setPrefWidth(90);
        radiusSpinner.focusedProperty().addListener((obs, oldValue, focused) -> {
            if (!focused) {
                radiusSpinner.increment(0);
            }
        });

        GridPane grid = new GridPane();
        grid.setHgap(10);
        grid.setVgap(10);
        grid.add(new Label("Name:"), 0, 0);
        grid.add(nameField, 1, 0);
        grid.add(new Label("Radius:"), 0, 1);
        grid.add(radiusSpinner, 1, 1);

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
    }

    public void showCreate(Node anchor, Consumer<Result> onSubmit) {
        titleLabel.setText("Neue Karte");
        nameField.setText("Neue Karte");
        radiusValueFactory.setMin(1);
        radiusValueFactory.setValue(5);
        submitButton.setText("Erstellen");
        removedTilesForRadius = radius -> 0;
        originalRadius = 0;
        this.onSubmit = onSubmit == null ? result -> { } : onSubmit;
        resetTransientState();
        dropdown.show(anchor);
        dropdown.requestFocus(nameField);
        nameField.selectAll();
    }

    public void showEdit(Node anchor, HexMap map, IntUnaryOperator removedTilesForRadius, Consumer<Result> onSubmit) {
        titleLabel.setText("Karte bearbeiten");
        nameField.setText(map.name());
        originalRadius = map.radius() == null ? 0 : map.radius();
        radiusValueFactory.setMin(0);
        radiusValueFactory.setValue(originalRadius);
        submitButton.setText("Speichern");
        this.removedTilesForRadius = removedTilesForRadius == null ? radius -> 0 : removedTilesForRadius;
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
        String name = nameField.getText() == null ? "" : nameField.getText().strip();
        if (name.isBlank()) {
            dropdown.requestFocus(nameField);
            return;
        }
        try {
            radiusSpinner.increment(0);
        } catch (RuntimeException ex) {
            dropdown.requestFocus(radiusSpinner.getEditor());
            return;
        }
        int radius = radiusSpinner.getValue();
        if (!confirmedShrink) {
            if (radius < originalRadius) {
                int lost = removedTilesForRadius.applyAsInt(radius);
                impactLabel.setText("Radius wird verkleinert. " + lost
                        + " Felder werden unwiderruflich gelöscht. Falls die Gruppe dort steht, wird ihre Position zurückgesetzt.");
                impactLabel.setVisible(true);
                impactLabel.setManaged(true);
                confirmShrinkButton.setVisible(true);
                confirmShrinkButton.setManaged(true);
                dropdown.requestFocus(confirmShrinkButton);
                return;
            }
        }
        onSubmit.accept(new Result(name, radius));
    }

    private void resetTransientState() {
        impactLabel.setText("");
        impactLabel.setVisible(false);
        impactLabel.setManaged(false);
        confirmShrinkButton.setVisible(false);
        confirmShrinkButton.setManaged(false);
    }
}
