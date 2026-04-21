package src.domain.encountertable;

import java.util.List;
import java.util.Objects;
import src.domain.encountertable.application.LoadEncounterTableCandidatesUseCase;
import src.domain.encountertable.application.LoadEncounterTableSummariesUseCase;
import src.domain.encountertable.catalog.port.EncounterTableCatalog;
import src.domain.encountertable.catalog.value.EncounterTableCandidateData;
import src.domain.encountertable.catalog.value.EncounterTableSummaryData;
import src.domain.encountertable.published.EncounterTableCandidate;
import src.domain.encountertable.published.EncounterTableCandidatesResult;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.encountertable.published.EncounterTableReadStatus;
import src.domain.encountertable.published.EncounterTableSummary;
import src.domain.encountertable.published.LoadEncounterTableCandidatesQuery;
import src.domain.encountertable.published.LoadEncounterTableSummariesQuery;

@SuppressWarnings("PMD.AvoidCatchingGenericException")
public final class EncounterTableApplicationService {

    private final LoadEncounterTableSummariesUseCase loadSummariesUseCase;
    private final LoadEncounterTableCandidatesUseCase loadCandidatesUseCase;

    public EncounterTableApplicationService(EncounterTableCatalog catalog) {
        EncounterTableCatalog safeCatalog = Objects.requireNonNull(catalog, "catalog");
        this.loadSummariesUseCase = new LoadEncounterTableSummariesUseCase(safeCatalog);
        this.loadCandidatesUseCase = new LoadEncounterTableCandidatesUseCase(safeCatalog);
    }

    public EncounterTableCatalogResult loadSummaries(LoadEncounterTableSummariesQuery query) {
        try {
            return new EncounterTableCatalogResult(
                    EncounterTableReadStatus.SUCCESS,
                    loadSummariesUseCase.execute().stream()
                            .map(EncounterTableApplicationService::toPublishedSummary)
                            .toList());
        } catch (RuntimeException exception) {
            return new EncounterTableCatalogResult(EncounterTableReadStatus.STORAGE_ERROR, List.of());
        }
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
