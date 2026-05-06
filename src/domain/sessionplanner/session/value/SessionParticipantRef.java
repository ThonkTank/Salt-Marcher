package src.domain.sessionplanner.session.value;

public record SessionParticipantRef(long characterId) {

    public SessionParticipantRef {
        characterId = Math.max(0L, characterId);
    }
}
