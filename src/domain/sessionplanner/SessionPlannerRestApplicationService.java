package src.domain.sessionplanner;

import java.util.Objects;
import src.domain.sessionplanner.model.session.usecase.ClearSessionRestGapUseCase;
import src.domain.sessionplanner.model.session.usecase.SetSessionRestGapUseCase;
import src.domain.sessionplanner.published.ClearSessionRestGapCommand;
import src.domain.sessionplanner.published.SetSessionRestGapCommand;

public final class SessionPlannerRestApplicationService {

    private static final String COMMAND_PARAMETER = "command";

    private final SetSessionRestGapUseCase setRestGapUseCase;
    private final ClearSessionRestGapUseCase clearRestGapUseCase;

    public SessionPlannerRestApplicationService(
            SetSessionRestGapUseCase setRestGapUseCase,
            ClearSessionRestGapUseCase clearRestGapUseCase
    ) {
        this.setRestGapUseCase = Objects.requireNonNull(setRestGapUseCase, "setRestGapUseCase");
        this.clearRestGapUseCase = Objects.requireNonNull(clearRestGapUseCase, "clearRestGapUseCase");
    }

    public void setRestGap(SetSessionRestGapCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        setRestGapUseCase.execute(command.leftEncounterId(), command.rightEncounterId(), command.restKind().name());
    }

    public void clearRestGap(ClearSessionRestGapCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        clearRestGapUseCase.execute(
                command.leftEncounterId(),
                command.rightEncounterId());
    }
}
