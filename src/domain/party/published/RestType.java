package src.domain.party.published;

import src.domain.party.roster.value.PartyRestType;

public final class RestType {

    public static final RestType SHORT_REST = new RestType(PartyRestType.SHORT_REST);
    public static final RestType LONG_REST = new RestType(PartyRestType.LONG_REST);

    private final PartyRestType restType;

    private RestType(PartyRestType restType) {
        this.restType = restType;
    }

    public static RestType fromInternal(PartyRestType restType) {
        return restType == PartyRestType.LONG_REST ? LONG_REST : SHORT_REST;
    }

    public PartyRestType toInternal() {
        return restType;
    }

    public String name() {
        return restType.name();
    }

    public static RestType valueOf(String value) {
        return "LONG_REST".equals(value) ? LONG_REST : SHORT_REST;
    }

    @Override
    public String toString() {
        return restType.name();
    }
}
