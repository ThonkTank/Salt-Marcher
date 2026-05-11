package src.domain.encounter.model.session.model;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import src.domain.encounter.model.generation.model.EncounterGenerationInputs;
import src.domain.encounter.model.generation.model.EncounterGenerationRequest;
import src.domain.encounter.model.plan.model.EncounterPlan;
import src.domain.encounter.model.session.model.CombatRosterBuilder;
import src.domain.encounter.model.session.model.CombatRosterMutation;
import src.domain.encounter.model.session.model.CombatTurn;
import src.domain.encounter.model.session.model.EncounterSessionCommand;
import src.domain.encounter.model.session.model.EncounterSessionSnapshotData;
import src.domain.encounter.model.session.model.EncounterSessionValues.AwardXpOutcome;
import src.domain.encounter.model.session.model.EncounterSessionValues.BudgetData;
import src.domain.encounter.model.session.model.EncounterSessionValues.CombatProjectionData;
import src.domain.encounter.model.session.model.EncounterSessionValues.CreatureDetailData;
import src.domain.encounter.model.session.model.EncounterSessionValues.GenerationResultData;
import src.domain.encounter.model.session.model.EncounterSessionValues.ListPlansOutcome;
import src.domain.encounter.model.session.model.EncounterSessionValues.PartyMemberData;
import src.domain.encounter.model.session.model.EncounterSessionValues.PlanOutcome;

public final class EncounterSession {

    private static final Map<EncounterSessionCommand.Action, SessionCommandHandler> HANDLERS = createHandlers();

    public interface SessionRepository {

        List<PartyMemberData> loadActiveParty();

        Optional<BudgetData> loadBudget();

        GenerationResultData generate(EncounterGenerationRequest request);

        PlanOutcome savePlan(EncounterPlan plan);

        PlanOutcome loadPlan(long planId);

        ListPlansOutcome listPlans();

        Optional<CreatureDetailData> loadCreature(long creatureId);

        AwardXpOutcome awardXp(List<Long> partyMemberIds, int xpPerCharacter);
    }

    private final EncounterSessionContext context = new EncounterSessionContext();
    private final EncounterSessionBuilder builder = new EncounterSessionBuilder();
    private final CombatRoster combatRoster = new CombatRoster();
    private final CombatRosterBuilder combatRosterBuilder = new CombatRosterBuilder();
    private final CombatRosterMutation combatRosterMutations = new CombatRosterMutation();
    private final CombatTurn combatTurns = new CombatTurn();
    private final CombatInitiativeTracker combatInitiative = new CombatInitiativeTracker();
    private final CombatTurnTracker combatTurnTracker = new CombatTurnTracker();
    private final CombatResolutionTracker combatResolution = new CombatResolutionTracker();

    public EncounterSession apply(EncounterSessionCommand command, SessionRepository access) {
        EncounterSessionCommand effective = command == null ? EncounterSessionCommand.refresh() : command;
        handlerFor(effective.action()).apply(this, effective, access);
        return this;
    }

    public EncounterGenerationInputs builderInputs() {
        return builder.builderInputs();
    }

    public EncounterSessionSnapshotData snapshot() {
        CombatProjectionData combatProjection = combatTurnTracker.combatProjection(combatTurns, combatRoster);
        return new EncounterSessionSnapshotData(
                context.mode(),
                context.status(),
                builder.builderState(context),
                combatInitiative.entries(),
                combatProjection,
                CombatSessionSupport.missingCombatPartyMembers(context.activeParty(), combatProjection),
                combatResolution.resultState());
    }

    private void addCreature(SessionRepository access, long creatureId) {
        Optional<CreatureDetailData> detail = access.loadCreature(creatureId);
        if (detail.isEmpty()) {
            context.setStatus("Kreatur konnte nicht geladen werden.");
            return;
        }
        CreatureDetailData creature = detail.orElseThrow();
        if (src.domain.encounter.model.session.model.EncounterSessionValues.Mode.isCombatMode(context.mode())) {
            CombatRosterRuntimeSupport.addReinforcement(
                    creature,
                    context,
                    combatRoster,
                    combatRosterBuilder,
                    combatTurnTracker,
                    combatTurns);
            return;
        }
        builder.addCreature(creature, context);
    }

    private void resetCombatState() {
        CombatSessionLifecycleSupport.reset(combatRoster, combatInitiative, combatTurnTracker, combatResolution);
    }

    private static Map<EncounterSessionCommand.Action, SessionCommandHandler> createHandlers() {
        Map<EncounterSessionCommand.Action, SessionCommandHandler> handlers =
                new EnumMap<>(EncounterSessionCommand.Action.class);
        handlers.put(EncounterSessionCommand.Action.REFRESH, (session, command, access) ->
                session.context.refresh(access, true));
        handlers.put(EncounterSessionCommand.Action.UPDATE_BUILDER_INPUTS, (session, command, access) ->
                session.builder.updateBuilderInputs(command.builderInputs()));
        handlers.put(EncounterSessionCommand.Action.GENERATE, (session, command, access) ->
                session.builder.generate(access, command.generation(), session.context));
        handlers.put(EncounterSessionCommand.Action.SAVE_CURRENT_PLAN, (session, command, access) ->
                session.builder.saveCurrentPlan(access, session.context));
        handlers.put(EncounterSessionCommand.Action.OPEN_SAVED_PLAN, (session, command, access) ->
                session.builder.openSavedPlan(access, command.planId(), session.context, session::resetCombatState));
        handlers.put(EncounterSessionCommand.Action.CLEAR_GENERATION_HISTORY, (session, command, access) ->
                session.builder.clearGenerationHistory(session.context));
        handlers.put(EncounterSessionCommand.Action.SHIFT_ALTERNATIVE, (session, command, access) ->
                session.builder.shiftGeneratedAlternative(command.delta()));
        handlers.put(EncounterSessionCommand.Action.ADD_CREATURE, (session, command, access) ->
                session.addCreature(access, command.creatureId()));
        handlers.put(EncounterSessionCommand.Action.INCREMENT_CREATURE, (session, command, access) ->
                session.builder.incrementCreature(command.creatureId(), session.context));
        handlers.put(EncounterSessionCommand.Action.DECREMENT_CREATURE, (session, command, access) ->
                session.builder.decrementCreature(command.creatureId(), session.context));
        handlers.put(EncounterSessionCommand.Action.REMOVE_CREATURE, (session, command, access) ->
                session.builder.removeCreature(command.creatureId(), session.context));
        handlers.put(EncounterSessionCommand.Action.UNDO_REMOVE, (session, command, access) ->
                session.builder.undoRemove(command.token(), session.context));
        handlers.put(EncounterSessionCommand.Action.OPEN_INITIATIVE, (session, command, access) ->
                session.combatInitiative.open(session.context, session.builder.roster()));
        handlers.put(EncounterSessionCommand.Action.BACK_TO_BUILDER, (session, command, access) ->
                session.context.enterMode(
                        src.domain.encounter.model.session.model.EncounterSessionValues.Mode.BUILDER,
                        "Zurueck zur Encounter-Erstellung."));
        handlers.put(EncounterSessionCommand.Action.CONFIRM_INITIATIVE, (session, command, access) ->
                session.combatInitiative.confirm(
                        command.initiativeInputs(),
                        session.builder.roster(),
                        session.combatRoster,
                        session.combatRosterBuilder,
                        session.combatTurnTracker,
                        session.combatTurns,
                        session.context));
        handlers.put(EncounterSessionCommand.Action.ADVANCE_TURN, (session, command, access) ->
                session.combatTurnTracker.advance(session.combatTurns, session.combatRoster));
        handlers.put(EncounterSessionCommand.Action.ADJUST_INITIATIVE, (session, command, access) ->
                session.combatRosterMutations.updateInitiative(
                        session.combatRoster,
                        session.combatTurns.turnEntry(session.combatRoster.combatants(), command.combatantId()),
                        command.initiative()));
        handlers.put(EncounterSessionCommand.Action.ADD_PARTY_MEMBER_TO_COMBAT, (session, command, access) ->
                CombatRosterRuntimeSupport.addPartyMemberToCombat(
                        command.partyMemberId(),
                        command.initiative(),
                        session.context.activeParty(),
                        session.context,
                        session.combatRoster,
                        session.combatRosterBuilder,
                        session.combatTurnTracker,
                        session.combatTurns));
        handlers.put(EncounterSessionCommand.Action.END_COMBAT, (session, command, access) ->
                CombatSessionLifecycleSupport.endCombat(
                        session.combatRosterMutations,
                        session.combatRoster,
                        session.combatResolution,
                        session.context.activeParty().size(),
                        !session.context.activeParty().isEmpty(),
                        session.context));
        handlers.put(EncounterSessionCommand.Action.AWARD_XP, (session, command, access) ->
                session.combatResolution.awardXp(access, session.context));
        handlers.put(EncounterSessionCommand.Action.RETURN_TO_BUILDER_AFTER_RESULTS, (session, command, access) ->
                CombatSessionLifecycleSupport.returnToBuilder(
                        session.combatRoster,
                        session.combatInitiative,
                        session.combatTurnTracker,
                        session.combatResolution,
                        session.context));
        handlers.put(EncounterSessionCommand.Action.MUTATE_HP, (session, command, access) ->
                CombatSessionLifecycleSupport.mutateHp(
                        command.combatantId(),
                        command.amount(),
                        command.healing(),
                        session.combatRosterMutations,
                        session.combatRoster,
                        session.combatTurns,
                        session.combatTurnTracker));
        return Map.copyOf(handlers);
    }

    private static SessionCommandHandler handlerFor(EncounterSessionCommand.Action action) {
        return HANDLERS.getOrDefault(action, (session, command, access) -> {
        });
    }

    @FunctionalInterface
    private interface SessionCommandHandler {

        void apply(EncounterSession session, EncounterSessionCommand command, SessionRepository access);
    }
}
