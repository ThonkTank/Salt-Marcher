package src.domain.sessionplanner.model.session;

public record SessionEncounter(
        long encounterId,
        long encounterPlanId,
        SessionEncounterAllocation allocation
) {

    public SessionEncounter {
        encounterId = Math.max(1L, encounterId);
        encounterPlanId = Math.max(0L, encounterPlanId);
        allocation = allocation == null ? SessionEncounterAllocation.zero() : allocation;
    }

    public SessionEncounter withAllocation(SessionEncounterAllocation allocation) {
        return new SessionEncounter(encounterId, encounterPlanId, allocation);
    }
}
