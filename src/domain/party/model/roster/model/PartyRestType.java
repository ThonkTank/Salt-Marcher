package src.domain.party.model.roster.model;

public enum PartyRestType {
    SHORT_REST,
    LONG_REST;

    public boolean isShortRest() {
        return this == SHORT_REST;
    }
}
