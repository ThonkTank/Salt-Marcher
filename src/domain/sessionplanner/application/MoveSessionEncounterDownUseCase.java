package src.domain.sessionplanner.application;

public final class MoveSessionEncounterDownUseCase {

    private final CurrentSessionPlanRuntimeAccess runtime;

    public MoveSessionEncounterDownUseCase(CurrentSessionPlanRuntimeAccess runtime) {
        this.runtime = runtime;
    }

    public void execute(long encounterId) {
        runtime.loadOrCreateCurrent().moveEncounterDown(encounterId);
    }
}
