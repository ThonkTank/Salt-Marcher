package src.domain.encounter.generation.value;

public record EncounterLockedCreature(long creatureId, int quantity) {

    public EncounterLockedCreature {
        quantity = Math.max(1, quantity);
    }
}
