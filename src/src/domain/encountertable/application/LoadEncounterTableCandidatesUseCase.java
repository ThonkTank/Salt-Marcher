package src.domain.encountertable.application;

import java.util.List;
import java.util.Objects;
import src.domain.encountertable.catalog.port.EncounterTableCatalog;
import src.domain.encountertable.catalog.value.EncounterTableCandidateData;

public final class LoadEncounterTableCandidatesUseCase {

    private final EncounterTableCatalog catalog;

    public LoadEncounterTableCandidatesUseCase(EncounterTableCatalog catalog) {
        this.catalog = Objects.requireNonNull(catalog, "catalog");
    }

    public List<EncounterTableCandidateData> execute(List<Long> tableIds, int maximumXp) {
        List<Long> normalizedTableIds = normalizeIds(tableIds);
        if (normalizedTableIds.isEmpty()) {
            return List.of();
        }
        int effectiveMaximumXp = maximumXp <= 0 ? Integer.MAX_VALUE : maximumXp;
        return catalog.loadGenerationCandidates(normalizedTableIds, effectiveMaximumXp);
    }

    private static List<Long> normalizeIds(List<Long> tableIds) {
        if (tableIds == null || tableIds.isEmpty()) {
            return List.of();
        }
        return tableIds.stream()
                .filter(Objects::nonNull)
                .filter(tableId -> tableId > 0)
                .distinct()
                .toList();
    }
}
