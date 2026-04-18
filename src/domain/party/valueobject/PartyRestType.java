package src.domain.party.valueobject;

import src.domain.party.api.RestType;

public enum PartyRestType {
    SHORT_REST,
    LONG_REST;

    public static PartyRestType fromApi(RestType restType) {
        if (restType == null) {
            return SHORT_REST;
        }
        return restType == RestType.LONG_REST ? LONG_REST : SHORT_REST;
    }
}
