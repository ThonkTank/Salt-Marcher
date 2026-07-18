package features.catalog.application;

import features.catalog.application.CatalogApplicationRoutes.EncounterHandoff;
import features.encounter.api.OpenSavedEncounterPlanResult;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encounter.api.SavedEncounterPlanListResult;
import features.encounter.api.SavedEncounterPlanStatus;
import features.encounter.api.SavedEncounterPlanSummary;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import platform.ui.UiDispatcher;

/** Owns saved-plan subscription, stable selection, opening, and confirmation. */
public final class SavedEncounterCatalogController implements CatalogLifecycle {

    private final SavedEncounterPlanListModel plans;
    private final EncounterHandoff encounter;
    private final UiDispatcher dispatcher;
    private final Runnable changed;
    private SavedEncounterCatalogState state = SavedEncounterCatalogState.initial();
    private Runnable unsubscribe;

    SavedEncounterCatalogController(
            SavedEncounterPlanListModel plans,
            EncounterHandoff encounter,
            UiDispatcher dispatcher,
            Runnable changed
    ) {
        this.plans = Objects.requireNonNull(plans, "plans");
        this.encounter = Objects.requireNonNull(encounter, "encounter");
        this.dispatcher = Objects.requireNonNull(dispatcher, "dispatcher");
        this.changed = Objects.requireNonNull(changed, "changed");
    }

    public SavedEncounterCatalogState state() {
        return state;
    }

    public void accept(SavedEncounterCatalogIntent intent) {
        if (intent == null || state.lifecycle() == SavedEncounterCatalogState.Lifecycle.CLOSED) {
            return;
        }
        switch (intent) {
            case SavedEncounterCatalogIntent.SelectPlan select -> select(select.planId());
            case SavedEncounterCatalogIntent.OpenPlan open -> beginOpen(open.planId(), false);
            case SavedEncounterCatalogIntent.ConfirmOpen confirm -> confirm(confirm);
            case SavedEncounterCatalogIntent.CancelOpen cancel -> cancel(cancel);
        }
    }

    @Override
    public void activate() {
        if (state.lifecycle() != SavedEncounterCatalogState.Lifecycle.INACTIVE) {
            return;
        }
        replace(state.lifecycleRevision() + 1L, state.openRequestRevision(),
                SavedEncounterCatalogState.Lifecycle.ACTIVE, state.results(), state.selectedPlanId(),
                state.confirmation(), state.actionMessage());
        long lifecycleRevision = state.lifecycleRevision();
        try {
            unsubscribe = plans.observeLatest(result -> dispatcher.dispatch(() -> {
                    if (state.lifecycle() == SavedEncounterCatalogState.Lifecycle.ACTIVE
                            && state.lifecycleRevision() == lifecycleRevision) {
                        apply(result);
                    }
                }));
        } catch (RuntimeException | Error failure) {
            unsubscribe = null;
            rollbackActivation();
            throw failure;
        }
    }

    @Override
    public void deactivate() {
        if (state.lifecycle() != SavedEncounterCatalogState.Lifecycle.ACTIVE) {
            return;
        }
        Runnable current = unsubscribe;
        unsubscribe = null;
        try {
            if (current != null) {
                current.run();
            }
        } finally {
            rollbackActivation();
        }
    }

    private void rollbackActivation() {
        replace(state.lifecycleRevision() + 1L, state.openRequestRevision() + 1L,
                SavedEncounterCatalogState.Lifecycle.INACTIVE, state.results(), state.selectedPlanId(),
                state.confirmation().clear(), state.actionMessage());
    }

    @Override
    public void close() {
        if (state.lifecycle() == SavedEncounterCatalogState.Lifecycle.CLOSED) {
            return;
        }
        deactivate();
        replace(state.lifecycleRevision() + 1L, state.openRequestRevision() + 1L,
                SavedEncounterCatalogState.Lifecycle.CLOSED, state.results(), state.selectedPlanId(),
                state.confirmation().clear(), state.actionMessage());
    }

    private void apply(SavedEncounterPlanListResult result) {
        CatalogResultState<SavedEncounterPlanSummary> results;
        if (result == null || result.status() != SavedEncounterPlanStatus.SUCCESS) {
            String message = result == null ? "Encounter konnten nicht geladen werden." : result.message();
            results = new CatalogResultState<>(CatalogResultState.Status.FAILED, List.of(), message);
        } else {
            results = CatalogResultState.ready(result.plans());
        }
        long selected = results.rows().stream().anyMatch(plan -> plan.planId() == state.selectedPlanId())
                ? state.selectedPlanId() : 0L;
        SavedEncounterCatalogState.Confirmation confirmation = results.rows().stream()
                .anyMatch(plan -> plan.planId() == state.confirmation().planId())
                ? state.confirmation() : state.confirmation().clear();
        replaceKeepingLifecycle(results, selected, confirmation, state.actionMessage());
    }

    private void select(long planId) {
        long selected = Math.max(0L, planId);
        if (selected == state.selectedPlanId()) {
            return;
        }
        replace(state.lifecycleRevision(), state.openRequestRevision() + 1L, state.lifecycle(), state.results(),
                selected, state.confirmation().clear(), "");
    }

    private void beginOpen(long planId, boolean discardUnsavedChanges) {
        if (state.lifecycle() != SavedEncounterCatalogState.Lifecycle.ACTIVE
                || planId <= 0L) {
            return;
        }
        Optional<SavedEncounterPlanSummary> visiblePlan = visiblePlan(planId);
        if (visiblePlan.isEmpty()) {
            return;
        }
        SavedEncounterPlanSummary plan = visiblePlan.orElseThrow();
        long lifecycleRevision = state.lifecycleRevision();
        long requestRevision = state.openRequestRevision() + 1L;
        replace(lifecycleRevision, requestRevision, state.lifecycle(), state.results(), state.selectedPlanId(),
                state.confirmation().clear(), "Encounter wird geöffnet …");
        encounter.openSavedEncounter(planId, discardUnsavedChanges)
                .whenComplete((result, failure) -> dispatcher.dispatch(() ->
                        completeOpen(lifecycleRevision, requestRevision, plan, discardUnsavedChanges,
                                result, failure)));
    }

    private void completeOpen(
            long lifecycleRevision,
            long requestRevision,
            SavedEncounterPlanSummary plan,
            boolean confirmed,
            OpenSavedEncounterPlanResult result,
            Throwable failure
    ) {
        if (!acceptsOpen(lifecycleRevision, requestRevision, plan.planId())) {
            return;
        }
        if (failure != null || result == null) {
            replaceKeepingLifecycle(state.results(), state.selectedPlanId(), state.confirmation().clear(),
                    "Encounter konnte nicht geöffnet werden.");
            return;
        }
        if (result.planId() > 0L && result.planId() != plan.planId()) {
            replaceKeepingLifecycle(state.results(), state.selectedPlanId(), state.confirmation().clear(),
                    "Encounter konnte nicht geöffnet werden.");
            return;
        }
        if (result.status() == OpenSavedEncounterPlanResult.Status.CONFIRMATION_REQUIRED && !confirmed) {
            SavedEncounterCatalogState.Confirmation pending = new SavedEncounterCatalogState.Confirmation(
                    state.confirmation().revision() + 1L, plan.planId(), plan.name(), true);
            replaceKeepingLifecycle(state.results(), state.selectedPlanId(), pending, result.message());
            return;
        }
        if (result.status() == OpenSavedEncounterPlanResult.Status.CONFIRMATION_REQUIRED) {
            replaceKeepingLifecycle(state.results(), state.selectedPlanId(), state.confirmation().clear(),
                    "Encounter konnte nach Bestätigung nicht geöffnet werden.");
            return;
        }
        replaceKeepingLifecycle(state.results(), state.selectedPlanId(), state.confirmation().clear(),
                result.message());
    }

    private void confirm(SavedEncounterCatalogIntent.ConfirmOpen intent) {
        if (!matchesPending(intent.confirmationRevision(), intent.planId())) {
            return;
        }
        beginOpen(intent.planId(), true);
    }

    private void cancel(SavedEncounterCatalogIntent.CancelOpen intent) {
        if (!matchesPending(intent.confirmationRevision(), intent.planId())) {
            return;
        }
        replace(state.lifecycleRevision(), state.openRequestRevision() + 1L, state.lifecycle(), state.results(),
                state.selectedPlanId(), state.confirmation().clear(), "Öffnen abgebrochen.");
    }

    private boolean matchesPending(long confirmationRevision, long planId) {
        SavedEncounterCatalogState.Confirmation confirmation = state.confirmation();
        return confirmation.required()
                && confirmation.revision() == confirmationRevision
                && confirmation.planId() == planId;
    }

    private boolean acceptsOpen(long lifecycleRevision, long requestRevision, long planId) {
        return state.lifecycle() == SavedEncounterCatalogState.Lifecycle.ACTIVE
                && state.lifecycleRevision() == lifecycleRevision
                && state.openRequestRevision() == requestRevision
                && visiblePlan(planId).isPresent();
    }

    private Optional<SavedEncounterPlanSummary> visiblePlan(long planId) {
        return state.results().rows().stream().filter(plan -> plan.planId() == planId).findFirst();
    }

    private void replaceKeepingLifecycle(
            CatalogResultState<SavedEncounterPlanSummary> results,
            long selectedPlanId,
            SavedEncounterCatalogState.Confirmation confirmation,
            String actionMessage
    ) {
        replace(state.lifecycleRevision(), state.openRequestRevision(), state.lifecycle(), results,
                selectedPlanId, confirmation, actionMessage);
    }

    private void replace(
            long lifecycleRevision,
            long openRequestRevision,
            SavedEncounterCatalogState.Lifecycle lifecycle,
            CatalogResultState<SavedEncounterPlanSummary> results,
            long selectedPlanId,
            SavedEncounterCatalogState.Confirmation confirmation,
            String actionMessage
    ) {
        state = new SavedEncounterCatalogState(
                state.revision() + 1L, lifecycleRevision, openRequestRevision, lifecycle,
                results, selectedPlanId, confirmation, actionMessage);
        changed.run();
    }
}
