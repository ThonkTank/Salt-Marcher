package src.domain.party.published;

public enum PartyDungeonTravelLocationKind {
    TILE,
    TRANSITION;

    public static PartyDungeonTravelLocationKind parse(String value) {
        if (value == null || value.isBlank()) {
            return TILE;
        }
        try {
            return PartyDungeonTravelLocationKind.valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return TILE;
        }
    }
}
