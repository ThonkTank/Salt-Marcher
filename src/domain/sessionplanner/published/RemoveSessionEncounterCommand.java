package src.domain.sessionplanner.published;

public record RemoveSessionEncounterCommand(long encounterId) {

    public RemoveSessionEncounterCommand {
        encounterId = Math.max(0L, encounterId);
    }
}
