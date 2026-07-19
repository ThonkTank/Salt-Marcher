package features.catalog.application;

import features.catalog.application.CatalogApplicationRoutes.EncounterHandoff;
import features.encounter.api.OpenSavedEncounterPlanResult;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encounter.api.SavedEncounterPlanListResult;
import features.encounter.api.SavedEncounterPlanStatus;
import features.encounter.api.SavedEncounterPlanSummary;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import java.util.List;
import java.util.Optional;

/** Saved-Encounter provider translation and explicit open action. */
public final class SavedEncounterCatalogDefinition
        implements CatalogSectionDefinition<NoCatalogQuery, SavedEncounterPlanSummary, Long> {

    private final SavedEncounterPlanListModel plans;
    private final EncounterHandoff encounter;
    private final AtomicLong providerRevision = new AtomicLong();

    public SavedEncounterCatalogDefinition(SavedEncounterPlanListModel plans, EncounterHandoff encounter) {
        this.plans = Objects.requireNonNull(plans, "plans");
        this.encounter = Objects.requireNonNull(encounter, "encounter");
    }

    @Override public CatalogSectionId id() {
        return CatalogSectionId.SAVED_ENCOUNTERS;
    }

    @Override public NoCatalogQuery initialQuery() {
        return NoCatalogQuery.INSTANCE;
    }

    @Override
    public CompletionStage<CatalogBrowseResult<NoCatalogQuery, SavedEncounterPlanSummary>> query(
            CatalogBrowseRequest<NoCatalogQuery> request
    ) {
        SavedEncounterPlanListResult current = plans.current();
        CatalogResultState<SavedEncounterPlanSummary> result = current.status() == SavedEncounterPlanStatus.SUCCESS
                ? CatalogResultState.ready(current.plans())
                : CatalogResultState.failed(current.message().isBlank()
                        ? "Encounter konnten nicht geladen werden." : current.message());
        return CompletableFuture.completedFuture(CatalogBrowseResult.firstPage(
                request.query(), result, providerRevision.incrementAndGet()));
    }

    @Override public Long key(SavedEncounterPlanSummary row) {
        return row.planId();
    }

    @Override
    public CatalogPresentationSpec<NoCatalogQuery, SavedEncounterPlanSummary, Long> presentation() {
        return new CatalogPresentationSpec<>(
                "Gespeicherte Encounter", "Encounter", SavedEncounterPlanSummary::name, List.of(),
                List.of(
                        new CatalogColumnSpec<>("Name", SavedEncounterPlanSummary::name),
                        new CatalogColumnSpec<>("Zusammenfassung", SavedEncounterPlanSummary::summaryText)),
                Optional.of(new CatalogActionSpec(
                        CatalogActionId.OPEN, "Im Encounter öffnen", "Gespeicherten Encounter öffnen", "Öffnen",
                        CatalogActionSpec.Emphasis.PRIMARY)),
                List.of(), List.of(), false);
    }

    @Override
    public Runnable observeProvider(Consumer<CatalogProviderChange<NoCatalogQuery>> listener) {
        return plans.subscribe(ignored -> {
            providerRevision.incrementAndGet();
            listener.accept(CatalogProviderChange.invalidated());
        });
    }

    public CompletionStage<OpenSavedEncounterPlanResult> open(long planId, boolean discardUnsavedChanges) {
        return encounter.openSavedEncounter(planId, discardUnsavedChanges);
    }
}
