package src.domain.sessionplanner.application;

import java.math.BigDecimal;
import src.domain.sessionplanner.session.value.EncounterDays;

public final class SetSessionEncounterDaysUseCase {

    private final CurrentSessionPlanRuntimeAccess runtime;

    public SetSessionEncounterDaysUseCase(CurrentSessionPlanRuntimeAccess runtime) {
        this.runtime = runtime;
    }

    public void execute(BigDecimal encounterDays) {
        runtime.replaceCurrent(runtime.loadOrCreateCurrent().setEncounterDays(new EncounterDays(encounterDays)));
    }
}
