package src.domain.sessionplanner.application;

public final class AttachSessionEncounterUseCase {

    private final CurrentSessionPlanRuntimeAccess runtime;

    public AttachSessionEncounterUseCase(CurrentSessionPlanRuntimeAccess runtime) {
        this.runtime = runtime;
    }

    public void execute(long encounterPlanId) {
        runtime.replaceCurrent(runtime.loadOrCreateCurrent().attachEncounter(encounterPlanId));
    }
}
