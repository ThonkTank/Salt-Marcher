package features.sessionplanner.api;

import java.math.BigDecimal;

public record SessionPlannerEncounterAllocationCommand(
        SessionPlannerAuthoredTarget target,
        long encounterId,
        BigDecimal budgetPercentage
) {

    public SessionPlannerEncounterAllocationCommand {
        if (target == null) {
            throw new IllegalArgumentException("authored target is required");
        }
        if (encounterId <= 0L) {
            throw new IllegalArgumentException("scene id must be positive");
        }
        if (budgetPercentage == null) {
            throw new IllegalArgumentException("budget percentage is required");
        }
    }
}
