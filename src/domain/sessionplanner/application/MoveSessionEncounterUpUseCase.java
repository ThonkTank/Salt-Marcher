package src.domain.sessionplanner.application;

public final class MoveSessionEncounterUpUseCase {

    private final CurrentSessionPlanRuntimeAccess runtime;

    public MoveSessionEncounterUpUseCase(CurrentSessionPlanRuntimeAccess runtime) {
        this.runtime = runtime;
    }

    public void execute(long encounterId) {
        runtime.loadOrCreateCurrent().moveEncounterUp(encounterId);
    }
}
