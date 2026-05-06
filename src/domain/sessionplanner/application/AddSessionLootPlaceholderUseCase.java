package src.domain.sessionplanner.application;

public final class AddSessionLootPlaceholderUseCase {

    private final CurrentSessionPlanRuntimeAccess runtime;

    public AddSessionLootPlaceholderUseCase(CurrentSessionPlanRuntimeAccess runtime) {
        this.runtime = runtime;
    }

    public void execute() {
        runtime.loadOrCreateCurrent().addLootPlaceholder();
    }
}
