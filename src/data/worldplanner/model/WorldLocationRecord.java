package src.data.worldplanner.model;

import java.util.List;

public record WorldLocationRecord(
        long locationId,
        String displayName,
        String notes,
        List<Long> factionIds,
        List<Long> encounterTableIds
) {

    public WorldLocationRecord {
        factionIds = factionIds == null ? List.of() : List.copyOf(factionIds);
        encounterTableIds = encounterTableIds == null ? List.of() : List.copyOf(encounterTableIds);
    }
}
