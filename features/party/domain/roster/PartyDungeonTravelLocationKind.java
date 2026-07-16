package features.party.domain.roster;

import java.util.Locale;
import java.util.Objects;

public final class PartyDungeonTravelLocationKind {

    public static final PartyDungeonTravelLocationKind TILE = new PartyDungeonTravelLocationKind("TILE");
    public static final PartyDungeonTravelLocationKind TRANSITION = new PartyDungeonTravelLocationKind("TRANSITION");

    private final String name;

    private PartyDungeonTravelLocationKind(String name) {
        this.name = name;
    }

    public String name() {
        return name;
    }

    public static PartyDungeonTravelLocationKind parse(String value) {
        if (value == null || value.isBlank()) {
            return TILE;
        }
        return valueOf(value.trim().toUpperCase(Locale.ROOT));
    }

    public static PartyDungeonTravelLocationKind valueOf(String name) {
        if (TRANSITION.name.equals(name)) {
            return TRANSITION;
        }
        return TILE;
    }

    @Override
    public boolean equals(Object other) {
        return this == other
                || (other instanceof PartyDungeonTravelLocationKind locationKind && name.equals(locationKind.name));
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
