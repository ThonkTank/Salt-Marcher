package src.domain.sessionplanner.application;

public final class CreateSessionPlanUseCase {

    private final CurrentSessionPlanRuntimeAccess runtime;

    public CreateSessionPlanUseCase(CurrentSessionPlanRuntimeAccess runtime) {
        this.runtime = runtime;
    }

    public void execute() {
        runtime.replaceCurrent(runtime.createNewSession());
    }
}
