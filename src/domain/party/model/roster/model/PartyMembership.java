package src.domain.party.model.roster.model;

import java.util.Locale;

public enum PartyMembership {
    ACTIVE,
    RESERVE;

    public boolean isActive() {
        return this == ACTIVE;
    }

    public static PartyMembership fromPersistence(String rawMembership) {
        if (rawMembership == null || rawMembership.isBlank()) {
            return RESERVE;
        }
        try {
            return PartyMembership.valueOf(rawMembership.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return RESERVE;
        }
    }
}
