package features.party.domain.roster;

import java.util.Locale;
import java.util.Objects;

public final class PartyTravelHeading {

    public static final PartyTravelHeading NORTH = new PartyTravelHeading("NORTH");
    public static final PartyTravelHeading EAST = new PartyTravelHeading("EAST");
    public static final PartyTravelHeading SOUTH = new PartyTravelHeading("SOUTH");
    public static final PartyTravelHeading WEST = new PartyTravelHeading("WEST");

    private final String name;

    private PartyTravelHeading(String name) {
        this.name = name;
    }

    public static PartyTravelHeading defaultHeading() {
        return SOUTH;
    }

    public String name() {
        return name;
    }

    public static PartyTravelHeading parse(String value) {
        if (value == null || value.isBlank()) {
            return defaultHeading();
        }
        return valueOf(value.trim().toUpperCase(Locale.ROOT));
    }

    public static PartyTravelHeading valueOf(String name) {
        if (NORTH.name.equals(name)) {
            return NORTH;
        }
        if (EAST.name.equals(name)) {
            return EAST;
        }
        if (WEST.name.equals(name)) {
            return WEST;
        }
        return SOUTH;
    }

    @Override
    public boolean equals(Object other) {
        return this == other || (other instanceof PartyTravelHeading heading && name.equals(heading.name));
    }

    @Override
    public int hashCode() {
        return Objects.hash(name);
    }

    @Override
    public String toString() {
        return name;
    }
}
