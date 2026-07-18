package features.catalog.adapter.javafx;

import features.catalog.application.CatalogSectionId;
import features.catalog.application.SavedEncounterCatalogIntent;
import features.catalog.application.SavedEncounterCatalogState;
import features.encounter.api.SavedEncounterPlanSummary;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;

/** Passive saved-Encounter renderer backed only by immutable application state. */
public final class SavedEncounterCatalogSection implements CatalogSection {

    private final Consumer<SavedEncounterCatalogIntent> intents;
    private final Button open = new Button("Im Encounter öffnen");
    private final Button confirm = new Button("Verwerfen und öffnen");
    private final Button cancel = new Button("Abbrechen");
    private final Label status = new Label();
    private final Label confirmation = new Label();
    private final HBox confirmationActions = new HBox(confirm, cancel);
    private final CatalogControlsScaffold controls;
    private final CatalogTableScaffold<SavedEncounterPlanSummary, Long> content;
    private SavedEncounterCatalogState state;
    private long renderedRevision = -1L;

    public SavedEncounterCatalogSection(Consumer<SavedEncounterCatalogIntent> intents) {
        this.intents = Objects.requireNonNull(intents, "intents");
        content = new CatalogTableScaffold<>(
                "Gespeicherte Encounter",
                SavedEncounterPlanSummary::planId,
                SavedEncounterPlanSummary::name,
                List.of(
                        new CatalogTableScaffold.ColumnSpec<>("Name", SavedEncounterPlanSummary::name),
                        new CatalogTableScaffold.ColumnSpec<>(
                                "Zusammenfassung", SavedEncounterPlanSummary::summaryText)),
                plan -> this.intents.accept(new SavedEncounterCatalogIntent.OpenPlan(plan.planId())),
                planId -> this.intents.accept(new SavedEncounterCatalogIntent.SelectPlan(planId.orElse(0L))),
                List.of());
        open.getStyleClass().add("accent");
        open.setAccessibleText("Ausgewählten Encounter im globalen Encounter öffnen");
        open.disableProperty().bind(content.table().getSelectionModel().selectedItemProperty().isNull());
        open.setOnAction(ignored -> {
            if (state != null) {
                this.intents.accept(new SavedEncounterCatalogIntent.OpenPlan(state.selectedPlanId()));
            }
        });
        confirm.getStyleClass().add("accent");
        confirm.setAccessibleText("Verwerfen und öffnen");
        confirm.setOnAction(ignored -> confirmPending());
        cancel.setAccessibleText("Öffnen abbrechen");
        cancel.setOnAction(ignored -> cancelPending());
        status.setWrapText(true);
        status.setAccessibleText("Gespeicherte-Encounter-Aktionsstatus");
        status.getStyleClass().add("text-secondary");
        confirmation.setWrapText(true);
        confirmation.setAccessibleText("Ungespeicherte Änderungen bestätigen");
        confirmationActions.getStyleClass().add("catalog-confirmation-actions");
        controls = new CatalogControlsScaffold("AKTIONEN");
        controls.setActions(open);
        controls.setFeedback(status, confirmation, confirmationActions);
        showStatus(false);
        showConfirmation(false);
    }

    @Override
    public CatalogSectionId id() {
        return CatalogSectionId.SAVED_ENCOUNTERS;
    }

    @Override
    public CatalogControlsScaffold controls() {
        return controls;
    }

    @Override
    public Node content() {
        return content;
    }

    public void render(SavedEncounterCatalogState next) {
        state = Objects.requireNonNull(next, "next");
        if (state.revision() == renderedRevision) {
            return;
        }
        renderedRevision = state.revision();
        content.render(
                state.results(),
                state.selectedPlanId() > 0L ? Optional.of(state.selectedPlanId()) : Optional.empty(),
                state.results().rows().size(), Math.max(1, state.results().rows().size()), 0,
                "Encounter");
        status.setText(state.actionMessage());
        showStatus(!state.actionMessage().isBlank());
        SavedEncounterCatalogState.Confirmation pending = state.confirmation();
        showConfirmation(pending.required());
        confirmation.setText(pending.required()
                ? pending.planName() + " öffnen und ungespeicherte Änderungen verwerfen?" : "");
    }

    private void confirmPending() {
        if (state == null || !state.confirmation().required()) {
            return;
        }
        SavedEncounterCatalogState.Confirmation pending = state.confirmation();
        intents.accept(new SavedEncounterCatalogIntent.ConfirmOpen(pending.revision(), pending.planId()));
    }

    private void cancelPending() {
        if (state == null || !state.confirmation().required()) {
            return;
        }
        SavedEncounterCatalogState.Confirmation pending = state.confirmation();
        intents.accept(new SavedEncounterCatalogIntent.CancelOpen(pending.revision(), pending.planId()));
    }

    private void showConfirmation(boolean visible) {
        confirmation.setVisible(visible);
        confirmation.setManaged(visible);
        confirmationActions.setVisible(visible);
        confirmationActions.setManaged(visible);
    }

    private void showStatus(boolean visible) {
        status.setVisible(visible);
        status.setManaged(visible);
    }
}
