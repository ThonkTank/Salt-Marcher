package src.domain.party.model.roster.model;

import java.util.Locale;

public enum PartyDungeonTravelLocationKind {
    TILE,
    TRANSITION;

    public static PartyDungeonTravelLocationKind parse(String value) {
        if (value == null || value.isBlank()) {
            return TILE;
        }
        try {
            return PartyDungeonTravelLocationKind.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return TILE;
        }
    }
}
