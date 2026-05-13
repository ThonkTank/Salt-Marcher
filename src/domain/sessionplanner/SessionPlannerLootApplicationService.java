package src.domain.sessionplanner;

import java.util.Objects;
import src.domain.sessionplanner.model.session.usecase.AddSessionLootPlaceholderUseCase;
import src.domain.sessionplanner.model.session.usecase.RemoveSessionLootPlaceholderUseCase;
import src.domain.sessionplanner.published.RemoveSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.SessionPlannerActionCommand;

public final class SessionPlannerLootApplicationService {

    private static final String COMMAND_PARAMETER = "command";

    private final AddSessionLootPlaceholderUseCase addLootPlaceholderUseCase;
    private final RemoveSessionLootPlaceholderUseCase removeLootPlaceholderUseCase;

    public SessionPlannerLootApplicationService(
            AddSessionLootPlaceholderUseCase addLootPlaceholderUseCase,
            RemoveSessionLootPlaceholderUseCase removeLootPlaceholderUseCase
    ) {
        this.addLootPlaceholderUseCase = Objects.requireNonNull(
                addLootPlaceholderUseCase,
                "addLootPlaceholderUseCase");
        this.removeLootPlaceholderUseCase = Objects.requireNonNull(
                removeLootPlaceholderUseCase,
                "removeLootPlaceholderUseCase");
    }

    public void addLootPlaceholder(SessionPlannerActionCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        addLootPlaceholderUseCase.execute();
    }

    public void removeLootPlaceholder(RemoveSessionLootPlaceholderCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        removeLootPlaceholderUseCase.execute(command.lootId());
    }
}
