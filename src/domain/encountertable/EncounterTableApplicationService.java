package src.domain.encountertable;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.encountertable.application.LoadEncounterTableCandidatesUseCase;
import src.domain.encountertable.application.LoadEncounterTableSummariesUseCase;
import src.domain.encountertable.catalog.port.EncounterTableCatalog;
import src.domain.encountertable.catalog.value.EncounterTableCandidateData;
import src.domain.encountertable.catalog.value.EncounterTableSummaryData;
import src.domain.encountertable.published.EncounterTableCandidate;
import src.domain.encountertable.published.EncounterTableCandidatesResult;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.encountertable.published.EncounterTableCatalogModel;
import src.domain.encountertable.published.EncounterTableReadStatus;
import src.domain.encountertable.published.EncounterTableSummary;
import src.domain.encountertable.published.LoadEncounterTableCandidatesQuery;
import src.domain.encountertable.published.LoadEncounterTableSummariesQuery;

@SuppressWarnings("PMD.AvoidCatchingGenericException")
public final class EncounterTableApplicationService {

    private final LoadEncounterTableSummariesUseCase loadSummariesUseCase;
    private final LoadEncounterTableCandidatesUseCase loadCandidatesUseCase;
    private final List<Consumer<EncounterTableCatalogResult>> catalogListeners = new ArrayList<>();
    private final EncounterTableCatalogModel catalogModel = new EncounterTableCatalogModel(
            this::currentCatalogResult,
            this::subscribeCatalogListener);
    private EncounterTableCatalogResult currentCatalogResult =
            new EncounterTableCatalogResult(EncounterTableReadStatus.STORAGE_ERROR, List.of());

    public EncounterTableApplicationService(EncounterTableCatalog catalog) {
        EncounterTableCatalog safeCatalog = Objects.requireNonNull(catalog, "catalog");
        this.loadSummariesUseCase = new LoadEncounterTableSummariesUseCase(safeCatalog);
        this.loadCandidatesUseCase = new LoadEncounterTableCandidatesUseCase(safeCatalog);
    }

    public EncounterTableCatalogResult loadSummaries(LoadEncounterTableSummariesQuery query) {
        try {
            currentCatalogResult = new EncounterTableCatalogResult(
                    EncounterTableReadStatus.SUCCESS,
                    loadSummariesUseCase.execute().stream()
                            .map(EncounterTableApplicationService::toPublishedSummary)
                            .toList());
        } catch (RuntimeException exception) {
            currentCatalogResult = new EncounterTableCatalogResult(EncounterTableReadStatus.STORAGE_ERROR, List.of());
        }
        notifyCatalogListeners(currentCatalogResult);
        return currentCatalogResult;
    }

    public EncounterTableCandidatesResult loadGenerationCandidates(LoadEncounterTableCandidatesQuery query) {
        LoadEncounterTableCandidatesQuery effectiveQuery = query == null
                ? new LoadEncounterTableCandidatesQuery(List.of(), 0)
                : query;
        try {
            return new EncounterTableCandidatesResult(
                    EncounterTableReadStatus.SUCCESS,
                    loadCandidatesUseCase.execute(effectiveQuery.tableIds(), effectiveQuery.maximumXp()).stream()
                            .map(EncounterTableApplicationService::toPublishedCandidate)
                            .toList());
        } catch (RuntimeException exception) {
            return new EncounterTableCandidatesResult(EncounterTableReadStatus.STORAGE_ERROR, List.of());
        }
    }

    public EncounterTableCatalogModel loadCatalogModel(LoadEncounterTableSummariesQuery query) {
        Objects.requireNonNull(query, "query");
        return catalogModel;
    }

    private EncounterTableCatalogResult currentCatalogResult() {
        return currentCatalogResult;
    }

    private Runnable subscribeCatalogListener(Consumer<EncounterTableCatalogResult> listener) {
        Consumer<EncounterTableCatalogResult> safeListener = Objects.requireNonNull(listener, "listener");
        catalogListeners.add(safeListener);
        return () -> catalogListeners.remove(safeListener);
    }

    private void notifyCatalogListeners(EncounterTableCatalogResult result) {
        for (Consumer<EncounterTableCatalogResult> listener : List.copyOf(catalogListeners)) {
            listener.accept(result);
        }
    }

    private static EncounterTableSummary toPublishedSummary(EncounterTableSummaryData summary) {
        return new EncounterTableSummary(summary.tableId(), summary.name(), summary.linkedLootTableId());
    }

    private static EncounterTableCandidate toPublishedCandidate(EncounterTableCandidateData candidate) {
        return new EncounterTableCandidate(
                candidate.creatureId(),
                candidate.name(),
                candidate.creatureType(),
                candidate.challengeRating(),
                candidate.xp(),
                candidate.hitPoints(),
                candidate.hitDiceCount(),
                candidate.hitDiceSides(),
                candidate.hitDiceModifier(),
                candidate.armorClass(),
                candidate.initiativeBonus(),
                candidate.legendaryActionCount(),
                candidate.weight());
    }
}
