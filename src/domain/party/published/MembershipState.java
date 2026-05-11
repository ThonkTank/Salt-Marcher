package src.domain.party.published;

public enum MembershipState {
    ACTIVE,
    RESERVE;

    public boolean isActive() {
        return this == ACTIVE;
    }

    public static MembershipState fromPersistence(String rawMembership) {
        if (rawMembership == null || rawMembership.isBlank()) {
            return RESERVE;
        }
        try {
            return MembershipState.valueOf(rawMembership.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return RESERVE;
        }
    }
}
