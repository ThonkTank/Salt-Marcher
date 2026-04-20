package src.domain.encounter.published;

public record EncounterLock(
        long creatureId,
        int quantity
) {

    public EncounterLock {
        quantity = Math.max(1, quantity);
    }
}
