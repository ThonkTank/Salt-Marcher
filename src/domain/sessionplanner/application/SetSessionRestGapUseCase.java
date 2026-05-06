package src.domain.sessionplanner.application;

import src.domain.sessionplanner.session.value.SessionRestPlacement;

public final class SetSessionRestGapUseCase {

    private final CurrentSessionPlanRuntimeAccess runtime;

    public SetSessionRestGapUseCase(CurrentSessionPlanRuntimeAccess runtime) {
        this.runtime = runtime;
    }

    public void execute(SessionRestPlacement placement) {
        runtime.replaceCurrent(runtime.loadOrCreateCurrent().setRestPlacement(placement));
    }
}
