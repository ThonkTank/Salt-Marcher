package src.domain.party.api;

public record RestCadenceStatus(
        Long characterId,
        RestMilestone nextMilestone,
        int xpDelta,
        RestCadenceUrgency urgency
) {
}
