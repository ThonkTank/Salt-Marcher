package src.view.encounter.interactor;

import javafx.beans.binding.Bindings;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import src.view.encounter.Controller.EncounterController;
import src.view.encounter.Model.EncounterModel;

import java.util.Objects;

final class EncounterRuntimeStatePane {

    private final EncounterModel model;
    private final EncounterController controller;
    private final VBox content = new VBox(10);

    EncounterRuntimeStatePane(EncounterModel model, EncounterController controller) {
        this.model = Objects.requireNonNull(model, "model");
        this.controller = Objects.requireNonNull(controller, "controller");
        content.getStyleClass().add("scene-pane");
        content.setPadding(new Insets(12));
        content.getChildren().setAll(
                summaryLabel(model.lockSummaryProperty()),
                summaryLabel(model.excludeSummaryProperty()),
                summaryLabel(model.statusTextProperty()),
                actionButton("Lock Selected", true, controller::lockSelected),
                actionButton("Clear Locks", false, controller::clearLocks),
                actionButton("Exclude Selected", true, controller::excludeSelected),
                actionButton("Clear Exclusions", false, controller::clearExclusions));
    }

    Node content() {
        return content;
    }

    private Label summaryLabel(javafx.beans.property.StringProperty property) {
        Label label = new Label();
        label.textProperty().bind(property);
        label.setWrapText(true);
        return label;
    }

    private Button actionButton(String text, boolean requiresSelection, Runnable action) {
        Button button = new Button(text);
        button.setMaxWidth(Double.MAX_VALUE);
        button.setOnAction(event -> action.run());
        if (requiresSelection) {
            button.disableProperty().bind(Bindings.isNull(model.selectedAlternativeProperty()));
        }
        return button;
    }
}
