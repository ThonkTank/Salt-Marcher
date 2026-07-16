package features.worldplanner.domain.world;

import java.util.List;

public record WorldLocation(
        long locationId,
        String displayName,
        String notes,
        List<Long> factionIds,
        List<Long> encounterTableIds
) {
    public WorldLocation {
        if (!WorldPlannerIds.isPositive(locationId)) {
            throw new IllegalArgumentException("locationId must be positive");
        }
        displayName = WorldNpc.normalize(displayName, "Location #" + locationId);
        notes = WorldNpc.text(notes);
        factionIds = WorldPlannerIds.normalize(factionIds);
        encounterTableIds = WorldPlannerIds.normalize(encounterTableIds);
    }

    @Override
    public List<Long> factionIds() {
        return List.copyOf(factionIds);
    }

    @Override
    public List<Long> encounterTableIds() {
        return List.copyOf(encounterTableIds);
    }

    public WorldLocation addFaction(long factionId) {
        return new WorldLocation(
                locationId,
                displayName,
                notes,
                WorldPlannerIds.addUnique(factionIds, factionId),
                encounterTableIds);
    }

    public WorldLocation addEncounterTable(long encounterTableId) {
        return new WorldLocation(
                locationId,
                displayName,
                notes,
                factionIds,
                WorldPlannerIds.addUnique(encounterTableIds, encounterTableId));
    }
}
