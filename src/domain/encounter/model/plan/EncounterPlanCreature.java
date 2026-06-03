package src.domain.encounter.model.plan;

public record EncounterPlanCreature(long creatureId, int quantity) {

    public EncounterPlanCreature {
        if (creatureId <= 0) {
            throw new IllegalArgumentException("creatureId must be positive");
        }
        quantity = Math.max(1, quantity);
    }
}
