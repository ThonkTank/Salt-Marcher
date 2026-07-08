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
        return Objects.requireNonNull(action, "action").sessionAction();
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

    public enum Action {

        REFRESH(1),
        GENERATE(2),
        SAVE_CURRENT_PLAN(3),
        OPEN_SAVED_PLAN(4),
        CLEAR_GENERATION_HISTORY(5),
        SHIFT_ALTERNATIVE(6),
        ADD_CREATURE(7),
        INCREMENT_CREATURE(8),
        DECREMENT_CREATURE(9),
        REMOVE_CREATURE(10),
        UNDO_REMOVE(11),
        OPEN_INITIATIVE(12),
        BACK_TO_BUILDER(13),
        CONFIRM_INITIATIVE(14),
        ADVANCE_TURN(15),
        ADJUST_INITIATIVE(16),
        ADD_PARTY_MEMBER_TO_COMBAT(17),
        END_COMBAT(18),
        AWARD_XP(19),
        RETURN_TO_BUILDER_AFTER_RESULTS(20),
        MUTATE_HP(21);

        private static final Action[] BY_CODE = createActionsByCode();

        private final int code;

        Action(int code) {
            this.code = code;
        }

        public static Action fromCode(int code) {
            if (code < 0 || code >= BY_CODE.length) {
                throw new IllegalArgumentException("Unknown encounter state action code.");
            }
            Action action = BY_CODE[code];
            if (action == null) {
                throw new IllegalArgumentException("Unknown encounter state action code.");
            }
            return action;
        }

        private static Action[] createActionsByCode() {
            Action[] actions = new Action[MUTATE_HP.code + 1];
            for (Action action : values()) {
                actions[action.code] = action;
            }
            return actions;
        }

        private EncounterSessionCommand.Action sessionAction() {
            if (code <= ADD_CREATURE.code) {
                return workflowSessionAction();
            }
            if (code <= CONFIRM_INITIATIVE.code) {
                return rosterSessionAction();
            }
            return combatSessionAction();
        }

        private EncounterSessionCommand.Action workflowSessionAction() {
            return switch (this) {
                case REFRESH -> EncounterSessionCommand.Action.REFRESH;
                case GENERATE -> EncounterSessionCommand.Action.GENERATE;
                case SAVE_CURRENT_PLAN -> EncounterSessionCommand.Action.SAVE_CURRENT_PLAN;
                case OPEN_SAVED_PLAN -> EncounterSessionCommand.Action.OPEN_SAVED_PLAN;
                case CLEAR_GENERATION_HISTORY -> EncounterSessionCommand.Action.CLEAR_GENERATION_HISTORY;
                case SHIFT_ALTERNATIVE -> EncounterSessionCommand.Action.SHIFT_ALTERNATIVE;
                case ADD_CREATURE -> EncounterSessionCommand.Action.ADD_CREATURE;
                default -> throw new IllegalArgumentException("Unknown encounter state action.");
            };
        }

        private EncounterSessionCommand.Action rosterSessionAction() {
            return switch (this) {
                case INCREMENT_CREATURE -> EncounterSessionCommand.Action.INCREMENT_CREATURE;
                case DECREMENT_CREATURE -> EncounterSessionCommand.Action.DECREMENT_CREATURE;
                case REMOVE_CREATURE -> EncounterSessionCommand.Action.REMOVE_CREATURE;
                case UNDO_REMOVE -> EncounterSessionCommand.Action.UNDO_REMOVE;
                case OPEN_INITIATIVE -> EncounterSessionCommand.Action.OPEN_INITIATIVE;
                case BACK_TO_BUILDER -> EncounterSessionCommand.Action.BACK_TO_BUILDER;
                case CONFIRM_INITIATIVE -> EncounterSessionCommand.Action.CONFIRM_INITIATIVE;
                default -> throw new IllegalArgumentException("Unknown encounter state action.");
            };
        }

        private EncounterSessionCommand.Action combatSessionAction() {
            return switch (this) {
                case ADVANCE_TURN -> EncounterSessionCommand.Action.ADVANCE_TURN;
                case ADJUST_INITIATIVE -> EncounterSessionCommand.Action.ADJUST_INITIATIVE;
                case ADD_PARTY_MEMBER_TO_COMBAT -> EncounterSessionCommand.Action.ADD_PARTY_MEMBER_TO_COMBAT;
                case END_COMBAT -> EncounterSessionCommand.Action.END_COMBAT;
                case AWARD_XP -> EncounterSessionCommand.Action.AWARD_XP;
                case RETURN_TO_BUILDER_AFTER_RESULTS ->
                        EncounterSessionCommand.Action.RETURN_TO_BUILDER_AFTER_RESULTS;
                case MUTATE_HP -> EncounterSessionCommand.Action.MUTATE_HP;
                default -> throw new IllegalArgumentException("Unknown encounter state action.");
            };
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
