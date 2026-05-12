package src.domain.sessionplanner;

import java.util.Objects;
import src.domain.sessionplanner.model.session.usecase.AddSessionParticipantUseCase;
import src.domain.sessionplanner.model.session.usecase.RemoveSessionParticipantUseCase;
import src.domain.sessionplanner.published.SessionPlannerParticipantCommand;

public final class SessionPlannerParticipantApplicationService {

    private static final String COMMAND_PARAMETER = "command";

    private final AddSessionParticipantUseCase addParticipantUseCase;
    private final RemoveSessionParticipantUseCase removeParticipantUseCase;

    public SessionPlannerParticipantApplicationService(
            AddSessionParticipantUseCase addParticipantUseCase,
            RemoveSessionParticipantUseCase removeParticipantUseCase
    ) {
        this.addParticipantUseCase = Objects.requireNonNull(addParticipantUseCase, "addParticipantUseCase");
        this.removeParticipantUseCase = Objects.requireNonNull(removeParticipantUseCase, "removeParticipantUseCase");
    }

    public void addParticipant(SessionPlannerParticipantCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        addParticipantUseCase.execute(command.characterId());
    }

    public void removeParticipant(SessionPlannerParticipantCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        removeParticipantUseCase.execute(command.characterId());
    }
}
