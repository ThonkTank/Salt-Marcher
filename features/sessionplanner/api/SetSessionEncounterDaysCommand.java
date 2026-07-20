package features.sessionplanner.api;

import java.math.BigDecimal;

public record SetSessionEncounterDaysCommand(
        SessionPlannerAuthoredTarget target,
        BigDecimal encounterDays
) {

    public SetSessionEncounterDaysCommand {
        if (target == null) {
            throw new IllegalArgumentException("authored target is required");
        }
        if (encounterDays == null) {
            throw new IllegalArgumentException("encounter days are required");
        }
    }
}
