package src.domain.sessionplanner.application;

public final class RefreshSessionPlanUseCase {

    private final CurrentSessionPlanRuntimeAccess runtime;

    public RefreshSessionPlanUseCase(CurrentSessionPlanRuntimeAccess runtime) {
        this.runtime = runtime;
    }

    public void execute() {
        runtime.loadOrCreateCurrent().clearStatus();
    }
}
