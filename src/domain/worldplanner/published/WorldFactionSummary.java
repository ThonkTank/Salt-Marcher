package src.domain.worldplanner.published;

import java.util.List;

public record WorldFactionSummary(
        long factionId,
        String displayName,
        String notes,
        long primaryEncounterTableId,
        int disposition,
        List<Long> npcIds,
        List<WorldFactionInventoryLimitSummary> inventoryLimits
) {

    public WorldFactionSummary(
            long factionId,
            String displayName,
            String notes,
            long primaryEncounterTableId,
            List<Long> npcIds,
            List<WorldFactionInventoryLimitSummary> inventoryLimits
    ) {
        this(factionId, displayName, notes, primaryEncounterTableId, 0, npcIds, inventoryLimits);
    }

    public WorldFactionSummary {
        npcIds = npcIds == null ? List.of() : List.copyOf(npcIds);
        inventoryLimits = inventoryLimits == null ? List.of() : List.copyOf(inventoryLimits);
    }
}
