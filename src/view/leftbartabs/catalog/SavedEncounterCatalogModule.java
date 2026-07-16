package src.view.leftbartabs.catalog;

import java.util.function.BooleanSupplier;
import java.util.function.LongConsumer;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Alert;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonType;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.input.KeyCode;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.encounter.published.EncounterStateModel;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanSummary;

final class SavedEncounterCatalogModule {

    private final LongConsumer opener;
    private final BooleanSupplier confirmation;
    private final ListView<SavedEncounterPlanSummary> plans = new ListView<>();
    private final Label status = new Label();
    private final VBox controls = new VBox(6);
    private final VBox main = new VBox(8);
    private EncounterStateSnapshot encounterState;

    SavedEncounterCatalogModule(
            EncounterApplicationService encounters,
            SavedEncounterPlanListModel savedPlans,
            EncounterStateModel state
    ) {
        this(planId -> encounters.applyState(ApplyEncounterStateCommand.openSavedPlan(planId)),
                savedPlans, state, SavedEncounterCatalogModule::confirmReplacement);
    }

    SavedEncounterCatalogModule(
            LongConsumer opener,
            SavedEncounterPlanListModel savedPlans,
            EncounterStateModel state,
            BooleanSupplier confirmation
    ) {
        this.opener = opener;
        this.confirmation = confirmation;
        configure();
        savedPlans.subscribe(this::render);
        state.subscribe(snapshot -> encounterState = snapshot);
        encounterState = state.current();
        render(savedPlans.current());
    }

    Node controls() {
        return controls;
    }

    Node main() {
        return main;
    }

    private void configure() {
        Label title = new Label("GESPEICHERTE ENCOUNTER");
        title.getStyleClass().add("catalog-section-title");
        Label guidance = new Label("Speichern und Kampfsteuerung bleiben rechts im Encounter-State.");
        guidance.getStyleClass().add("text-muted");
        guidance.setWrapText(true);
        controls.getChildren().setAll(title, guidance);

        plans.setCellFactory(ignored -> new SavedPlanCell());
        plans.setOnMouseClicked(event -> {
            if (event.getClickCount() == 2) {
                openSelected();
            }
        });
        plans.setOnKeyPressed(event -> {
            if (event.getCode() == KeyCode.ENTER) {
                openSelected();
            }
        });
        Button open = new Button("Im Encounter öffnen");
        open.setOnAction(event -> openSelected());
        HBox footer = new HBox(8, open, status);
        footer.setAlignment(Pos.CENTER_LEFT);
        main.getChildren().setAll(plans, footer);
        main.setVgrow(plans, Priority.ALWAYS);
    }

    private void render(SavedEncounterPlanListResult result) {
        plans.getItems().setAll(result.plans());
        status.setText(result.message().isBlank()
                ? result.plans().size() + " gespeicherte Encounter"
                : result.message());
    }

    private void openSelected() {
        SavedEncounterPlanSummary selected = plans.getSelectionModel().getSelectedItem();
        if (selected == null || selected.planId() <= 0L) {
            return;
        }
        if (replacementNeedsConfirmation() && !confirmation.getAsBoolean()) {
            return;
        }
        opener.accept(selected.planId());
    }

    private boolean replacementNeedsConfirmation() {
        if (encounterState == null) {
            return false;
        }
        return encounterState.activeMode() != EncounterStateSnapshot.Mode.BUILDER
                || encounterState.builderPane().hasUnsavedRosterChanges();
    }

    private static boolean confirmReplacement() {
        Alert alert = new Alert(
                Alert.AlertType.CONFIRMATION,
                "Der aktuelle, nicht gespeicherte Encounter-Zustand wird ersetzt.",
                ButtonType.CANCEL,
                ButtonType.OK);
        alert.setTitle("Encounter ersetzen?");
        alert.setHeaderText("Gespeichertes Encounter öffnen");
        return alert.showAndWait().filter(ButtonType.OK::equals).isPresent();
    }

    private static final class SavedPlanCell extends ListCell<SavedEncounterPlanSummary> {
        @Override
        protected void updateItem(SavedEncounterPlanSummary plan, boolean empty) {
            super.updateItem(plan, empty);
            setText(empty || plan == null ? null : plan.name() + "  ·  " + plan.summaryText());
        }
    }
}
