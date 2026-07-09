package src.domain.encounter.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.EncounterGenerationInputs;
import src.domain.encounter.model.plan.usecase.PublishEncounterSavedPlansUseCase;
import src.domain.encounter.model.session.EncounterInitiativeInput;
import src.domain.encounter.model.session.EncounterSession;
import src.domain.encounter.model.session.EncounterSessionCommand;
import src.domain.encounter.model.session.usecase.ApplyEncounterSessionUseCase;
import src.domain.encounter.model.session.usecase.PublishEncounterSessionUseCase;

public final class ApplyEncounterStateUseCase {

    private static final int REFRESH_ACTION_CODE = 1;
    private static final Map<Integer, EncounterSessionCommand.Action> SESSION_ACTIONS_BY_CODE = Map.ofEntries(
            Map.entry(Integer.valueOf(REFRESH_ACTION_CODE), EncounterSessionCommand.Action.REFRESH),
            Map.entry(Integer.valueOf(2), EncounterSessionCommand.Action.GENERATE),
            Map.entry(Integer.valueOf(3), EncounterSessionCommand.Action.SAVE_CURRENT_PLAN),
            Map.entry(Integer.valueOf(4), EncounterSessionCommand.Action.OPEN_SAVED_PLAN),
            Map.entry(Integer.valueOf(5), EncounterSessionCommand.Action.CLEAR_GENERATION_HISTORY),
            Map.entry(Integer.valueOf(6), EncounterSessionCommand.Action.SHIFT_ALTERNATIVE),
            Map.entry(Integer.valueOf(7), EncounterSessionCommand.Action.ADD_CREATURE),
            Map.entry(Integer.valueOf(8), EncounterSessionCommand.Action.INCREMENT_CREATURE),
            Map.entry(Integer.valueOf(9), EncounterSessionCommand.Action.DECREMENT_CREATURE),
            Map.entry(Integer.valueOf(10), EncounterSessionCommand.Action.REMOVE_CREATURE),
            Map.entry(Integer.valueOf(11), EncounterSessionCommand.Action.UNDO_REMOVE),
            Map.entry(Integer.valueOf(12), EncounterSessionCommand.Action.OPEN_INITIATIVE),
            Map.entry(Integer.valueOf(13), EncounterSessionCommand.Action.BACK_TO_BUILDER),
            Map.entry(Integer.valueOf(14), EncounterSessionCommand.Action.CONFIRM_INITIATIVE),
            Map.entry(Integer.valueOf(15), EncounterSessionCommand.Action.ADVANCE_TURN),
            Map.entry(Integer.valueOf(16), EncounterSessionCommand.Action.ADJUST_INITIATIVE),
            Map.entry(Integer.valueOf(17), EncounterSessionCommand.Action.ADD_PARTY_MEMBER_TO_COMBAT),
            Map.entry(Integer.valueOf(18), EncounterSessionCommand.Action.END_COMBAT),
            Map.entry(Integer.valueOf(19), EncounterSessionCommand.Action.AWARD_XP),
            Map.entry(Integer.valueOf(20), EncounterSessionCommand.Action.RETURN_TO_BUILDER_AFTER_RESULTS),
            Map.entry(Integer.valueOf(21), EncounterSessionCommand.Action.MUTATE_HP));

    private final @Nullable ApplyEncounterSessionUseCase applySessionUseCase;
    private final PublishEncounterSessionUseCase publishSessionUseCase;
    private final PublishEncounterSavedPlansUseCase publishSavedPlansUseCase;

    public ApplyEncounterStateUseCase(
            @Nullable ApplyEncounterSessionUseCase applySessionUseCase,
            PublishEncounterSessionUseCase publishSessionUseCase,
            PublishEncounterSavedPlansUseCase publishSavedPlansUseCase
    ) {
        this.applySessionUseCase = applySessionUseCase;
        this.publishSessionUseCase = Objects.requireNonNull(publishSessionUseCase, "publishSessionUseCase");
        this.publishSavedPlansUseCase = Objects.requireNonNull(publishSavedPlansUseCase, "publishSavedPlansUseCase");
    }

    public void execute(@Nullable Request request) {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            publishSessionUseCase.execute(null);
            return;
        }
        EncounterSessionCommand effective = toSessionCommand(request);
        EncounterSession session = useCase.apply(effective);
        publishSessionUseCase.execute(session);
        if (effective.action().republishesSavedPlans()) {
            publishSavedPlansUseCase.execute();
        }
    }

    private static EncounterSessionCommand toSessionCommand(@Nullable Request request) {
        Request effective = request == null ? Request.refresh() : request;
        return new EncounterSessionCommand(
                toSessionAction(effective.actionCode()),
                java.util.Optional.empty(),
                EncounterGenerationInputs.empty(),
                effective.creatureId(),
                effective.planId(),
                effective.worldNpcId(),
                effective.delta(),
                effective.undoToken(),
                initiativeInputs(effective.initiativeValues()),
                effective.combatantId(),
                effective.initiative(),
                effective.partyMemberId(),
                effective.amount(),
                effective.healing());
    }

    private static EncounterSessionCommand.Action toSessionAction(int actionCode) {
        EncounterSessionCommand.Action action = SESSION_ACTIONS_BY_CODE.get(Integer.valueOf(actionCode));
        if (action == null) {
            throw new IllegalArgumentException("Unknown encounter state action code.");
        }
        return action;
    }

    private static List<EncounterInitiativeInput> initiativeInputs(List<InitiativeInput> values) {
        if (values == null) {
            return List.of();
        }
        List<EncounterInitiativeInput> inputs = new ArrayList<>(values.size());
        for (InitiativeInput value : values) {
            inputs.add(new EncounterInitiativeInput(value.id(), value.initiative()));
        }
        return List.copyOf(inputs);
    }

    public record InitiativeInput(String id, int initiative) { }

    public record Request(
            int actionCode,
            long creatureId,
            long planId,
            long worldNpcId,
            int delta,
            long undoToken,
            List<InitiativeInput> initiativeValues,
            @Nullable String combatantId,
            int initiative,
            long partyMemberId,
            int amount,
            boolean healing
    ) {
        public Request {
            initiativeValues = initiativeValues == null ? List.of() : List.copyOf(initiativeValues);
        }

        public static Request refresh() {
            return new Request(
                    REFRESH_ACTION_CODE,
                    0L,
                    0L,
                    0L,
                    0,
                    0L,
                    List.of(),
                    null,
                    0,
                    0L,
                    0,
                    false);
        }
    }
}
