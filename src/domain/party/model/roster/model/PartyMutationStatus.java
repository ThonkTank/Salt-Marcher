package src.domain.party.model.roster.model;

import java.util.Objects;

public final class PartyMutationStatus {

    public static final PartyMutationStatus SUCCESS = new PartyMutationStatus("SUCCESS");
    public static final PartyMutationStatus NOT_FOUND = new PartyMutationStatus("NOT_FOUND");
    public static final PartyMutationStatus INVALID_INPUT = new PartyMutationStatus("INVALID_INPUT");
    public static final PartyMutationStatus STORAGE_ERROR = new PartyMutationStatus("STORAGE_ERROR");

    private final String name;

    private PartyMutationStatus(String name) {
        this.name = name;
    }

    public String name() {
        return name;
    }

    @Override
    public boolean equals(Object other) {
        return this == other || other instanceof PartyMutationStatus status && name.equals(status.name);
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
