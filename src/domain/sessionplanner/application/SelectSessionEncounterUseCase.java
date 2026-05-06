package src.domain.sessionplanner.application;

public final class SelectSessionEncounterUseCase {

    private final CurrentSessionPlanRuntimeAccess runtime;

    public SelectSessionEncounterUseCase(CurrentSessionPlanRuntimeAccess runtime) {
        this.runtime = runtime;
    }

    public void execute(long encounterId) {
        runtime.replaceCurrent(runtime.loadOrCreateCurrent().selectEncounter(encounterId));
    }
}
