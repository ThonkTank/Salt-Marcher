package src.domain.party.published;

public record PerformPartyRestCommand(RestType restType) {

    public String restTypeName() {
        return restType == null ? "SHORT_REST" : restType.name();
    }
}
