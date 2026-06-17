package src.domain.sessionplanner;

import java.util.Objects;
import src.domain.sessionplanner.model.session.usecase.CreateSessionPlanUseCase;
import src.domain.sessionplanner.model.session.usecase.DeleteSessionPlanUseCase;
import src.domain.sessionplanner.model.session.usecase.RenameSessionPlanUseCase;
import src.domain.sessionplanner.model.session.usecase.SelectSessionPlanUseCase;
import src.domain.sessionplanner.published.SessionPlannerCatalogCommand;

public final class SessionPlannerApplicationService {

    private static final String COMMAND_PARAMETER = "command";

    private final CreateSessionPlanUseCase createSessionUseCase;
    private final SelectSessionPlanUseCase selectSessionPlanUseCase;
    private final RenameSessionPlanUseCase renameSessionPlanUseCase;
    private final DeleteSessionPlanUseCase deleteSessionPlanUseCase;

    public SessionPlannerApplicationService(
            CreateSessionPlanUseCase createSessionUseCase,
            SelectSessionPlanUseCase selectSessionPlanUseCase,
            RenameSessionPlanUseCase renameSessionPlanUseCase,
            DeleteSessionPlanUseCase deleteSessionPlanUseCase
    ) {
        this.createSessionUseCase = Objects.requireNonNull(createSessionUseCase, "createSessionUseCase");
        this.selectSessionPlanUseCase = Objects.requireNonNull(selectSessionPlanUseCase, "selectSessionPlanUseCase");
        this.renameSessionPlanUseCase = Objects.requireNonNull(renameSessionPlanUseCase, "renameSessionPlanUseCase");
        this.deleteSessionPlanUseCase = Objects.requireNonNull(deleteSessionPlanUseCase, "deleteSessionPlanUseCase");
    }

    public void createSession(SessionPlannerCatalogCommand.CreateSessionCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        createSessionUseCase.execute(command.displayName());
    }

    public void selectSession(SessionPlannerCatalogCommand.SelectSessionCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        selectSessionPlanUseCase.execute(command.sessionId());
    }

    public void renameSession(SessionPlannerCatalogCommand.RenameSessionCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        renameSessionPlanUseCase.execute(command.sessionId(), command.displayName());
    }

    public void deleteSession(SessionPlannerCatalogCommand.DeleteSessionCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        deleteSessionPlanUseCase.execute(command.sessionId());
    }
}
