package src.domain.sessionplanner.model.session.usecase;

public final class RemoveSessionLootPlaceholderUseCase {

    private final LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase;
    private final SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase;

    public RemoveSessionLootPlaceholderUseCase(
            LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase,
            SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase
    ) {
        this.loadCurrentSessionPlanUseCase = loadCurrentSessionPlanUseCase;
        this.saveCurrentSessionPlanUseCase = saveCurrentSessionPlanUseCase;
    }

    public void execute(long lootId) {
        saveCurrentSessionPlanUseCase.execute(loadCurrentSessionPlanUseCase.execute().removeLootPlaceholder(lootId));
    }
}
