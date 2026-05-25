package src.domain.encountertable.published;

import java.util.List;

public record RefreshEncounterTableCandidatesCommand(
        List<Long> tableIds,
        int maximumXp
) {

    public RefreshEncounterTableCandidatesCommand {
        tableIds = tableIds == null ? List.of() : List.copyOf(tableIds);
    }
}
