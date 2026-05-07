package src.domain.sessionplanner.published;

public record SessionPlannerEncounterPlanRef(long encounterPlanId) {

    public SessionPlannerEncounterPlanRef {
        encounterPlanId = Math.max(0L, encounterPlanId);
    }
}
