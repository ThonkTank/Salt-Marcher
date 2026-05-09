package src.domain.sessionplanner.published;

public record SelectSessionEncounterCommand(long encounterId) {

    public SelectSessionEncounterCommand {
        encounterId = Math.max(0L, encounterId);
    }
}
