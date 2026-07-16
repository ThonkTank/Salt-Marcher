package src.data.worldplanner.model;

import java.util.List;

public record WorldFactionRecord(
        long factionId,
        String displayName,
        String notes,
        long primaryEncounterTableId,
        int disposition,
        List<Long> npcIds,
        List<WorldFactionInventoryLimitRecord> inventoryLimits
) {

    public WorldFactionRecord(
            long factionId,
            String displayName,
            String notes,
            long primaryEncounterTableId,
            List<Long> npcIds,
            List<WorldFactionInventoryLimitRecord> inventoryLimits
    ) {
        this(factionId, displayName, notes, primaryEncounterTableId, 0, npcIds, inventoryLimits);
    }

    public WorldFactionRecord {
        npcIds = npcIds == null ? List.of() : List.copyOf(npcIds);
        inventoryLimits = inventoryLimits == null ? List.of() : List.copyOf(inventoryLimits);
    }
}
