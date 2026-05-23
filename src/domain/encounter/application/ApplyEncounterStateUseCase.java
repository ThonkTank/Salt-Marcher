package src.domain.encounter.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.model.EncounterGenerationInputs;
import src.domain.encounter.model.plan.usecase.PublishEncounterSavedPlansUseCase;
import src.domain.encounter.model.session.model.EncounterInitiativeInput;
import src.domain.encounter.model.session.model.EncounterSession;
import src.domain.encounter.model.session.model.EncounterSessionCommand;
import src.domain.encounter.model.session.usecase.ApplyEncounterSessionUseCase;
import src.domain.encounter.model.session.usecase.PublishEncounterSessionUseCase;

public final class ApplyEncounterStateUseCase {

    private static final int STATE_ID_CREATURE = 0;
    private static final int STATE_ID_PLAN = 1;
    private static final int STATE_ID_UNDO_TOKEN = 2;
    private static final int STATE_ID_PARTY_MEMBER = 3;
    private static final int STATE_VALUE_DELTA = 0;
    private static final int STATE_VALUE_INITIATIVE = 1;
    private static final int STATE_VALUE_AMOUNT = 2;
    private static final int ARG_ACTION_NAME = 0;
    private static final int ARG_STATE_IDS = 1;
    private static final int ARG_STATE_VALUES = 2;
    private static final int ARG_INITIATIVE_IDS = 3;
    private static final int ARG_INITIATIVES = 4;
    private static final int ARG_COMBATANT_ID = 5;
    private static final int ARG_HEALING = 6;

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

    public void execute(@Nullable Object[] arguments) {
        execute(new EncounterSessionCommand(
                toAction(argument(arguments, ARG_ACTION_NAME, String.class)),
                Optional.empty(),
                EncounterGenerationInputs.empty(),
                stateId(argument(arguments, ARG_STATE_IDS, long[].class), STATE_ID_CREATURE),
                stateId(argument(arguments, ARG_STATE_IDS, long[].class), STATE_ID_PLAN),
                stateValue(argument(arguments, ARG_STATE_VALUES, int[].class), STATE_VALUE_DELTA),
                stateId(argument(arguments, ARG_STATE_IDS, long[].class), STATE_ID_UNDO_TOKEN),
                initiativeInputs(argument(arguments, ARG_INITIATIVE_IDS, List.class),
                        argument(arguments, ARG_INITIATIVES, List.class)),
                argument(arguments, ARG_COMBATANT_ID, String.class),
                stateValue(argument(arguments, ARG_STATE_VALUES, int[].class), STATE_VALUE_INITIATIVE),
                stateId(argument(arguments, ARG_STATE_IDS, long[].class), STATE_ID_PARTY_MEMBER),
                stateValue(argument(arguments, ARG_STATE_VALUES, int[].class), STATE_VALUE_AMOUNT),
                Boolean.TRUE.equals(argument(arguments, ARG_HEALING, Boolean.class))));
    }

    public void execute(@Nullable EncounterSessionCommand command) {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            publishSessionUseCase.execute(null);
            return;
        }
        EncounterSessionCommand effective = command == null ? EncounterSessionCommand.refresh() : command;
        EncounterSession session = useCase.apply(effective);
        publishSessionUseCase.execute(session);
        if (effective.action().republishesSavedPlans()) {
            publishSavedPlansUseCase.execute();
        }
    }

    private static EncounterSessionCommand.Action toAction(@Nullable String actionName) {
        if (actionName == null || actionName.isBlank()) {
            return EncounterSessionCommand.Action.REFRESH;
        }
        return EncounterSessionCommand.Action.valueOf(actionName);
    }

    private static long stateId(@Nullable long[] stateIds, int index) {
        if (stateIds == null || index >= stateIds.length) {
            return 0L;
        }
        return stateIds[index];
    }

    private static int stateValue(@Nullable int[] stateValues, int index) {
        if (stateValues == null || index >= stateValues.length) {
            return 0;
        }
        return stateValues[index];
    }

    private static <T> @Nullable T argument(@Nullable Object[] arguments, int index, Class<T> type) {
        if (arguments == null || index >= arguments.length) {
            return null;
        }
        Object value = arguments[index];
        return type.isInstance(value) ? type.cast(value) : null;
    }

    private static List<EncounterInitiativeInput> initiativeInputs(
            @Nullable List<?> initiativeIds,
            @Nullable List<?> initiatives
    ) {
        if (initiativeIds == null || initiatives == null) {
            return List.of();
        }
        int count = Math.min(initiativeIds.size(), initiatives.size());
        List<EncounterInitiativeInput> inputs = new ArrayList<>(count);
        for (int index = 0; index < count; index++) {
            Object id = initiativeIds.get(index);
            Object initiative = initiatives.get(index);
            if (id instanceof String initiativeId && initiative instanceof Integer initiativeValue) {
                inputs.add(new EncounterInitiativeInput(initiativeId, initiativeValue));
            }
        }
        return inputs;
    }
}
