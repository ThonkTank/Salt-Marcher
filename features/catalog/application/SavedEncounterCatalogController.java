package features.catalog.application;

import features.encounter.api.SavedEncounterPlanListModel;
import features.encounter.api.SavedEncounterPlanListResult;
import features.encounter.api.SavedEncounterPlanStatus;
import java.util.List;
import java.util.Objects;

public final class SavedEncounterCatalogController implements CatalogLifecycle {

    private final SavedEncounterPlanListModel plans;
    private final Runnable changed;
    private SavedEncounterCatalogState state = SavedEncounterCatalogState.initial();
    private Runnable unsubscribe = () -> { };
    private long lifecycleEpoch;
    private boolean active;

    SavedEncounterCatalogController(SavedEncounterPlanListModel plans, Runnable changed) {
        this.plans = Objects.requireNonNull(plans, "plans");
        this.changed = Objects.requireNonNull(changed, "changed");
    }

    public SavedEncounterCatalogState state() {
        return state;
    }

    @Override
    public void activate() {
        if (active) {
            return;
        }
        active = true;
        long epoch = ++lifecycleEpoch;
        unsubscribe = CurrentFirstSubscription.open(
                plans::current, plans::subscribe, result -> {
                    if (active && lifecycleEpoch == epoch) {
                        apply(result);
                    }
                });
    }

    private void apply(SavedEncounterPlanListResult result) {
        CatalogResultState<features.encounter.api.SavedEncounterPlanSummary> results =
                result.status() == SavedEncounterPlanStatus.SUCCESS
                        ? CatalogResultState.ready(result.plans())
                        : new CatalogResultState<>(CatalogResultState.Status.FAILED, List.of(), result.message());
        state = new SavedEncounterCatalogState(results, state.selectedPlanId());
        changed.run();
    }

    @Override
    public void deactivate() {
        if (!active) {
            return;
        }
        active = false;
        lifecycleEpoch++;
        unsubscribe.run();
        unsubscribe = () -> { };
    }

    @Override
    public void close() {
        deactivate();
    }
}
