package src.domain.party.roster.value;

import src.domain.party.published.RestType;

public enum PartyRestType {
    SHORT_REST,
    LONG_REST;

    public static PartyRestType fromApi(RestType restType) {
        if (restType == null) {
            return SHORT_REST;
        }
        return restType == RestType.LONG_REST ? LONG_REST : SHORT_REST;
    }

    public boolean isShortRest() {
        return this == SHORT_REST;
    }
}
