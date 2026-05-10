package src.domain.sessionplanner.model.session.usecase;

public final class AttachSessionEncounterUseCase {

    private final LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase;
    private final SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase;

    public AttachSessionEncounterUseCase(
            LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase,
            SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase
    ) {
        this.loadCurrentSessionPlanUseCase = loadCurrentSessionPlanUseCase;
        this.saveCurrentSessionPlanUseCase = saveCurrentSessionPlanUseCase;
    }

    public void execute(long encounterPlanId) {
        saveCurrentSessionPlanUseCase.execute(loadCurrentSessionPlanUseCase.execute().attachEncounter(encounterPlanId));
    }
}
