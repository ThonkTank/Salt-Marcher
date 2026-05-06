package src.domain.sessionplanner.application;

public final class ClearSessionRestGapUseCase {

    private final CurrentSessionPlanRuntimeAccess runtime;

    public ClearSessionRestGapUseCase(CurrentSessionPlanRuntimeAccess runtime) {
        this.runtime = runtime;
    }

    public void execute(long leftEncounterId, long rightEncounterId) {
        runtime.loadOrCreateCurrent().clearRestPlacement(leftEncounterId, rightEncounterId);
    }
}
