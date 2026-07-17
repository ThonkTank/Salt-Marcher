package features.catalog.adapter.javafx;

import features.encounter.api.EncounterApi;
import features.encounter.api.OpenSavedEncounterPlanCommand;
import features.encounter.api.OpenSavedEncounterPlanResult;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encounter.api.SavedEncounterPlanListResult;
import features.encounter.api.SavedEncounterPlanSummary;
import java.util.List;
import javafx.application.Platform;
import javafx.beans.property.SimpleStringProperty;
import javafx.scene.Node;
import javafx.scene.control.Alert;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonType;
import javafx.scene.control.Label;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.input.MouseButton;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.VBox;

final class SavedEncounterCatalogSection implements CatalogSection {

    private final EncounterApi encounters;
    private final TableView<SavedEncounterPlanSummary> plans = new TableView<>();
    private final Label status = new Label();
    private final VBox controls;
    private final BorderPane content = new BorderPane();

    SavedEncounterCatalogSection(EncounterApi encounters, SavedEncounterPlanListModel savedPlans) {
        this.encounters = encounters;
        plans.setAccessibleText("Gespeicherte Encounter");
        plans.setPlaceholder(new Label("Keine gespeicherten Encounter verfügbar."));
        plans.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);
        plans.getColumns().setAll(
                textColumn("Name", SavedEncounterPlanSummary::name),
                textColumn("Zusammenfassung", SavedEncounterPlanSummary::summaryText));
        plans.setOnMouseClicked(event -> {
            if (event.getButton() == MouseButton.PRIMARY && event.getClickCount() == 2) {
                open(false);
            }
        });
        Button open = new Button("Im Encounter öffnen");
        open.getStyleClass().add("accent");
        open.setOnAction(ignored -> open(false));
        status.setWrapText(true);
        status.getStyleClass().add("text-secondary");
        controls = new VBox(
                heading("Gespeicherte Encounter"),
                description("Wähle einen gespeicherten Plan und öffne ihn im globalen Encounter-Bereich."),
                open,
                status);
        controls.getStyleClass().add("catalog-section-intro");
        content.setCenter(plans);
        savedPlans.subscribe(this::apply);
        apply(savedPlans.current());
    }

    @Override
    public CatalogSectionId id() {
        return CatalogSectionId.SAVED_ENCOUNTERS;
    }

    @Override
    public Node controls() {
        return controls;
    }

    @Override
    public Node content() {
        return content;
    }

    private void apply(SavedEncounterPlanListResult result) {
        long selectedId = plans.getSelectionModel().getSelectedItem() == null
                ? 0L : plans.getSelectionModel().getSelectedItem().planId();
        plans.getItems().setAll(result == null ? List.of() : result.plans());
        plans.getItems().stream().filter(plan -> plan.planId() == selectedId).findFirst()
                .ifPresent(plan -> plans.getSelectionModel().select(plan));
        status.setText(result == null ? "" : result.message());
    }

    private void open(boolean confirmed) {
        SavedEncounterPlanSummary selected = plans.getSelectionModel().getSelectedItem();
        if (selected == null) {
            status.setText("Wähle zuerst einen Encounter aus.");
            return;
        }
        encounters.openSavedPlan(new OpenSavedEncounterPlanCommand(selected.planId(), confirmed))
                .whenComplete((result, failure) -> runOnFx(() -> handleOpen(selected, result, failure)));
    }

    private void handleOpen(
            SavedEncounterPlanSummary selected,
            OpenSavedEncounterPlanResult result,
            Throwable failure
    ) {
        if (failure != null || result == null) {
            status.setText("Encounter konnte nicht geöffnet werden.");
            return;
        }
        status.setText(result.message());
        if (result.status() != OpenSavedEncounterPlanResult.Status.CONFIRMATION_REQUIRED) {
            return;
        }
        Alert confirmation = new Alert(Alert.AlertType.CONFIRMATION);
        confirmation.setTitle("Ungespeicherte Änderungen");
        confirmation.setHeaderText("Aktuellen Encounter verwerfen?");
        confirmation.setContentText(selected.name() + " öffnen und ungespeicherte Änderungen verwerfen?");
        confirmation.showAndWait().filter(ButtonType.OK::equals).ifPresent(ignored -> open(true));
    }

    private static Label heading(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("catalog-section-heading");
        return label;
    }

    private static TableColumn<SavedEncounterPlanSummary, String> textColumn(
            String title,
            java.util.function.Function<SavedEncounterPlanSummary, String> value
    ) {
        TableColumn<SavedEncounterPlanSummary, String> column = new TableColumn<>(title);
        column.setCellValueFactory(cell -> new SimpleStringProperty(value.apply(cell.getValue())));
        return column;
    }

    private static Label description(String text) {
        Label label = new Label(text);
        label.setWrapText(true);
        label.getStyleClass().add("text-secondary");
        return label;
    }

    private static void runOnFx(Runnable action) {
        if (Platform.isFxApplicationThread()) {
            action.run();
        } else {
            Platform.runLater(action);
        }
    }
}
