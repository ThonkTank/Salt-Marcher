package src.data.encounter.query;

import java.util.List;
import java.util.Objects;
import src.data.encountertable.query.SqliteEncounterTableCatalogAdapter;
import src.domain.encounter.model.generation.helper.EncounterCandidateProfileHelper;
import src.domain.encounter.model.generation.model.EncounterCandidateProfile;
import src.domain.encounter.model.generation.model.EncounterCreatureFacts;
import src.domain.encounter.model.reference.repository.EncounterTableCandidateRepository;
import src.domain.encounter.model.reference.model.EncounterTableCandidateCriteria;
import src.domain.encountertable.model.catalog.port.EncounterTableCatalog;

public final class ApplicationEncounterTableCandidateRepository implements EncounterTableCandidateRepository {

    private final EncounterTableCatalog encounterTableCatalog;

    public ApplicationEncounterTableCandidateRepository() {
        this(new SqliteEncounterTableCatalogAdapter());
    }

    ApplicationEncounterTableCandidateRepository(EncounterTableCatalog encounterTableCatalog) {
        this.encounterTableCatalog = Objects.requireNonNull(encounterTableCatalog, "encounterTableCatalog");
    }

    @Override
    public List<EncounterCandidateProfile> loadCandidates(EncounterTableCandidateCriteria criteria) {
        EncounterTableCandidateCriteria safeCriteria =
                criteria == null ? new EncounterTableCandidateCriteria(List.of(), 0) : criteria;
        List<Long> normalizedTableIds = safeCriteria.tableIds().stream()
                .filter(Objects::nonNull)
                .filter(tableId -> tableId > 0L)
                .distinct()
                .toList();
        if (normalizedTableIds.isEmpty()) {
            return List.of();
        }
        int effectiveMaximumXp = safeCriteria.maximumXp() <= 0 ? Integer.MAX_VALUE : safeCriteria.maximumXp();
        return encounterTableCatalog.loadGenerationCandidates(normalizedTableIds, effectiveMaximumXp).stream()
                .map(candidate -> EncounterCandidateProfileHelper.fromFacts(
                        new EncounterCreatureFacts(
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
                                0,
                                0,
                                0,
                                0,
                                null,
                                null,
                                null,
                                0,
                                List.of()),
                        candidate.weight()))
                .toList();
    }
}
