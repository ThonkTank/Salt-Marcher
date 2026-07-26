package features.party.domain.roster;

import org.jspecify.annotations.Nullable;

public record PartyCharacterIdentity(
        String name,
        @Nullable String playerName
) {
    public PartyCharacterIdentity {
        name = normalizeName(name);
        playerName = normalizeOptional(playerName);
    }

    private static String normalizeName(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("Character name must not be blank.");
        }
        return normalized;
    }

    private static @Nullable String normalizeOptional(@Nullable String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
