package src.domain.sessionplanner.published;

public record SessionPlannerParticipantRef(long characterId) {

    public SessionPlannerParticipantRef {
        characterId = Math.max(0L, characterId);
    }
}
