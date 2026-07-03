package src.domain.encounter.model.session.usecase;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.EncounterGenerationInputs;
import src.domain.encounter.model.generation.EncounterRequestedDifficulty;
import src.domain.encounter.model.generation.EncounterTuningIntent;
import src.domain.encounter.model.session.EncounterSession;
import src.domain.encounter.model.session.EncounterSessionCommand;

public final class UpdateEncounterBuilderInputsUseCase {

    private static final int DEFAULT_DIFFICULTY_LEVEL = 2;
    private static final int DEFAULT_BALANCE_LEVEL = 3;
    private static final double DEFAULT_AMOUNT_VALUE = 3.0;
    private static final int DEFAULT_DIVERSITY_LEVEL = 3;
    private final @Nullable ApplyEncounterSessionUseCase applySessionUseCase;
    private final PublishEncounterSessionUseCase publishSessionUseCase;

    public UpdateEncounterBuilderInputsUseCase(
            @Nullable ApplyEncounterSessionUseCase applySessionUseCase,
            PublishEncounterSessionUseCase publishSessionUseCase
    ) {
        this.applySessionUseCase = applySessionUseCase;
        this.publishSessionUseCase = java.util.Objects.requireNonNull(publishSessionUseCase, "publishSessionUseCase");
    }

    public void execute(@Nullable Request request) {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            publishSessionUseCase.execute(null);
            return;
        }
        EncounterSession session = useCase.apply(EncounterSessionCommand.updateBuilderInputs(
                toGenerationInputs(request)));
        publishSessionUseCase.execute(session);
    }

    private static EncounterGenerationInputs toGenerationInputs(@Nullable Request request) {
        if (request == null) {
            return EncounterGenerationInputs.empty();
        }
        return new EncounterGenerationInputs(
                request.creatureTypes(),
                request.creatureSubtypes(),
                request.biomes(),
                EncounterRequestedDifficulty.fromPublishedDifficulty(
                        request.autoDifficulty(),
                        request.difficultyLevel()),
                EncounterTuningIntent.fromPublishedValues(
                        request.autoBalance(),
                        request.balanceLevel(),
                        request.autoAmount(),
                        request.amountValue(),
                        request.autoDiversity(),
                        request.diversityLevel()),
                request.encounterTableIds(),
                request.worldFactionIds(),
                request.worldLocationId(),
                java.util.Map.of());
    }

    public record Request(
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            boolean autoDifficulty,
            int difficultyLevel,
            boolean autoBalance,
            int balanceLevel,
            boolean autoAmount,
            double amountValue,
            boolean autoDiversity,
            int diversityLevel,
            List<Long> encounterTableIds,
            List<Long> worldFactionIds,
            long worldLocationId
    ) {
        public Request {
            creatureTypes = creatureTypes == null ? List.of() : List.copyOf(creatureTypes);
            creatureSubtypes = creatureSubtypes == null ? List.of() : List.copyOf(creatureSubtypes);
            biomes = biomes == null ? List.of() : List.copyOf(biomes);
            encounterTableIds = encounterTableIds == null ? List.of() : List.copyOf(encounterTableIds);
            worldFactionIds = worldFactionIds == null ? List.of() : List.copyOf(worldFactionIds);
        }

        public static Request empty() {
            return new Request(
                    List.of(),
                    List.of(),
                    List.of(),
                    true,
                    DEFAULT_DIFFICULTY_LEVEL,
                    true,
                    DEFAULT_BALANCE_LEVEL,
                    true,
                    DEFAULT_AMOUNT_VALUE,
                    true,
                    DEFAULT_DIVERSITY_LEVEL,
                    List.of(),
                    List.of(),
                    0L);
        }
    }
}
