package src.domain.encounter.model.session.usecase;

import java.util.ArrayList;
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
    private static final int AUTO_DIFFICULTY = 0;
    private static final int AUTO_BALANCE = 1;
    private static final int AUTO_AMOUNT = 2;
    private static final int AUTO_DIVERSITY = 3;
    private static final int LEVEL_DIFFICULTY = 0;
    private static final int LEVEL_BALANCE = 1;
    private static final int LEVEL_DIVERSITY = 2;
    private static final int ARG_CREATURE_TYPES = 0;
    private static final int ARG_CREATURE_SUBTYPES = 1;
    private static final int ARG_BIOMES = 2;
    private static final int ARG_AUTO_FLAGS = 3;
    private static final int ARG_TUNING_LEVELS = 4;
    private static final int ARG_AMOUNT_VALUE = 5;
    private static final int ARG_TABLE_IDS = 6;

    private final @Nullable ApplyEncounterSessionUseCase applySessionUseCase;
    private final PublishEncounterSessionUseCase publishSessionUseCase;

    public UpdateEncounterBuilderInputsUseCase(
            @Nullable ApplyEncounterSessionUseCase applySessionUseCase,
            PublishEncounterSessionUseCase publishSessionUseCase
    ) {
        this.applySessionUseCase = applySessionUseCase;
        this.publishSessionUseCase = java.util.Objects.requireNonNull(publishSessionUseCase, "publishSessionUseCase");
    }

    public void execute(@Nullable Object[] arguments) {
        List<?> creatureTypes = argument(arguments, ARG_CREATURE_TYPES, List.class);
        boolean[] autoFlags = argument(arguments, ARG_AUTO_FLAGS, boolean[].class);
        int[] tuningLevels = argument(arguments, ARG_TUNING_LEVELS, int[].class);
        Double amountValue = argument(arguments, ARG_AMOUNT_VALUE, Double.class);
        boolean useDefaultInputs = creatureTypes == null;
        execute(new EncounterGenerationInputs(
                stringsOrEmpty(creatureTypes),
                stringsOrEmpty(argument(arguments, ARG_CREATURE_SUBTYPES, List.class)),
                stringsOrEmpty(argument(arguments, ARG_BIOMES, List.class)),
                EncounterRequestedDifficulty.fromPublishedDifficulty(
                        useDefaultInputs || autoFlag(autoFlags, AUTO_DIFFICULTY),
                        tuningLevel(useDefaultInputs, tuningLevels, LEVEL_DIFFICULTY, DEFAULT_DIFFICULTY_LEVEL)),
                EncounterTuningIntent.fromPublishedValues(
                        useDefaultInputs || autoFlag(autoFlags, AUTO_BALANCE),
                        tuningLevel(useDefaultInputs, tuningLevels, LEVEL_BALANCE, DEFAULT_BALANCE_LEVEL),
                        useDefaultInputs || autoFlag(autoFlags, AUTO_AMOUNT),
                        amountValue(useDefaultInputs, amountValue),
                        useDefaultInputs || autoFlag(autoFlags, AUTO_DIVERSITY),
                        tuningLevel(useDefaultInputs, tuningLevels, LEVEL_DIVERSITY, DEFAULT_DIVERSITY_LEVEL)),
                longsOrEmpty(argument(arguments, ARG_TABLE_IDS, List.class))));
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

    private static List<String> stringsOrEmpty(@Nullable List<?> values) {
        if (values == null) {
            return List.of();
        }
        List<String> strings = new ArrayList<>();
        for (Object value : values) {
            if (value instanceof String string) {
                strings.add(string);
            }
        }
        return strings;
    }

    private static List<Long> longsOrEmpty(@Nullable List<?> values) {
        if (values == null) {
            return List.of();
        }
        List<Long> longs = new ArrayList<>();
        for (Object value : values) {
            if (value instanceof Long longValue) {
                longs.add(longValue);
            }
        }
        return longs;
    }

    private static boolean autoFlag(@Nullable boolean[] autoFlags, int index) {
        return autoFlags != null && index < autoFlags.length && autoFlags[index];
    }

    private static int tuningLevel(
            boolean useDefaultInputs,
            @Nullable int[] tuningLevels,
            int index,
            int defaultValue
    ) {
        if (useDefaultInputs || tuningLevels == null || index >= tuningLevels.length) {
            return defaultValue;
        }
        return tuningLevels[index];
    }

    private static double amountValue(boolean useDefaultInputs, @Nullable Double amountValue) {
        if (useDefaultInputs || amountValue == null) {
            return DEFAULT_AMOUNT_VALUE;
        }
        return amountValue;
    }

    private static <T> @Nullable T argument(@Nullable Object[] arguments, int index, Class<T> type) {
        if (arguments == null || index >= arguments.length) {
            return null;
        }
        Object value = arguments[index];
        return type.isInstance(value) ? type.cast(value) : null;
    }
}
