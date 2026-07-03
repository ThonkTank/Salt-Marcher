package src.domain.sessionplanner.model.session.usecase;

public final class AddSessionSceneUseCase {

    private final LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase;
    private final SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase;

    public AddSessionSceneUseCase(
            LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase,
            SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase
    ) {
        this.loadCurrentSessionPlanUseCase = loadCurrentSessionPlanUseCase;
        this.saveCurrentSessionPlanUseCase = saveCurrentSessionPlanUseCase;
    }

    public void execute() {
        saveCurrentSessionPlanUseCase.execute(loadCurrentSessionPlanUseCase.execute().addScene());
    }
}
