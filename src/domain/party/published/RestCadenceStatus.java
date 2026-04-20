package src.domain.party.published;

public record RestCadenceStatus(
        Long characterId,
        RestMilestone nextMilestone,
        int xpDelta,
        RestCadenceUrgency urgency
) {
}
