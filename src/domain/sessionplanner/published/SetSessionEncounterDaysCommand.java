package src.domain.sessionplanner.published;

import java.math.BigDecimal;

public record SetSessionEncounterDaysCommand(BigDecimal encounterDays) implements SessionPlannerCommand {

    public SetSessionEncounterDaysCommand {
        encounterDays = encounterDays == null ? BigDecimal.ONE : encounterDays;
    }
}
