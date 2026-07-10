package src.domain.encountertable;

import java.util.List;
import src.domain.encountertable.model.catalog.EncounterTableCandidateData;
import src.domain.encountertable.model.catalog.EncounterTableSummaryData;
import src.domain.encountertable.published.EncounterTableCandidate;
import src.domain.encountertable.published.EncounterTableSummary;

final class EncounterTableCatalogProjection {

    private static final String SOURCE_LABEL = "Encounter table";

    private EncounterTableCatalogProjection() {
    }

    static List<EncounterTableSummary> summaries(List<EncounterTableSummaryData> summaries) {
        return summaries == null
                ? List.of()
                : summaries.stream()
                        .map(summary -> new EncounterTableSummary(
                                summary.tableId(),
                                summary.name(),
                                summary.linkedLootTableId()))
                        .toList();
    }

    static List<EncounterTableCandidate> candidates(List<EncounterTableCandidateData> candidates) {
        return candidates == null
                ? List.of()
                : candidates.stream()
                        .map(EncounterTableCatalogProjection::candidate)
                        .toList();
    }

    private static EncounterTableCandidate candidate(EncounterTableCandidateData candidate) {
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
                candidate.weight(),
                SOURCE_LABEL);
    }
}
