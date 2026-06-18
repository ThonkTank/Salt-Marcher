package src.domain.sessionplanner.model.session.usecase;

public final class AddSessionLootPlaceholderUseCase {

    private final LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase;
    private final SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase;

    public AddSessionLootPlaceholderUseCase(
            LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase,
            SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase
    ) {
        this.loadCurrentSessionPlanUseCase = loadCurrentSessionPlanUseCase;
        this.saveCurrentSessionPlanUseCase = saveCurrentSessionPlanUseCase;
    }

    public void execute(long encounterId) {
        saveCurrentSessionPlanUseCase.execute(loadCurrentSessionPlanUseCase.execute().addLootPlaceholder(encounterId));
    }
}
