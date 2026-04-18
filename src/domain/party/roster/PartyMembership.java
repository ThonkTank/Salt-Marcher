package src.domain.party.roster;

import src.domain.party.api.MembershipState;

import java.util.Locale;

public enum PartyMembership {
    ACTIVE,
    RESERVE;

    public static PartyMembership fromApi(MembershipState membershipState) {
        if (membershipState == null) {
            return RESERVE;
        }
        return membershipState == MembershipState.ACTIVE ? ACTIVE : RESERVE;
    }

    public MembershipState toApi() {
        return this == ACTIVE ? MembershipState.ACTIVE : MembershipState.RESERVE;
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
