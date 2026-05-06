package src.domain.sessionplanner.published;

public record MoveSessionEncounterUpCommand(long encounterId) {

    public MoveSessionEncounterUpCommand {
        encounterId = Math.max(0L, encounterId);
    }
}
