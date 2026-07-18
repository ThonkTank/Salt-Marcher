package features.encounter.adapter.sqlite.model;

public record EncounterPlanCreatureRecord(
        long creatureId,
        int quantity,
        int sortOrder,
        String lastKnownDisplayName
) {
    public EncounterPlanCreatureRecord(long creatureId, int quantity, int sortOrder) {
        this(creatureId, quantity, sortOrder, "");
    }

    public EncounterPlanCreatureRecord {
        lastKnownDisplayName = lastKnownDisplayName == null ? "" : lastKnownDisplayName.trim();
    }
}
