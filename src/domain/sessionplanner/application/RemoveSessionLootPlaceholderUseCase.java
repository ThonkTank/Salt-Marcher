package src.domain.sessionplanner.application;

public final class RemoveSessionLootPlaceholderUseCase {

    private final CurrentSessionPlanRuntimeAccess runtime;

    public RemoveSessionLootPlaceholderUseCase(CurrentSessionPlanRuntimeAccess runtime) {
        this.runtime = runtime;
    }

    public void execute(long lootId) {
        runtime.replaceCurrent(runtime.loadOrCreateCurrent().removeLootPlaceholder(lootId));
    }
}
