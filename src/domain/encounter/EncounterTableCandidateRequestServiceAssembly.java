package src.domain.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.encounter.model.reference.model.EncounterTableCandidateCriteria;
import src.domain.encounter.model.reference.repository.EncounterTableCandidateRepository;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.published.RefreshEncounterTableCandidatesCommand;

final class EncounterTableCandidateRequestServiceAssembly implements EncounterTableCandidateRepository {

    private final EncounterTableApplicationService encounterTables;

    EncounterTableCandidateRequestServiceAssembly(EncounterTableApplicationService encounterTables) {
        this.encounterTables = Objects.requireNonNull(encounterTables, "encounterTables");
    }

    @Override
    public void requestCandidates(EncounterTableCandidateCriteria criteria) {
        EncounterTableCandidateCriteria safeCriteria =
                criteria == null ? new EncounterTableCandidateCriteria(List.of(), 0) : criteria;
        List<Long> normalizedTableIds = new ArrayList<>();
        for (Long tableId : safeCriteria.tableIds()) {
            if (tableId != null && tableId > 0L && !normalizedTableIds.contains(tableId)) {
                normalizedTableIds.add(tableId);
            }
        }
        if (normalizedTableIds.isEmpty()) {
            return;
        }
        int effectiveMaximumXp = safeCriteria.maximumXp() <= 0 ? Integer.MAX_VALUE : safeCriteria.maximumXp();
        encounterTables.refreshCandidates(new RefreshEncounterTableCandidatesCommand(
                List.copyOf(normalizedTableIds),
                effectiveMaximumXp));
    }
}
