package src.domain.party.model.roster.model;

import java.util.Locale;

public enum PartyTravelHeading {
    NORTH,
    EAST,
    SOUTH,
    WEST;

    public static PartyTravelHeading defaultHeading() {
        return SOUTH;
    }

    public static PartyTravelHeading parse(String value) {
        if (value == null || value.isBlank()) {
            return defaultHeading();
        }
        try {
            return PartyTravelHeading.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return defaultHeading();
        }
    }
}
