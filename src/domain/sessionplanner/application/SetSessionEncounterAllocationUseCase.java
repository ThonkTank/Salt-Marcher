package src.domain.sessionplanner.application;

import java.math.BigDecimal;

public final class SetSessionEncounterAllocationUseCase {

    private final CurrentSessionPlanRuntimeAccess runtime;

    public SetSessionEncounterAllocationUseCase(CurrentSessionPlanRuntimeAccess runtime) {
        this.runtime = runtime;
    }

    public void execute(long encounterId, BigDecimal budgetPercentage) {
        runtime.replaceCurrent(runtime.loadOrCreateCurrent().setEncounterAllocation(encounterId, budgetPercentage));
    }
}
