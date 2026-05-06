package src.domain.sessionplanner.application;

public final class RemoveSessionEncounterUseCase {

    private final CurrentSessionPlanRuntimeAccess runtime;

    public RemoveSessionEncounterUseCase(CurrentSessionPlanRuntimeAccess runtime) {
        this.runtime = runtime;
    }

    public void execute(long encounterId) {
        runtime.loadOrCreateCurrent().removeEncounter(encounterId);
    }
}
