package src.domain.encountertable.published;

import java.util.List;

public record LoadEncounterTableCandidatesQuery(
        List<Long> tableIds,
        int maximumXp
) {
    public LoadEncounterTableCandidatesQuery {
        tableIds = tableIds == null ? List.of() : List.copyOf(tableIds);
    }
}
