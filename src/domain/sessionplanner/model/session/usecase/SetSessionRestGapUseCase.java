package src.domain.sessionplanner.model.session.usecase;

import src.domain.sessionplanner.model.session.model.SessionRestPlacement;

public final class SetSessionRestGapUseCase {

    private final LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase;
    private final SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase;

    public SetSessionRestGapUseCase(
            LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase,
            SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase
    ) {
        this.loadCurrentSessionPlanUseCase = loadCurrentSessionPlanUseCase;
        this.saveCurrentSessionPlanUseCase = saveCurrentSessionPlanUseCase;
    }

    public void execute(SessionRestPlacement placement) {
        saveCurrentSessionPlanUseCase.execute(loadCurrentSessionPlanUseCase.execute().setRestPlacement(placement));
    }
}
