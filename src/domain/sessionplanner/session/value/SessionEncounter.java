package src.domain.sessionplanner.session.value;

public record SessionEncounter(
        SessionEncounterId encounterId,
        long encounterPlanId,
        SessionEncounterAllocation allocation
) {

    public SessionEncounter {
        encounterId = encounterId == null ? new SessionEncounterId(1L) : encounterId;
        encounterPlanId = Math.max(0L, encounterPlanId);
        allocation = allocation == null ? SessionEncounterAllocation.zero() : allocation;
    }

    public SessionEncounter withAllocation(SessionEncounterAllocation allocation) {
        return new SessionEncounter(encounterId, encounterPlanId, allocation);
    }
}
