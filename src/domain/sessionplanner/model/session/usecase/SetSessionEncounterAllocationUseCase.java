package src.domain.sessionplanner.model.session.usecase;

import java.math.BigDecimal;

public final class SetSessionEncounterAllocationUseCase {

    private final LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase;
    private final SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase;

    public SetSessionEncounterAllocationUseCase(
            LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase,
            SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase
    ) {
        this.loadCurrentSessionPlanUseCase = loadCurrentSessionPlanUseCase;
        this.saveCurrentSessionPlanUseCase = saveCurrentSessionPlanUseCase;
    }

    public void execute(long encounterId, BigDecimal budgetPercentage) {
        saveCurrentSessionPlanUseCase.execute(
                loadCurrentSessionPlanUseCase.execute().setEncounterAllocation(encounterId, budgetPercentage));
    }
}
