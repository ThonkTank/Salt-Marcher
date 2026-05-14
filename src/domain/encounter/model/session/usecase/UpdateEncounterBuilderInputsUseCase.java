package src.domain.encounter.model.session.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.model.EncounterGenerationInputs;
import src.domain.encounter.model.session.model.EncounterSession;
import src.domain.encounter.model.session.model.EncounterSessionCommand;

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

    public void execute(@Nullable EncounterGenerationInputs inputs) {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            publishSessionUseCase.execute(null);
            return;
        }
        EncounterSession session = useCase.apply(EncounterSessionCommand.updateBuilderInputs(
                inputs == null ? EncounterGenerationInputs.empty() : inputs));
        publishSessionUseCase.execute(session);
    }
}
