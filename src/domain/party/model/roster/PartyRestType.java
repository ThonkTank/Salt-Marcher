package src.domain.party.model.roster;

import java.util.Objects;

public final class PartyRestType {

    public static final PartyRestType SHORT_REST = new PartyRestType("SHORT_REST", true);
    public static final PartyRestType LONG_REST = new PartyRestType("LONG_REST", false);

    private final String name;
    private final boolean shortRest;

    private PartyRestType(String name, boolean shortRest) {
        this.name = name;
        this.shortRest = shortRest;
    }

    public boolean isShortRest() {
        return shortRest;
    }

    @Override
    public boolean equals(Object other) {
        return this == other || (other instanceof PartyRestType restType && name.equals(restType.name));
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
