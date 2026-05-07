package src.domain.encounter.session.entity;

import static src.domain.encounter.session.value.EncounterSessionValues.*;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import src.domain.encounter.generation.value.EncounterGenerationInputs;
import src.domain.encounter.generation.value.EncounterGenerationRequest;
import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.session.value.EncounterSessionCommand;
import src.domain.encounter.session.value.EncounterSessionSnapshotData;

public final class EncounterSession {

    private static final Map<EncounterSessionCommand.Action, SessionCommandHandler> HANDLERS = createHandlers();

    public interface RuntimeAccess {

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
    private final EncounterSessionCombat combat = new EncounterSessionCombat();

    public EncounterSession apply(EncounterSessionCommand command, RuntimeAccess access) {
        EncounterSessionCommand effective = command == null ? EncounterSessionCommand.refresh() : command;
        handlerFor(effective.action()).apply(this, effective, access);
        return this;
    }

    public EncounterGenerationInputs builderInputs() {
        return builder.builderInputs();
    }

    public EncounterSessionSnapshotData snapshot() {
        CombatProjectionData combatProjection = combat.combatProjection();
        return new EncounterSessionSnapshotData(
                context.mode(),
                context.status(),
                builder.builderState(context),
                combat.initiativeEntries(),
                combatProjection,
                combat.missingCombatPartyMembers(context.activeParty(), combatProjection),
                combat.resultState());
    }

    private void addCreature(RuntimeAccess access, long creatureId) {
        Optional<CreatureDetailData> detail = access.loadCreature(creatureId);
        if (detail.isEmpty()) {
            context.setStatus("Kreatur konnte nicht geladen werden.");
            return;
        }
        CreatureDetailData creature = detail.orElseThrow();
        if (context.isCombatMode()) {
            combat.addReinforcement(creature, context);
            return;
        }
        builder.addCreature(creature, context);
    }

    private static Map<EncounterSessionCommand.Action, SessionCommandHandler> createHandlers() {
        EnumMap<EncounterSessionCommand.Action, SessionCommandHandler> handlers =
                new EnumMap<>(EncounterSessionCommand.Action.class);
        handlers.put(EncounterSessionCommand.Action.REFRESH, (session, command, access) -> session.context.refresh(access));
        handlers.put(EncounterSessionCommand.Action.UPDATE_BUILDER_INPUTS, (session, command, access) ->
                session.builder.updateBuilderInputs(command.builderInputs()));
        handlers.put(EncounterSessionCommand.Action.GENERATE, (session, command, access) ->
                session.builder.generate(access, command.generation(), session.context));
        handlers.put(EncounterSessionCommand.Action.SAVE_CURRENT_PLAN, (session, command, access) ->
                session.builder.saveCurrentPlan(access, session.context));
        handlers.put(EncounterSessionCommand.Action.OPEN_SAVED_PLAN, (session, command, access) ->
                session.builder.openSavedPlan(access, command.planId(), session.context, session.combat));
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
                session.combat.openInitiative(session.context, session.builder.roster()));
        handlers.put(EncounterSessionCommand.Action.BACK_TO_BUILDER, (session, command, access) ->
                session.context.enterBuilder("Zurueck zur Encounter-Erstellung."));
        handlers.put(EncounterSessionCommand.Action.CONFIRM_INITIATIVE, (session, command, access) ->
                session.combat.confirmInitiative(command.initiativeInputs(), session.builder.roster(), session.context));
        handlers.put(EncounterSessionCommand.Action.ADVANCE_TURN, (session, command, access) -> session.combat.advanceTurn());
        handlers.put(EncounterSessionCommand.Action.ADJUST_INITIATIVE, (session, command, access) ->
                session.combat.adjustInitiative(command.combatantId(), command.initiative()));
        handlers.put(EncounterSessionCommand.Action.ADD_PARTY_MEMBER_TO_COMBAT, (session, command, access) ->
                session.combat.addPartyMemberToCombat(
                        command.partyMemberId(),
                        command.initiative(),
                        session.context.activeParty(),
                        session.context));
        handlers.put(EncounterSessionCommand.Action.END_COMBAT, (session, command, access) ->
                session.combat.endCombat(session.context.activeParty().size(), !session.context.activeParty().isEmpty(), session.context));
        handlers.put(EncounterSessionCommand.Action.AWARD_XP, (session, command, access) -> session.combat.awardXp(access, session.context));
        handlers.put(EncounterSessionCommand.Action.RETURN_TO_BUILDER_AFTER_RESULTS, (session, command, access) ->
                session.combat.returnToBuilder(session.context));
        handlers.put(EncounterSessionCommand.Action.MUTATE_HP, (session, command, access) ->
                session.combat.mutateHp(command.combatantId(), command.amount(), command.healing()));
        return Map.copyOf(handlers);
    }

    private static SessionCommandHandler handlerFor(EncounterSessionCommand.Action action) {
        return HANDLERS.getOrDefault(action, (session, command, access) -> {
        });
    }

    @FunctionalInterface
    private interface SessionCommandHandler {

        void apply(EncounterSession session, EncounterSessionCommand command, RuntimeAccess access);
    }
}
