package src.domain.sessionplanner.model.session.usecase;

public final class AddSessionParticipantUseCase {

    private final LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase;
    private final SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase;

    public AddSessionParticipantUseCase(
            LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase,
            SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase
    ) {
        this.loadCurrentSessionPlanUseCase = loadCurrentSessionPlanUseCase;
        this.saveCurrentSessionPlanUseCase = saveCurrentSessionPlanUseCase;
    }

    public void execute(long characterId) {
        saveCurrentSessionPlanUseCase.execute(loadCurrentSessionPlanUseCase.execute().addParticipant(characterId));
    }
}
