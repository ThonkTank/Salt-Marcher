package src.domain.sessionplanner.published;

import java.math.BigDecimal;

public final class SetSessionEncounterDaysCommand {

    private final BigDecimal encounterDays;

    public SetSessionEncounterDaysCommand(BigDecimal encounterDays) {
        this.encounterDays = encounterDays == null ? BigDecimal.ONE : encounterDays;
    }

    public BigDecimal encounterDays() {
        return encounterDays;
    }
}
