package src.domain.encounter.model.reference.model;

import java.util.List;

public record EncounterTableCandidateCriteria(
        List<Long> tableIds,
        int maximumXp
) {

    public EncounterTableCandidateCriteria {
        tableIds = tableIds == null ? List.of() : List.copyOf(tableIds);
    }
}
