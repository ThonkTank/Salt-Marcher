package src.domain.encounter.application;

import static src.domain.encounter.session.value.EncounterSessionValues.Snapshot;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import src.domain.encounter.session.entity.EncounterSession;
import src.domain.encounter.session.value.EncounterSessionCommand;

public final class ApplyEncounterSessionUseCase {

    private static final Map<EncounterSessionCommand.Action, SessionCommandHandler> HANDLERS = createHandlers();

    private final EncounterSession.RuntimeAccess runtimeAccess;
    private final EncounterSession session = new EncounterSession();

    public ApplyEncounterSessionUseCase(EncounterSession.RuntimeAccess runtimeAccess) {
        this.runtimeAccess = Objects.requireNonNull(runtimeAccess, "runtimeAccess");
        session.refreshContext(runtimeAccess);
    }

    public Snapshot snapshot() {
        return session.snapshot();
    }

    public Snapshot apply(EncounterSessionCommand command) {
        EncounterSessionCommand effective = command == null ? EncounterSessionCommand.refresh() : command;
        return handlerFor(effective.action()).apply(session, runtimeAccess, effective);
    }

    private static Map<EncounterSessionCommand.Action, SessionCommandHandler> createHandlers() {
        EnumMap<EncounterSessionCommand.Action, SessionCommandHandler> handlers =
                new EnumMap<>(EncounterSessionCommand.Action.class);
        handlers.put(EncounterSessionCommand.Action.REFRESH, (session, runtimeAccess, command) -> {
            session.refreshContext(runtimeAccess);
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.UPDATE_BUILDER_INPUTS, (session, runtimeAccess, command) -> {
            session.updateBuilderInputs(command.builderInputs());
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.GENERATE, (session, runtimeAccess, command) -> {
            session.generate(runtimeAccess, command.generation());
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.SAVE_CURRENT_PLAN, (session, runtimeAccess, command) -> {
            session.saveCurrentPlan(runtimeAccess);
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.OPEN_SAVED_PLAN, (session, runtimeAccess, command) -> {
            session.openSavedPlan(runtimeAccess, command.planId());
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.CLEAR_GENERATION_HISTORY, (session, runtimeAccess, command) -> {
            session.clearGenerationHistory();
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.SHIFT_ALTERNATIVE, (session, runtimeAccess, command) -> {
            session.shiftGeneratedAlternative(command.delta());
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.ADD_CREATURE, (session, runtimeAccess, command) -> {
            session.addCreature(runtimeAccess, command.creatureId());
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.INCREMENT_CREATURE, (session, runtimeAccess, command) -> {
            session.incrementCreature(command.creatureId());
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.DECREMENT_CREATURE, (session, runtimeAccess, command) -> {
            session.decrementCreature(command.creatureId());
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.REMOVE_CREATURE, (session, runtimeAccess, command) -> {
            session.removeCreature(command.creatureId());
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.UNDO_REMOVE, (session, runtimeAccess, command) -> {
            session.undoRemove(command.token());
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.OPEN_INITIATIVE, (session, runtimeAccess, command) -> {
            session.openInitiative();
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.BACK_TO_BUILDER, (session, runtimeAccess, command) -> {
            session.backToBuilder();
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.CONFIRM_INITIATIVE, (session, runtimeAccess, command) -> {
            session.confirmInitiative(command.initiativeInputs());
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.ADVANCE_TURN, (session, runtimeAccess, command) -> {
            session.advanceTurn();
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.ADJUST_INITIATIVE, (session, runtimeAccess, command) -> {
            session.adjustInitiative(command.combatantId(), command.initiative());
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.ADD_PARTY_MEMBER_TO_COMBAT, (session, runtimeAccess, command) -> {
            session.addPartyMemberToCombat(command.partyMemberId(), command.initiative());
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.END_COMBAT, (session, runtimeAccess, command) -> {
            session.endCombat();
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.AWARD_XP, (session, runtimeAccess, command) -> {
            session.awardXp(runtimeAccess);
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.RETURN_TO_BUILDER_AFTER_RESULTS, (session, runtimeAccess, command) -> {
            session.returnToBuilderAfterResults();
            return session.snapshot();
        });
        handlers.put(EncounterSessionCommand.Action.MUTATE_HP, (session, runtimeAccess, command) -> {
            session.mutateHp(command.combatantId(), command.amount(), command.healing());
            return session.snapshot();
        });
        return Map.copyOf(handlers);
    }

    private static SessionCommandHandler handlerFor(EncounterSessionCommand.Action action) {
        return Objects.requireNonNull(HANDLERS.get(action), () -> "Missing session handler for " + action);
    }

    @FunctionalInterface
    private interface SessionCommandHandler {
        Snapshot apply(
                EncounterSession session,
                EncounterSession.RuntimeAccess runtimeAccess,
                EncounterSessionCommand command
        );
    }
}
