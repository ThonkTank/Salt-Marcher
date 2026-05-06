package src.domain.sessionplanner.application;

public final class RemoveSessionParticipantUseCase {

    private final CurrentSessionPlanRuntimeAccess runtime;

    public RemoveSessionParticipantUseCase(CurrentSessionPlanRuntimeAccess runtime) {
        this.runtime = runtime;
    }

    public void execute(long characterId) {
        runtime.loadOrCreateCurrent().removeParticipant(characterId);
    }
}
