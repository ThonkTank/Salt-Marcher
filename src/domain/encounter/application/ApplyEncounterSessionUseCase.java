package src.domain.encounter.application;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import src.domain.encounter.session.entity.EncounterSession;

public final class ApplyEncounterSessionUseCase {

    private static final Map<Action, SessionCommandHandler> HANDLERS = createHandlers();

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
        return handlerFor(effective.action()).apply(session, runtimeAccess, effective);
    }

    private static Map<Action, SessionCommandHandler> createHandlers() {
        EnumMap<Action, SessionCommandHandler> handlers = new EnumMap<>(Action.class);
        handlers.put(Action.REFRESH, (session, runtimeAccess, command) -> session.refreshPartyContext(runtimeAccess));
        handlers.put(
                Action.UPDATE_BUILDER_INPUTS,
                (session, runtimeAccess, command) -> session.updateBuilderInputs(command.builderInputs()));
        handlers.put(Action.GENERATE, (session, runtimeAccess, command) -> session.generate(runtimeAccess, command.generation()));
        handlers.put(Action.SAVE_CURRENT_PLAN, (session, runtimeAccess, command) -> session.saveCurrentPlan(runtimeAccess));
        handlers.put(Action.OPEN_SAVED_PLAN, (session, runtimeAccess, command) -> session.openSavedPlan(runtimeAccess, command.planId()));
        handlers.put(Action.CLEAR_GENERATION_HISTORY, (session, runtimeAccess, command) -> session.clearGenerationHistory());
        handlers.put(Action.SHIFT_ALTERNATIVE, (session, runtimeAccess, command) -> session.shiftGeneratedAlternative(command.delta()));
        handlers.put(Action.ADD_CREATURE, (session, runtimeAccess, command) -> session.addCreature(runtimeAccess, command.creatureId()));
        handlers.put(Action.INCREMENT_CREATURE, (session, runtimeAccess, command) -> session.incrementCreature(command.creatureId()));
        handlers.put(Action.DECREMENT_CREATURE, (session, runtimeAccess, command) -> session.decrementCreature(command.creatureId()));
        handlers.put(Action.REMOVE_CREATURE, (session, runtimeAccess, command) -> session.removeCreature(command.creatureId()));
        handlers.put(Action.UNDO_REMOVE, (session, runtimeAccess, command) -> session.undoRemove(command.token()));
        handlers.put(Action.OPEN_INITIATIVE, (session, runtimeAccess, command) -> session.openInitiative());
        handlers.put(Action.BACK_TO_BUILDER, (session, runtimeAccess, command) -> session.backToBuilder());
        handlers.put(
                Action.CONFIRM_INITIATIVE,
                (session, runtimeAccess, command) -> session.confirmInitiative(command.initiativeInputs()));
        handlers.put(Action.ADVANCE_TURN, (session, runtimeAccess, command) -> session.nextTurn());
        handlers.put(
                Action.SET_INITIATIVE,
                (session, runtimeAccess, command) -> session.setInitiative(command.combatantId(), command.initiative()));
        handlers.put(
                Action.ADD_PARTY_MEMBER_TO_COMBAT,
                (session, runtimeAccess, command) ->
                        session.addPartyMemberToCombat(command.partyMemberId(), command.initiative()));
        handlers.put(Action.END_COMBAT, (session, runtimeAccess, command) -> session.endCombat());
        handlers.put(Action.AWARD_XP, (session, runtimeAccess, command) -> session.awardXp(runtimeAccess));
        handlers.put(
                Action.RETURN_TO_BUILDER_AFTER_RESULTS,
                (session, runtimeAccess, command) -> session.returnToBuilderAfterResults());
        handlers.put(
                Action.MUTATE_HP,
                (session, runtimeAccess, command) ->
                        session.mutateHp(command.combatantId(), command.amount(), command.healing()));
        return Map.copyOf(handlers);
    }

    private static SessionCommandHandler handlerFor(Action action) {
        return Objects.requireNonNull(HANDLERS.get(action), () -> "Missing session handler for " + action);
    }

    @FunctionalInterface
    private interface SessionCommandHandler {
        EncounterSession.SnapshotData apply(
                EncounterSession session,
                EncounterSession.RuntimeAccess runtimeAccess,
                Command command
        );
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
