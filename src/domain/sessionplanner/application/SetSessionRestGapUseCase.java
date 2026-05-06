package src.domain.sessionplanner.application;

import src.domain.sessionplanner.session.value.SessionRestKind;

public final class SetSessionRestGapUseCase {

    private final CurrentSessionPlanRuntimeAccess runtime;

    public SetSessionRestGapUseCase(CurrentSessionPlanRuntimeAccess runtime) {
        this.runtime = runtime;
    }

    public void execute(long leftEncounterId, long rightEncounterId, SessionRestKind restKind) {
        runtime.replaceCurrent(runtime.loadOrCreateCurrent().setRestPlacement(leftEncounterId, rightEncounterId, restKind));
    }
}
