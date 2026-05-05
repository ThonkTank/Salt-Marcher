package src.domain.encounter.application;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import src.domain.encounter.session.entity.EncounterSession;
import src.domain.encounter.session.entity.EncounterSessionViewState;
import src.domain.encounter.session.service.EncounterSessionBuilderService;
import src.domain.encounter.session.service.EncounterSessionCombatService;
import src.domain.encounter.session.service.EncounterSessionCommand;
import src.domain.encounter.session.service.EncounterSessionRuntimeAccess;

public final class ApplyEncounterSessionUseCase {

    private static final Map<EncounterSessionCommand.Action, SessionCommandHandler> HANDLERS = createHandlers();

    private final EncounterSessionRuntimeAccess runtimeAccess;
    private final EncounterSession session = new EncounterSession();

    public ApplyEncounterSessionUseCase(EncounterSessionRuntimeAccess runtimeAccess) {
        this.runtimeAccess = Objects.requireNonNull(runtimeAccess, "runtimeAccess");
        EncounterSessionBuilderService.refreshPartyContext(session.state(), runtimeAccess);
    }

    public EncounterSessionViewState.SnapshotData snapshot() {
        return session.snapshot();
    }

    public EncounterSessionViewState.SnapshotData apply(EncounterSessionCommand command) {
        EncounterSessionCommand effective = command == null ? EncounterSessionCommand.refresh() : command;
        return handlerFor(effective.action()).apply(session, runtimeAccess, effective);
    }

    private static Map<EncounterSessionCommand.Action, SessionCommandHandler> createHandlers() {
        EnumMap<EncounterSessionCommand.Action, SessionCommandHandler> handlers =
                new EnumMap<>(EncounterSessionCommand.Action.class);
        handlers.put(
                EncounterSessionCommand.Action.REFRESH,
                (session, runtimeAccess, command) -> {
                    EncounterSessionBuilderService.refreshPartyContext(session.state(), runtimeAccess);
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.UPDATE_BUILDER_INPUTS,
                (session, runtimeAccess, command) -> {
                    EncounterSessionBuilderService.updateBuilderInputs(session.state(), command.builderInputs());
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.GENERATE,
                (session, runtimeAccess, command) -> {
                    EncounterSessionBuilderService.generate(session.state(), runtimeAccess, command.generation());
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.SAVE_CURRENT_PLAN,
                (session, runtimeAccess, command) -> {
                    EncounterSessionBuilderService.saveCurrentPlan(session.state(), runtimeAccess);
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.OPEN_SAVED_PLAN,
                (session, runtimeAccess, command) -> {
                    EncounterSessionBuilderService.openSavedPlan(session.state(), runtimeAccess, command.planId());
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.CLEAR_GENERATION_HISTORY,
                (session, runtimeAccess, command) -> {
                    EncounterSessionBuilderService.clearGenerationHistory(session.state());
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.SHIFT_ALTERNATIVE,
                (session, runtimeAccess, command) -> {
                    EncounterSessionBuilderService.shiftGeneratedAlternative(session.state(), command.delta());
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.ADD_CREATURE,
                (session, runtimeAccess, command) -> {
                    EncounterSessionBuilderService.addCreature(session.state(), runtimeAccess, command.creatureId());
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.INCREMENT_CREATURE,
                (session, runtimeAccess, command) -> {
                    EncounterSessionBuilderService.incrementCreature(session.state(), command.creatureId());
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.DECREMENT_CREATURE,
                (session, runtimeAccess, command) -> {
                    EncounterSessionBuilderService.decrementCreature(session.state(), command.creatureId());
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.REMOVE_CREATURE,
                (session, runtimeAccess, command) -> {
                    EncounterSessionBuilderService.removeCreature(session.state(), command.creatureId());
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.UNDO_REMOVE,
                (session, runtimeAccess, command) -> {
                    EncounterSessionBuilderService.undoRemove(session.state(), command.token());
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.OPEN_INITIATIVE,
                (session, runtimeAccess, command) -> {
                    EncounterSessionCombatService.openInitiative(session.state());
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.BACK_TO_BUILDER,
                (session, runtimeAccess, command) -> {
                    EncounterSessionCombatService.backToBuilder(session.state());
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.CONFIRM_INITIATIVE,
                (session, runtimeAccess, command) -> {
                    EncounterSessionCombatService.confirmInitiative(session.state(), command.initiativeInputs());
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.ADVANCE_TURN,
                (session, runtimeAccess, command) -> {
                    EncounterSessionCombatService.nextTurn(session.state());
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.SET_INITIATIVE,
                (session, runtimeAccess, command) -> {
                    EncounterSessionCombatService.setInitiative(session.state(), command.combatantId(), command.initiative());
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.ADD_PARTY_MEMBER_TO_COMBAT,
                (session, runtimeAccess, command) -> {
                    EncounterSessionCombatService.addPartyMemberToCombat(
                            session.state(),
                            command.partyMemberId(),
                            command.initiative());
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.END_COMBAT,
                (session, runtimeAccess, command) -> {
                    EncounterSessionCombatService.endCombat(session.state());
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.AWARD_XP,
                (session, runtimeAccess, command) -> {
                    EncounterSessionCombatService.awardXp(session.state(), runtimeAccess);
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.RETURN_TO_BUILDER_AFTER_RESULTS,
                (session, runtimeAccess, command) -> {
                    EncounterSessionCombatService.returnToBuilderAfterResults(session.state());
                    return session.snapshot();
                });
        handlers.put(
                EncounterSessionCommand.Action.MUTATE_HP,
                (session, runtimeAccess, command) -> {
                    EncounterSessionCombatService.mutateHp(
                            session.state(),
                            command.combatantId(),
                            command.amount(),
                            command.healing());
                    return session.snapshot();
                });
        return Map.copyOf(handlers);
    }

    private static SessionCommandHandler handlerFor(EncounterSessionCommand.Action action) {
        return Objects.requireNonNull(HANDLERS.get(action), () -> "Missing session handler for " + action);
    }

    @FunctionalInterface
    private interface SessionCommandHandler {
        EncounterSessionViewState.SnapshotData apply(
                EncounterSession session,
                EncounterSessionRuntimeAccess runtimeAccess,
                EncounterSessionCommand command
        );
    }

}
