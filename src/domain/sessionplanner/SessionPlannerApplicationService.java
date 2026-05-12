package src.domain.sessionplanner;

import java.util.Objects;
import src.domain.sessionplanner.model.session.usecase.CreateSessionPlanUseCase;
import src.domain.sessionplanner.published.SessionPlannerActionCommand;

public final class SessionPlannerApplicationService {

    private static final String COMMAND_PARAMETER = "command";

    private final CreateSessionPlanUseCase createSessionUseCase;

    public SessionPlannerApplicationService(CreateSessionPlanUseCase createSessionUseCase) {
        this.createSessionUseCase = Objects.requireNonNull(createSessionUseCase, "createSessionUseCase");
    }

    public void createSession(SessionPlannerActionCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        createSessionUseCase.execute();
    }
}
