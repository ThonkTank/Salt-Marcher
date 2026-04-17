package src.domain.party.valueobject;

import src.domain.party.partyAPI;

public enum PartyRestType {
    SHORT_REST,
    LONG_REST;

    public static PartyRestType fromApi(partyAPI.RestType restType) {
        if (restType == null) {
            return SHORT_REST;
        }
        return restType == partyAPI.RestType.LONG_REST ? LONG_REST : SHORT_REST;
    }
}
