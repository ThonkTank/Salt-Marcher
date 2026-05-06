package src.domain.sessionplanner.published;

public record AddSessionParticipantCommand(long characterId) {

    public AddSessionParticipantCommand {
        characterId = Math.max(0L, characterId);
    }
}
