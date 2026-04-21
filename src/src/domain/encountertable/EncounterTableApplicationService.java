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

@SuppressWarnings("PMD.AvoidCatchingGenericException")
public final class EncounterTableApplicationService {

    private final LoadEncounterTableSummariesUseCase loadSummariesUseCase;
    private final LoadEncounterTableCandidatesUseCase loadCandidatesUseCase;

    public EncounterTableApplicationService(EncounterTableCatalog catalog) {
        EncounterTableCatalog safeCatalog = Objects.requireNonNull(catalog, "catalog");
        this.loadSummariesUseCase = new LoadEncounterTableSummariesUseCase(safeCatalog);
        this.loadCandidatesUseCase = new LoadEncounterTableCandidatesUseCase(safeCatalog);
    }

    public EncounterTableCatalogResult loadSummaries() {
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

    public EncounterTableCandidatesResult loadGenerationCandidates(List<Long> tableIds, int maximumXp) {
        try {
            return new EncounterTableCandidatesResult(
                    EncounterTableReadStatus.SUCCESS,
                    loadCandidatesUseCase.execute(tableIds, maximumXp).stream()
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
