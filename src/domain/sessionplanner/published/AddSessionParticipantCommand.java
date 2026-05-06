package src.domain.sessionplanner.published;

public final class AddSessionParticipantCommand {

    private final long characterId;

    public AddSessionParticipantCommand(long characterId) {
        this.characterId = Math.max(0L, characterId);
    }

    public long characterId() {
        return characterId;
    }
}
