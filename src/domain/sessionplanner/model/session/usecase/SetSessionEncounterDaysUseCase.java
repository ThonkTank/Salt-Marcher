package src.domain.sessionplanner.model.session.usecase;

import java.math.BigDecimal;
import src.domain.sessionplanner.model.session.EncounterDays;

public final class SetSessionEncounterDaysUseCase {

    private final LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase;
    private final SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase;

    public SetSessionEncounterDaysUseCase(
            LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase,
            SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase
    ) {
        this.loadCurrentSessionPlanUseCase = loadCurrentSessionPlanUseCase;
        this.saveCurrentSessionPlanUseCase = saveCurrentSessionPlanUseCase;
    }

    public void execute(BigDecimal encounterDays) {
        saveCurrentSessionPlanUseCase.execute(
                loadCurrentSessionPlanUseCase.execute().setEncounterDays(new EncounterDays(encounterDays)));
    }
}
