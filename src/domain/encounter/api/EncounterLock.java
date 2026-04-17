package src.domain.encounter.api;

public record EncounterLock(
        long creatureId,
        int quantity
) {

    public EncounterLock {
        quantity = Math.max(1, quantity);
    }
}
