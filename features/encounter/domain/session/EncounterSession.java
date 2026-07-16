package features.encounter.domain.session;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import features.encounter.domain.generation.EncounterGenerationInputs;
import features.encounter.domain.generation.EncounterGenerationRequest;
import features.encounter.domain.plan.EncounterPlan;

public final class EncounterSession {

    private static final String CREATURE_LOAD_FAILURE_STATUS = "Kreatur konnte nicht geladen werden.";
    private static final String PARTY_MEMBER_LOAD_FAILURE_STATUS = "SC konnte nicht geladen werden.";
    private static final String REINFORCEMENT_CREATURE_ROLE = "Reinforcement";
    private static final String RESULTS_READY_STATUS = "Kampfergebnis bereit.";
    private static final String RETURNED_TO_BUILDER_STATUS = "Kampfergebnis geschlossen. Combat Planner bereit.";

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
    private final List<EncounterCreatureData> sceneAllies = new java.util.ArrayList<>();

    public EncounterSession apply(EncounterSessionCommand command, SessionRepository access) {
        EncounterSessionCommand effective = command == null ? EncounterSessionCommand.refresh() : command;
        CommandHandlers.handlerFor(effective.action()).apply(this, effective, access);
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
                context.missingCombatPartyMembers(combatProjection),
                combatResolution.resultState());
    }

    public void reconcileParty(SessionRepository access) {
        var activeTurnId = combatTurnTracker.activeTurnId(combatTurns, combatRoster);
        context.refresh(access);
        if (context.mode() == Mode.INITIATIVE) {
            combatInitiative.reconcileParty(context.activeParty());
        } else if (context.mode() == Mode.COMBAT) {
            combatRoster.reconcilePlayers(context.activeParty(), combatRosterBuilder);
            combatTurnTracker.restore(combatTurns, combatRoster, activeTurnId);
        }
    }

    public void reconcileSceneNpcs(List<SceneNpcData> npcs, SessionRepository access) {
        List<SceneNpcData> values = npcs == null ? List.of() : List.copyOf(npcs);
        List<EncounterCreatureData> hostile = new java.util.ArrayList<>();
        List<EncounterCreatureData> friendly = new java.util.ArrayList<>();
        for (SceneNpcData npc : values) {
            if (!npc.active() || npc.role() == SceneNpcData.Role.NEUTRAL) {
                continue;
            }
            CreatureDetailData detail = access.loadCreature(npc.creatureId()).orElse(null);
            if (detail == null) {
                continue;
            }
            EncounterCreatureData creature = EncounterSessionCreatureRows.worldNpc(detail, npc.worldNpcId());
            if (npc.role() == SceneNpcData.Role.FRIENDLY) {
                friendly.add(creature);
            } else {
                hostile.add(creature);
            }
        }
        sceneAllies.clear();
        sceneAllies.addAll(friendly);
        builder.retainSceneEnemies(hostile.stream().map(EncounterCreatureData::worldNpcId).toList());
        if (context.mode() == Mode.BUILDER) {
            for (EncounterCreatureData creature : hostile) {
                if (!builder.containsWorldNpc(creature.worldNpcId())) {
                    builder.addSceneWorldNpc(creature, context);
                }
            }
        } else if (context.mode() == Mode.INITIATIVE) {
            combatInitiative.open(context, combinedRoster(), sceneAllies);
        } else if (context.mode() == Mode.COMBAT) {
            var activeTurnId = combatTurnTracker.activeTurnId(combatTurns, combatRoster);
            combatRoster.reconcileSceneNpcs(hostile, friendly, combatRosterBuilder);
            combatTurnTracker.restore(combatTurns, combatRoster, activeTurnId);
        }
    }

    private List<EncounterCreatureData> combinedRoster() {
        List<EncounterCreatureData> combined = new java.util.ArrayList<>(builder.roster());
        combined.addAll(sceneAllies);
        return List.copyOf(combined);
    }

    public EncounterSessionMemento memento() {
        EncounterSessionMemento.BuilderSlice slice = builder.memento();
        return new EncounterSessionMemento(
                EncounterSessionMemento.CURRENT_FORMAT_VERSION,
                context.mode(), context.status(), slice.builderInputs(), slice.roster(), slice.pendingUndo(),
                slice.nextUndoToken(), slice.generatedAlternatives(), slice.generatedAdvisories(),
                slice.selectedAlternativeIndex(), slice.generatedAdjustedXp(), slice.generatedDifficulty(),
                slice.generatedTitle(), slice.generationHistoryPresent(), slice.activeSavedPlanId(),
                combatInitiative.entries(), combatRoster.combatants(), combatTurnTracker.currentTurnIndex(),
                combatTurnTracker.round(), combatResolution.resultState());
    }

    public void restore(EncounterSessionMemento memento, SessionRepository access) {
        if (memento == null) {
            apply(EncounterSessionCommand.refresh(), access);
            return;
        }
        context.refresh(access);
        context.restore(memento.mode(), memento.status());
        builder.restore(new EncounterSessionMemento.BuilderSlice(
                memento.builderInputs(), memento.roster(), memento.pendingUndo(), memento.nextUndoToken(),
                memento.generatedAlternatives(), memento.generatedAdvisories(), memento.selectedAlternativeIndex(),
                memento.generatedAdjustedXp(), memento.generatedDifficulty(), memento.generatedTitle(),
                memento.generationHistoryPresent(), memento.activeSavedPlanId()));
        combatInitiative.restore(memento.initiativeEntries());
        combatRoster.replaceAll(memento.combatants());
        combatTurnTracker.restoreState(memento.currentTurnIndex(), memento.round());
        combatResolution.restore(memento.resultState());
    }

    private void addCreature(SessionRepository access, long creatureId, long worldNpcId) {
        Optional<CreatureDetailData> detail = access.loadCreature(creatureId);
        if (detail.isEmpty()) {
            context.setStatus(CREATURE_LOAD_FAILURE_STATUS);
            return;
        }
        CreatureDetailData creature = detail.orElseThrow();
        if (Mode.isCombatMode(context.mode())) {
            var activeTurnId = combatTurnTracker.activeTurnId(combatTurns, combatRoster);
            String displayName = combatRosterBuilder.addReinforcement(
                    combatRoster,
                    creature,
                    worldNpcId,
                    REINFORCEMENT_CREATURE_ROLE,
                    CombatRosterBuilder.defaultMonsterInitiative(creature.initiativeBonus()));
            combatTurnTracker.restore(combatTurns, combatRoster, activeTurnId);
            context.setStatus(displayName + " betritt den laufenden Kampf.");
            return;
        }
        builder.addCreature(creature, worldNpcId, context);
    }

    private void resetCombatState() {
        combatRoster.clear();
        combatInitiative.reset();
        combatTurnTracker.reset();
        combatResolution.reset();
    }

    private void addPartyMemberToCombat(long partyMemberId, int initiative) {
        if (Mode.isNotCombatMode(context.mode())) {
            return;
        }
        PartyMemberData member = null;
        for (PartyMemberData entry : context.activeParty()) {
            if (entry.numericId() == partyMemberId) {
                member = entry;
                break;
            }
        }
        if (member == null) {
            context.setStatus(PARTY_MEMBER_LOAD_FAILURE_STATUS);
            return;
        }
        var activeTurnId = combatTurnTracker.activeTurnId(combatTurns, combatRoster);
        boolean added = combatRosterBuilder.addPlayerToRunningCombat(
                combatRoster,
                member.id(),
                member.name(),
                initiative);
        combatTurnTracker.restore(combatTurns, combatRoster, activeTurnId);
        context.setStatus(added
                ? member.name() + " betritt den laufenden Kampf."
                : member.name() + " ist bereits im Kampf.");
    }

    private void endCombat() {
        combatResolution.endCombat(
                combatRosterMutations,
                combatRoster,
                context.activeParty().size(),
                !context.activeParty().isEmpty());
        context.enterMode(Mode.RESULTS, RESULTS_READY_STATUS);
    }

    private void returnToBuilderAfterResults() {
        resetCombatState();
        context.enterMode(Mode.BUILDER, RETURNED_TO_BUILDER_STATUS);
    }

    private void mutateHp(EncounterSessionCommand command) {
        if (!combatRosterMutations.mutateHp(
                combatRoster,
                combatTurns.turnEntry(combatRoster.combatants(), command.combatantId()),
                Math.max(0, command.amount()),
                command.healing())) {
            return;
        }
        combatTurnTracker.restore(
                combatTurns,
                combatRoster,
                combatTurnTracker.activeTurnId(combatTurns, combatRoster));
    }

    private static final class CommandHandlers {

        private static final Map<EncounterSessionCommand.Action, SessionCommandHandler> HANDLERS = createHandlers();

        private static SessionCommandHandler handlerFor(EncounterSessionCommand.Action action) {
            return HANDLERS.getOrDefault(action, (session, command, access) -> {
            });
        }

        private static Map<EncounterSessionCommand.Action, SessionCommandHandler> createHandlers() {
            Map<EncounterSessionCommand.Action, SessionCommandHandler> handlers =
                    new EnumMap<>(EncounterSessionCommand.Action.class);
            handlers.put(EncounterSessionCommand.Action.REFRESH, (session, command, access) ->
                    session.context.refresh(access));
            handlers.put(EncounterSessionCommand.Action.UPDATE_BUILDER_INPUTS, (session, command, access) ->
                    session.builder.updateBuilderInputs(command.builderInputs()));
            handlers.put(EncounterSessionCommand.Action.GENERATE, (session, command, access) ->
                    session.builder.generate(access, command.generation(), session.context));
            handlers.put(EncounterSessionCommand.Action.SAVE_CURRENT_PLAN, (session, command, access) ->
                    session.builder.applySavedPlanCommand(command, access, session.context));
            handlers.put(EncounterSessionCommand.Action.OPEN_SAVED_PLAN, (session, command, access) -> {
                if (session.builder.applySavedPlanCommand(command, access, session.context)) {
                    session.resetCombatState();
                }
            });
            handlers.put(EncounterSessionCommand.Action.CLEAR_GENERATION_HISTORY, (session, command, access) ->
                    session.builder.applyGenerationCommand(command, session.context));
            handlers.put(EncounterSessionCommand.Action.SHIFT_ALTERNATIVE, (session, command, access) ->
                    session.builder.applyGenerationCommand(command, session.context));
            handlers.put(EncounterSessionCommand.Action.ADD_CREATURE, (session, command, access) ->
                    session.addCreature(access, command.creatureId(), command.worldNpcId()));
            handlers.put(EncounterSessionCommand.Action.INCREMENT_CREATURE, (session, command, access) ->
                    session.builder.mutateCreature(command, session.context));
            handlers.put(EncounterSessionCommand.Action.DECREMENT_CREATURE, (session, command, access) ->
                    session.builder.mutateCreature(command, session.context));
            handlers.put(EncounterSessionCommand.Action.REMOVE_CREATURE, (session, command, access) ->
                    session.builder.mutateCreature(command, session.context));
            handlers.put(EncounterSessionCommand.Action.UNDO_REMOVE, (session, command, access) ->
                    session.builder.mutateCreature(command, session.context));
            handlers.put(EncounterSessionCommand.Action.OPEN_INITIATIVE, (session, command, access) ->
                    session.combatInitiative.open(session.context, session.builder.roster(), session.sceneAllies));
            handlers.put(EncounterSessionCommand.Action.BACK_TO_BUILDER, (session, command, access) ->
                    session.context.enterMode(
                            Mode.BUILDER,
                            "Zurueck zur Encounter-Erstellung."));
            handlers.put(EncounterSessionCommand.Action.CONFIRM_INITIATIVE, (session, command, access) ->
                    session.combatInitiative.confirm(
                            command.initiativeInputs(),
                            session.combinedRoster(),
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
                    session.addPartyMemberToCombat(
                            command.partyMemberId(),
                            command.initiative()));
            handlers.put(EncounterSessionCommand.Action.END_COMBAT, (session, command, access) ->
                    session.endCombat());
            handlers.put(EncounterSessionCommand.Action.AWARD_XP, (session, command, access) ->
                    session.combatResolution.awardXp(access, session.context));
            handlers.put(EncounterSessionCommand.Action.RETURN_TO_BUILDER_AFTER_RESULTS, (session, command, access) ->
                    session.returnToBuilderAfterResults());
            handlers.put(EncounterSessionCommand.Action.MUTATE_HP, (session, command, access) ->
                    session.mutateHp(command));
            return Map.copyOf(handlers);
        }
    }

    @FunctionalInterface
    private interface SessionCommandHandler {

        void apply(EncounterSession session, EncounterSessionCommand command, SessionRepository access);
    }
}
