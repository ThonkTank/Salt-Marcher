package features.sessionplanner.api;

public record ClearSessionRestGapCommand(
        SessionPlannerAuthoredTarget target,
        long leftEncounterId,
        long rightEncounterId
) {

    public ClearSessionRestGapCommand {
        if (target == null) {
            throw new IllegalArgumentException("authored target is required");
        }
        if (leftEncounterId <= 0L || rightEncounterId <= 0L) {
            throw new IllegalArgumentException("scene ids must be positive");
        }
    }
}
