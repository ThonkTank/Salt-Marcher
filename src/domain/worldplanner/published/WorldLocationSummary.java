package src.domain.worldplanner.published;

import java.util.List;

public record WorldLocationSummary(
        long locationId,
        String displayName,
        String notes,
        List<Long> factionIds,
        List<Long> encounterTableIds
) {

    public WorldLocationSummary {
        factionIds = factionIds == null ? List.of() : List.copyOf(factionIds);
        encounterTableIds = encounterTableIds == null ? List.of() : List.copyOf(encounterTableIds);
    }
}
