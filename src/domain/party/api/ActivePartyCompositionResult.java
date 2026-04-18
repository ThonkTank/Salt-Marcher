package src.domain.party.api;

public record ActivePartyCompositionResult(
        ReadStatus status,
        ActivePartyComposition composition
) {
}
