package src.domain.encounter.application;

import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.session.model.EncounterSession;
import src.domain.encounter.model.session.model.EncounterSessionCommand;
import src.domain.encounter.published.ApplyEncounterStateCommand;

public final class ApplyEncounterStateUseCase {

    private final @Nullable ApplyEncounterSessionUseCase applySessionUseCase;
    private final PublishEncounterSessionUseCase publishSessionUseCase;
    private final PublishEncounterSavedPlansUseCase publishSavedPlansUseCase;

    public ApplyEncounterStateUseCase(
            @Nullable ApplyEncounterSessionUseCase applySessionUseCase,
            PublishEncounterSessionUseCase publishSessionUseCase,
            PublishEncounterSavedPlansUseCase publishSavedPlansUseCase
    ) {
        this.applySessionUseCase = applySessionUseCase;
        this.publishSessionUseCase = java.util.Objects.requireNonNull(publishSessionUseCase, "publishSessionUseCase");
        this.publishSavedPlansUseCase = java.util.Objects.requireNonNull(publishSavedPlansUseCase, "publishSavedPlansUseCase");
    }

    public void execute(@Nullable ApplyEncounterStateCommand command) {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            publishSessionUseCase.execute(null);
            return;
        }
        EncounterSession session = useCase.apply(toInternalCommand(command));
        publishSessionUseCase.execute(session);
        if (command == null || command.action().republishesSavedPlans()) {
            publishSavedPlansUseCase.execute();
        }
    }

    private static EncounterSessionCommand toInternalCommand(@Nullable ApplyEncounterStateCommand command) {
        if (command == null) {
            return EncounterSessionCommand.refresh();
        }
        return new EncounterSessionCommand(
                toInternalAction(command.action()),
                Optional.empty(),
                EncounterBuilderInputsTranslation.toInternal(null),
                command.creatureId(),
                command.planId(),
                command.delta(),
                command.undoToken(),
                command.initiativeValues(),
                command.combatantId(),
                command.initiative(),
                command.partyMemberId(),
                command.amount(),
                command.healing());
    }

    private static EncounterSessionCommand.Action toInternalAction(ApplyEncounterStateCommand.Action action) {
        ApplyEncounterStateCommand.Action effective = action == null
                ? ApplyEncounterStateCommand.Action.REFRESH
                : action;
        return EncounterSessionCommand.Action.valueOf(effective.name());
    }
}
