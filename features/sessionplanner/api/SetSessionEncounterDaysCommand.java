package features.sessionplanner.api;

import java.math.BigDecimal;

public record SetSessionEncounterDaysCommand(BigDecimal encounterDays) {

    public SetSessionEncounterDaysCommand {
        encounterDays = encounterDays == null ? BigDecimal.ONE : encounterDays;
    }
}
