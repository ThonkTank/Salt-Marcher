package src.domain.sessionplanner.published;

public record MoveSessionEncounterDownCommand(long encounterId) {

    public MoveSessionEncounterDownCommand {
        encounterId = Math.max(0L, encounterId);
    }
}
