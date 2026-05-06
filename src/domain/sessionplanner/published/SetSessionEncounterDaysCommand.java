package src.domain.sessionplanner.published;

import java.math.BigDecimal;

public record SetSessionEncounterDaysCommand(BigDecimal encounterDays) {

    public SetSessionEncounterDaysCommand {
        encounterDays = encounterDays == null ? BigDecimal.ONE : encounterDays;
    }
}
