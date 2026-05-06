package src.domain.sessionplanner.published;

public record RemoveSessionParticipantCommand(long characterId) {

    public RemoveSessionParticipantCommand {
        characterId = Math.max(0L, characterId);
    }
}
