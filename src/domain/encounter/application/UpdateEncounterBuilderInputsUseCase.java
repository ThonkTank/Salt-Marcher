package src.domain.encounter.application;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.session.model.EncounterSession;
import src.domain.encounter.model.session.model.EncounterSessionCommand;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.UpdateEncounterBuilderInputsCommand;

public final class UpdateEncounterBuilderInputsUseCase {

    private final @Nullable ApplyEncounterSessionUseCase applySessionUseCase;
    private final PublishEncounterSessionUseCase publishSessionUseCase;

    public UpdateEncounterBuilderInputsUseCase(
            @Nullable ApplyEncounterSessionUseCase applySessionUseCase,
            PublishEncounterSessionUseCase publishSessionUseCase
    ) {
        this.applySessionUseCase = applySessionUseCase;
        this.publishSessionUseCase = java.util.Objects.requireNonNull(publishSessionUseCase, "publishSessionUseCase");
    }

    public void execute(@Nullable UpdateEncounterBuilderInputsCommand command) {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            publishSessionUseCase.execute(null);
            return;
        }
        UpdateEncounterBuilderInputsCommand effective = command == null
                ? new UpdateEncounterBuilderInputsCommand(EncounterBuilderInputs.empty())
                : command;
        EncounterSession session = useCase.apply(EncounterSessionCommand.updateBuilderInputs(
                EncounterBuilderInputsTranslation.toInternal(effective.inputs())));
        publishSessionUseCase.execute(session);
    }
}
