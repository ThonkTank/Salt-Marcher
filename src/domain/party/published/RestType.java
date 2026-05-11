package src.domain.party.published;

public enum RestType {
    SHORT_REST,
    LONG_REST;

    public boolean isShortRest() {
        return this == SHORT_REST;
    }
}
