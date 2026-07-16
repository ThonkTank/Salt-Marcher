package features.party.api;

public enum PartyTravelHeading {
    NORTH,
    EAST,
    SOUTH,
    WEST;

    public static PartyTravelHeading defaultHeading() {
        return SOUTH;
    }
}
