package src.domain.party.published;

public final class PartyTravelHeading {

    public static final PartyTravelHeading NORTH =
            new PartyTravelHeading(src.domain.party.roster.value.PartyTravelHeading.NORTH);
    public static final PartyTravelHeading EAST =
            new PartyTravelHeading(src.domain.party.roster.value.PartyTravelHeading.EAST);
    public static final PartyTravelHeading SOUTH =
            new PartyTravelHeading(src.domain.party.roster.value.PartyTravelHeading.SOUTH);
    public static final PartyTravelHeading WEST =
            new PartyTravelHeading(src.domain.party.roster.value.PartyTravelHeading.WEST);

    private final src.domain.party.roster.value.PartyTravelHeading heading;

    private PartyTravelHeading(src.domain.party.roster.value.PartyTravelHeading heading) {
        this.heading = heading;
    }

    public static PartyTravelHeading defaultHeading() {
        return SOUTH;
    }

    public static PartyTravelHeading fromInternal(src.domain.party.roster.value.PartyTravelHeading heading) {
        if (heading == null) {
            return defaultHeading();
        }
        return valueOf(heading.name());
    }

    public src.domain.party.roster.value.PartyTravelHeading toInternal() {
        return heading;
    }

    public String name() {
        return heading.name();
    }

    public static PartyTravelHeading valueOf(String value) {
        return switch (value) {
            case "NORTH" -> NORTH;
            case "EAST" -> EAST;
            case "WEST" -> WEST;
            case "SOUTH" -> SOUTH;
            default -> throw new IllegalArgumentException("Unknown PartyTravelHeading: " + value);
        };
    }

    @Override
    public String toString() {
        return heading.name();
    }
}
