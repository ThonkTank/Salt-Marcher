package src.domain.party.published;

public enum PartyTravelHeading {
    NORTH,
    EAST,
    SOUTH,
    WEST;

    public static PartyTravelHeading defaultHeading() {
        return SOUTH;
    }
}
