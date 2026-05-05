package src.domain.encounter.application;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import src.domain.encounter.session.entity.EncounterSession;

public final class ApplyEncounterSessionUseCase {

    private final EncounterSession.RuntimeAccess runtimeAccess;
    private final EncounterSession session = new EncounterSession();

    public ApplyEncounterSessionUseCase(EncounterSession.RuntimeAccess runtimeAccess) {
        this.runtimeAccess = Objects.requireNonNull(runtimeAccess, "runtimeAccess");
        session.refreshPartyContext(runtimeAccess);
    }

    public EncounterSession.SnapshotData snapshot() {
        return session.snapshot();
    }

    public EncounterSession.SnapshotData apply(Command command) {
        Command effective = command == null ? Command.refresh() : command;
        return switch (effective.action()) {
            case REFRESH -> session.refreshPartyContext(runtimeAccess);
            case UPDATE_BUILDER_INPUTS -> session.updateBuilderInputs(effective.builderInputs());
            case GENERATE -> session.generate(runtimeAccess, effective.generation());
            case SAVE_CURRENT_PLAN -> session.saveCurrentPlan(runtimeAccess);
            case OPEN_SAVED_PLAN -> session.openSavedPlan(runtimeAccess, effective.planId());
            case CLEAR_GENERATION_HISTORY -> session.clearGenerationHistory();
            case SHIFT_ALTERNATIVE -> session.shiftGeneratedAlternative(effective.delta());
            case ADD_CREATURE -> session.addCreature(runtimeAccess, effective.creatureId());
            case INCREMENT_CREATURE -> session.incrementCreature(effective.creatureId());
            case DECREMENT_CREATURE -> session.decrementCreature(effective.creatureId());
            case REMOVE_CREATURE -> session.removeCreature(effective.creatureId());
            case UNDO_REMOVE -> session.undoRemove(effective.token());
            case OPEN_INITIATIVE -> session.openInitiative();
            case BACK_TO_BUILDER -> session.backToBuilder();
            case CONFIRM_INITIATIVE -> session.confirmInitiative(effective.initiativeInputs());
            case ADVANCE_TURN -> session.nextTurn();
            case SET_INITIATIVE -> session.setInitiative(effective.combatantId(), effective.initiative());
            case ADD_PARTY_MEMBER_TO_COMBAT ->
                    session.addPartyMemberToCombat(effective.partyMemberId(), effective.initiative());
            case END_COMBAT -> session.endCombat();
            case AWARD_XP -> session.awardXp(runtimeAccess);
            case RETURN_TO_BUILDER_AFTER_RESULTS -> session.returnToBuilderAfterResults();
            case MUTATE_HP -> session.mutateHp(effective.combatantId(), effective.amount(), effective.healing());
        };
    }

    public record Command(
            Action action,
            Optional<EncounterSession.GenerateRequestData> generation,
            EncounterSession.BuilderInputsData builderInputs,
            long creatureId,
            long planId,
            int delta,
            long token,
            List<EncounterSession.InitiativeInputData> initiativeInputs,
            String combatantId,
            int initiative,
            long partyMemberId,
            int amount,
            boolean healing
    ) {
        public Command {
            action = action == null ? Action.REFRESH : action;
            generation = generation == null ? Optional.empty() : generation;
            builderInputs = builderInputs == null ? EncounterSession.BuilderInputsData.empty() : builderInputs;
            initiativeInputs = initiativeInputs == null ? List.of() : List.copyOf(initiativeInputs);
            combatantId = combatantId == null ? "" : combatantId;
        }

        public static Command refresh() {
            return new Command(
                    Action.REFRESH,
                    Optional.empty(),
                    EncounterSession.BuilderInputsData.empty(),
                    0L,
                    0L,
                    0,
                    0L,
                    List.of(),
                    "",
                    0,
                    0L,
                    0,
                    false);
        }
    }

    public enum Action {
        REFRESH,
        UPDATE_BUILDER_INPUTS,
        GENERATE,
        SAVE_CURRENT_PLAN,
        OPEN_SAVED_PLAN,
        CLEAR_GENERATION_HISTORY,
        SHIFT_ALTERNATIVE,
        ADD_CREATURE,
        INCREMENT_CREATURE,
        DECREMENT_CREATURE,
        REMOVE_CREATURE,
        UNDO_REMOVE,
        OPEN_INITIATIVE,
        BACK_TO_BUILDER,
        CONFIRM_INITIATIVE,
        ADVANCE_TURN,
        SET_INITIATIVE,
        ADD_PARTY_MEMBER_TO_COMBAT,
        END_COMBAT,
        AWARD_XP,
        RETURN_TO_BUILDER_AFTER_RESULTS,
        MUTATE_HP
    }
}
