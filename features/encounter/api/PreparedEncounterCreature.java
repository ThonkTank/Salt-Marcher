package features.encounter.api;

public record PreparedEncounterCreature(long creatureId, int quantity, String displayName) {
    public PreparedEncounterCreature {
        if (creatureId <= 0L || quantity <= 0) {
            throw new IllegalArgumentException("creature identity and quantity must be positive");
        }
        displayName = displayName == null ? "" : displayName.trim();
        if (displayName.isEmpty()) {
            throw new IllegalArgumentException("displayName must not be blank");
        }
    }
}
