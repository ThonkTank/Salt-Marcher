package features.party.api;

import java.util.Objects;

public record ActivePartyFactsResult(
        ReadStatus status,
        ActivePartyFacts facts
) {
    public ActivePartyFactsResult {
        status = Objects.requireNonNull(status, "status");
        facts = Objects.requireNonNull(facts, "facts");
    }
}
