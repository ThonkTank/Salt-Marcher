package src.domain.sessionplanner.application;

public final class AddSessionParticipantUseCase {

    private final CurrentSessionPlanRuntimeAccess runtime;

    public AddSessionParticipantUseCase(CurrentSessionPlanRuntimeAccess runtime) {
        this.runtime = runtime;
    }

    public void execute(long characterId) {
        runtime.loadOrCreateCurrent().addParticipant(characterId);
    }
}
