package src.domain.sessionplanner.published;

public final class RemoveSessionParticipantCommand {

    private final long characterId;

    public RemoveSessionParticipantCommand(long characterId) {
        this.characterId = Math.max(0L, characterId);
    }

    public long characterId() {
        return characterId;
    }
}
