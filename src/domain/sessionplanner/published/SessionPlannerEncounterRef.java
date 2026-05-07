package src.domain.sessionplanner.published;

public record SessionPlannerEncounterRef(long encounterId) {

    public SessionPlannerEncounterRef {
        encounterId = Math.max(0L, encounterId);
    }
}
