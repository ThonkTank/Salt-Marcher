package src.domain.party.model.roster.model;

import java.util.Locale;
import java.util.Objects;

public final class PartyMembership {

    public static final PartyMembership ACTIVE = new PartyMembership("ACTIVE", true);
    public static final PartyMembership RESERVE = new PartyMembership("RESERVE", false);

    private final String name;
    private final boolean active;

    private PartyMembership(String name, boolean active) {
        this.name = name;
        this.active = active;
    }

    public boolean isActive() {
        return active;
    }

    public String name() {
        return name;
    }

    public static PartyMembership fromPersistence(String rawMembership) {
        if (rawMembership == null || rawMembership.isBlank()) {
            return RESERVE;
        }
        return valueOf(rawMembership.trim().toUpperCase(Locale.ROOT));
    }

    public static PartyMembership valueOf(String name) {
        if (ACTIVE.name.equals(name)) {
            return ACTIVE;
        }
        return RESERVE;
    }

    @Override
    public boolean equals(Object other) {
        return this == other || other instanceof PartyMembership membership && name.equals(membership.name);
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
