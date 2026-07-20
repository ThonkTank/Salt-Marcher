package features.encounter.domain.plan;

public record EncounterPlanCreature(long creatureId, int quantity, String lastKnownDisplayName) {

    public EncounterPlanCreature(long creatureId, int quantity) {
        this(creatureId, quantity, "");
    }

    public EncounterPlanCreature {
        if (creatureId <= 0) {
            throw new IllegalArgumentException("creatureId must be positive");
        }
        if (quantity <= 0) {
            throw new IllegalArgumentException("quantity must be positive");
        }
        lastKnownDisplayName = lastKnownDisplayName == null ? "" : lastKnownDisplayName.trim();
    }
}
