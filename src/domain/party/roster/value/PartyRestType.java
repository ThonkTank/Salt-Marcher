package src.domain.party.roster.value;

public enum PartyRestType {
    SHORT_REST,
    LONG_REST;

    public boolean isShortRest() {
        return this == SHORT_REST;
    }
}
