package src.domain.encounter.published;

public record SavedEncounterPlanCreature(long creatureId, int quantity) {

    public SavedEncounterPlanCreature {
        quantity = Math.max(1, quantity);
    }
}
