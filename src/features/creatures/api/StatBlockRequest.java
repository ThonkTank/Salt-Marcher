package features.creatures.api;

/**
 * Stat block display request with optional mob context for helper calculations.
 */
public record StatBlockRequest(
        Long creatureId,
        Integer mobCount
) {
    public StatBlockRequest {
        if (creatureId == null) {
            throw new IllegalArgumentException("creatureId must not be null");
        }
        if (mobCount != null && mobCount < 1) {
            throw new IllegalArgumentException("mobCount must be >= 1 when present");
        }
    }

    public static StatBlockRequest forCreature(Long creatureId) {
        return new StatBlockRequest(creatureId, null);
    }

    public static StatBlockRequest forMob(Long creatureId, int mobCount) {
        return new StatBlockRequest(creatureId, mobCount);
    }
}
