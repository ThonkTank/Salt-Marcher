package features.encounter.api;

public record GeneratedEncounterPlanSlotSpec(long xp, GeneratedEncounterPlanRole requestedRole) {

    public GeneratedEncounterPlanSlotSpec {
        if (xp <= 0) {
            throw new IllegalArgumentException("xp must be positive");
        }
        requestedRole = requestedRole == null ? GeneratedEncounterPlanRole.STANDARD : requestedRole;
    }
}
