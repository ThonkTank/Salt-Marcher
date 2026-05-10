package src.domain.party.model.roster.model;

public record PartyCharacterIdentity(
        String name,
        String playerName
) {
    public PartyCharacterIdentity {
        name = normalizeName(name);
        playerName = normalizeOptional(playerName);
    }

    private static String normalizeName(String value) {
        String normalized = normalizeOptional(value);
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("Character name must not be blank.");
        }
        return normalized;
    }

    private static String normalizeOptional(String value) {
        return value == null ? "" : value.trim();
    }
}
