package src.domain.sessionplanner.model.session.usecase;

public final class ClearSessionRestGapUseCase {

    private final LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase;
    private final SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase;

    public ClearSessionRestGapUseCase(
            LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase,
            SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase
    ) {
        this.loadCurrentSessionPlanUseCase = loadCurrentSessionPlanUseCase;
        this.saveCurrentSessionPlanUseCase = saveCurrentSessionPlanUseCase;
    }

    public void execute(long leftEncounterId, long rightEncounterId) {
        saveCurrentSessionPlanUseCase.execute(
                loadCurrentSessionPlanUseCase.execute().clearRestPlacement(leftEncounterId, rightEncounterId));
    }
}
