package features.party.api;

public record ActivePartyCompositionResult(
        ReadStatus status,
        ActivePartyComposition composition
) {
}
