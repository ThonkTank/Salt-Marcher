package src.view.encounter.View;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import src.view.encounter.ViewModel.EncounterSnapshot;
import src.view.encounter.ViewModel.EncounterViewModel;

import java.util.Objects;

public final class EncounterRuntimeStatePane {

    private final EncounterViewModel viewModel;
    private final VBox content = new VBox(10);
    private final Label lockSummary = new Label();
    private final Label excludeSummary = new Label();
    private final Label statusText = new Label();
    private final Button lockSelected = new Button("Lock Selected");
    private final Button clearLocks = new Button("Clear Locks");
    private final Button excludeSelected = new Button("Exclude Selected");
    private final Button clearExclusions = new Button("Clear Exclusions");

    public EncounterRuntimeStatePane(EncounterViewModel viewModel) {
        this.viewModel = Objects.requireNonNull(viewModel, "viewModel");
        content.getStyleClass().add("surface-root");
        content.setPadding(new Insets(12));
        lockSummary.setWrapText(true);
        excludeSummary.setWrapText(true);
        statusText.setWrapText(true);
        lockSelected.setMaxWidth(Double.MAX_VALUE);
        clearLocks.setMaxWidth(Double.MAX_VALUE);
        excludeSelected.setMaxWidth(Double.MAX_VALUE);
        clearExclusions.setMaxWidth(Double.MAX_VALUE);
        lockSelected.setOnAction(event -> this.viewModel.lockSelected());
        clearLocks.setOnAction(event -> this.viewModel.clearLocks());
        excludeSelected.setOnAction(event -> this.viewModel.excludeSelected());
        clearExclusions.setOnAction(event -> this.viewModel.clearExclusions());
        content.getChildren().setAll(
                lockSummary,
                excludeSummary,
                statusText,
                lockSelected,
                clearLocks,
                excludeSelected,
                clearExclusions);
        this.viewModel.addChangeListener(this::refreshFromViewModel);
        refreshFromViewModel();
    }

    public Node content() {
        return content;
    }

    private void refreshFromViewModel() {
        EncounterSnapshot snapshot = viewModel.snapshot();
        lockSummary.setText(snapshot.text().lockSummary());
        excludeSummary.setText(snapshot.text().excludeSummary());
        statusText.setText(snapshot.text().statusText());
        lockSelected.setDisable(!snapshot.canLockSelected());
        excludeSelected.setDisable(!snapshot.canExcludeSelected());
    }
}
