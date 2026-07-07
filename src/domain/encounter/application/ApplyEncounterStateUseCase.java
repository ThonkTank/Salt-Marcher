package src.domain.encounter.application;

import java.util.ArrayList;
import java.util.List;
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
                toSessionAction(effective.action()),
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

    private static EncounterSessionCommand.Action toSessionAction(Action action) {
        return switch (action.code) {
            case Action.REFRESH_CODE -> EncounterSessionCommand.Action.REFRESH;
            case Action.GENERATE_CODE -> EncounterSessionCommand.Action.GENERATE;
            case Action.SAVE_CURRENT_PLAN_CODE -> EncounterSessionCommand.Action.SAVE_CURRENT_PLAN;
            case Action.OPEN_SAVED_PLAN_CODE -> EncounterSessionCommand.Action.OPEN_SAVED_PLAN;
            case Action.CLEAR_GENERATION_HISTORY_CODE -> EncounterSessionCommand.Action.CLEAR_GENERATION_HISTORY;
            case Action.SHIFT_ALTERNATIVE_CODE -> EncounterSessionCommand.Action.SHIFT_ALTERNATIVE;
            case Action.ADD_CREATURE_CODE -> EncounterSessionCommand.Action.ADD_CREATURE;
            case Action.INCREMENT_CREATURE_CODE -> EncounterSessionCommand.Action.INCREMENT_CREATURE;
            case Action.DECREMENT_CREATURE_CODE -> EncounterSessionCommand.Action.DECREMENT_CREATURE;
            case Action.REMOVE_CREATURE_CODE -> EncounterSessionCommand.Action.REMOVE_CREATURE;
            case Action.UNDO_REMOVE_CODE -> EncounterSessionCommand.Action.UNDO_REMOVE;
            case Action.OPEN_INITIATIVE_CODE -> EncounterSessionCommand.Action.OPEN_INITIATIVE;
            case Action.BACK_TO_BUILDER_CODE -> EncounterSessionCommand.Action.BACK_TO_BUILDER;
            case Action.CONFIRM_INITIATIVE_CODE -> EncounterSessionCommand.Action.CONFIRM_INITIATIVE;
            case Action.ADVANCE_TURN_CODE -> EncounterSessionCommand.Action.ADVANCE_TURN;
            case Action.ADJUST_INITIATIVE_CODE -> EncounterSessionCommand.Action.ADJUST_INITIATIVE;
            case Action.ADD_PARTY_MEMBER_TO_COMBAT_CODE -> EncounterSessionCommand.Action.ADD_PARTY_MEMBER_TO_COMBAT;
            case Action.END_COMBAT_CODE -> EncounterSessionCommand.Action.END_COMBAT;
            case Action.AWARD_XP_CODE -> EncounterSessionCommand.Action.AWARD_XP;
            case Action.RETURN_TO_BUILDER_AFTER_RESULTS_CODE ->
                    EncounterSessionCommand.Action.RETURN_TO_BUILDER_AFTER_RESULTS;
            case Action.MUTATE_HP_CODE -> EncounterSessionCommand.Action.MUTATE_HP;
            default -> throw new IllegalArgumentException("Unknown encounter state action.");
        };
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

    public static final class Action {

        private static final int REFRESH_CODE = 1;
        private static final int GENERATE_CODE = 2;
        private static final int SAVE_CURRENT_PLAN_CODE = 3;
        private static final int OPEN_SAVED_PLAN_CODE = 4;
        private static final int CLEAR_GENERATION_HISTORY_CODE = 5;
        private static final int SHIFT_ALTERNATIVE_CODE = 6;
        private static final int ADD_CREATURE_CODE = 7;
        private static final int INCREMENT_CREATURE_CODE = 8;
        private static final int DECREMENT_CREATURE_CODE = 9;
        private static final int REMOVE_CREATURE_CODE = 10;
        private static final int UNDO_REMOVE_CODE = 11;
        private static final int OPEN_INITIATIVE_CODE = 12;
        private static final int BACK_TO_BUILDER_CODE = 13;
        private static final int CONFIRM_INITIATIVE_CODE = 14;
        private static final int ADVANCE_TURN_CODE = 15;
        private static final int ADJUST_INITIATIVE_CODE = 16;
        private static final int ADD_PARTY_MEMBER_TO_COMBAT_CODE = 17;
        private static final int END_COMBAT_CODE = 18;
        private static final int AWARD_XP_CODE = 19;
        private static final int RETURN_TO_BUILDER_AFTER_RESULTS_CODE = 20;
        private static final int MUTATE_HP_CODE = 21;

        public static final Action REFRESH = new Action(REFRESH_CODE);
        public static final Action GENERATE = new Action(GENERATE_CODE);
        public static final Action SAVE_CURRENT_PLAN = new Action(SAVE_CURRENT_PLAN_CODE);
        public static final Action OPEN_SAVED_PLAN = new Action(OPEN_SAVED_PLAN_CODE);
        public static final Action CLEAR_GENERATION_HISTORY = new Action(CLEAR_GENERATION_HISTORY_CODE);
        public static final Action SHIFT_ALTERNATIVE = new Action(SHIFT_ALTERNATIVE_CODE);
        public static final Action ADD_CREATURE = new Action(ADD_CREATURE_CODE);
        public static final Action INCREMENT_CREATURE = new Action(INCREMENT_CREATURE_CODE);
        public static final Action DECREMENT_CREATURE = new Action(DECREMENT_CREATURE_CODE);
        public static final Action REMOVE_CREATURE = new Action(REMOVE_CREATURE_CODE);
        public static final Action UNDO_REMOVE = new Action(UNDO_REMOVE_CODE);
        public static final Action OPEN_INITIATIVE = new Action(OPEN_INITIATIVE_CODE);
        public static final Action BACK_TO_BUILDER = new Action(BACK_TO_BUILDER_CODE);
        public static final Action CONFIRM_INITIATIVE = new Action(CONFIRM_INITIATIVE_CODE);
        public static final Action ADVANCE_TURN = new Action(ADVANCE_TURN_CODE);
        public static final Action ADJUST_INITIATIVE = new Action(ADJUST_INITIATIVE_CODE);
        public static final Action ADD_PARTY_MEMBER_TO_COMBAT = new Action(ADD_PARTY_MEMBER_TO_COMBAT_CODE);
        public static final Action END_COMBAT = new Action(END_COMBAT_CODE);
        public static final Action AWARD_XP = new Action(AWARD_XP_CODE);
        public static final Action RETURN_TO_BUILDER_AFTER_RESULTS =
                new Action(RETURN_TO_BUILDER_AFTER_RESULTS_CODE);
        public static final Action MUTATE_HP = new Action(MUTATE_HP_CODE);

        private final int code;

        private Action(int code) {
            this.code = code;
        }
    }

    public record Request(
            Action action,
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
            action = Objects.requireNonNull(action, "action");
            initiativeValues = initiativeValues == null ? List.of() : List.copyOf(initiativeValues);
        }

        public static Request refresh() {
            return new Request(
                    Action.REFRESH,
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
