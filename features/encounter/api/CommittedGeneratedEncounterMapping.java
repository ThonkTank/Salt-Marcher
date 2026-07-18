package features.encounter.api;

public record CommittedGeneratedEncounterMapping(
        int encounterNumber,
        long planId,
        GeneratedEncounterPlanSummary summary
) {
    public CommittedGeneratedEncounterMapping {
        if (encounterNumber <= 0 || planId <= 0L || summary == null || summary.planId() != planId) {
            throw new IllegalArgumentException("committed mapping is invalid");
        }
    }
}
