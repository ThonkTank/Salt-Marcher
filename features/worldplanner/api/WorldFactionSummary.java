package features.worldplanner.api;

import java.util.List;

public record WorldFactionSummary(
        long factionId,
        String displayName,
        String notes,
        long primaryEncounterTableId,
        List<Long> npcIds,
        List<WorldFactionInventoryLimitSummary> inventoryLimits
) {

    public WorldFactionSummary {
        npcIds = npcIds == null ? List.of() : List.copyOf(npcIds);
        inventoryLimits = inventoryLimits == null ? List.of() : List.copyOf(inventoryLimits);
    }
}
