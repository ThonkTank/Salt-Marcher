package features.encounter.api;

public record GeneratedEncounterBlock(
        String blockId,
        GeneratedEncounterRole requestedRole,
        String challengeRating,
        long xp,
        int quantity
) {
    public GeneratedEncounterBlock {
        blockId = required(blockId, "blockId");
        if (requestedRole == null) {
            throw new IllegalArgumentException("requestedRole is required");
        }
        challengeRating = required(challengeRating, "challengeRating");
        if (xp <= 0L || quantity <= 0) {
            throw new IllegalArgumentException("xp and quantity must be positive");
        }
    }

    private static String required(String value, String name) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(name + " must not be blank");
        }
        return normalized;
    }
}
