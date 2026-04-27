package src.view.statetabs.encounter;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.EnumMap;
import javafx.scene.Node;
import shell.api.InspectorSink;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.LoadCreatureDetailQuery;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.ApplyEncounterSessionCommand;
import src.domain.encounter.published.LoadEncounterSessionQuery;
import src.domain.encounter.published.EncounterSessionModel;
import src.domain.encounter.published.EncounterSessionSnapshot;
import src.view.slotcontent.details.creature.CreatureDetailsInspectorEntry;

final class EncounterStateBinder {

    private static final Map<EncounterStatePresentationModel.Action, ApplyEncounterSessionCommand.Action> ACTIONS =
            buildActions();

    private final ShellRuntimeContext runtimeContext;

    EncounterStateBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        CreaturesApplicationService creatures = runtimeContext.services().require(CreaturesApplicationService.class);
        EncounterApplicationService encounters = runtimeContext.services().require(EncounterApplicationService.class);
        EncounterSessionModel sessionModel = encounters.loadSession(new LoadEncounterSessionQuery());
        EncounterStatePresentationModel presentationModel = new EncounterStatePresentationModel();
        EncounterStateIntentHandler intentHandler = new EncounterStateIntentHandler(presentationModel);
        EncounterStateView state = new EncounterStateView();
        sessionModel.subscribe(presentationModel::apply);
        presentationModel.apply(sessionModel.current());
        bindSessionActions(encounters, intentHandler);
        state.statusTextProperty().bind(presentationModel.statusProperty());
        wireActions(runtimeContext.inspector(), creatures, state, intentHandler);
        wireRendering(state, presentationModel, intentHandler);
        render(state, presentationModel, intentHandler);
        return new Binding(state);
    }

    private static void bindSessionActions(
            EncounterApplicationService encounters,
            EncounterStateIntentHandler intentHandler
    ) {
        intentHandler.onActionRequested(intent -> encounters.applySession(toCommand(intent)));
    }

    private static ApplyEncounterSessionCommand toCommand(EncounterStatePresentationModel.ActionIntent intent) {
        EncounterStatePresentationModel.ActionIntent safeIntent = intent == null
                ? new EncounterStatePresentationModel.ActionIntent(
                        EncounterStatePresentationModel.Action.REFRESH,
                        0L,
                        0L,
                        0,
                        0L,
                        List.of(),
                        "",
                        0,
                        0L,
                        0,
                        false)
                : intent;
        return new ApplyEncounterSessionCommand(
                toAction(safeIntent.action()),
                null,
                EncounterSessionSnapshot.BuilderInputs.empty(),
                safeIntent.creatureId(),
                safeIntent.savedPlanId(),
                safeIntent.delta(),
                safeIntent.undoToken(),
                safeIntent.initiatives(),
                safeIntent.combatantId(),
                safeIntent.initiative(),
                safeIntent.partyMemberId(),
                safeIntent.amount(),
                safeIntent.healing());
    }

    private static ApplyEncounterSessionCommand.Action toAction(EncounterStatePresentationModel.Action action) {
        return ACTIONS.getOrDefault(
                action == null ? EncounterStatePresentationModel.Action.REFRESH : action,
                ApplyEncounterSessionCommand.Action.REFRESH);
    }

    private static Map<EncounterStatePresentationModel.Action, ApplyEncounterSessionCommand.Action> buildActions() {
        Map<EncounterStatePresentationModel.Action, ApplyEncounterSessionCommand.Action> actions =
                new EnumMap<>(EncounterStatePresentationModel.Action.class);
        actions.put(EncounterStatePresentationModel.Action.REFRESH, ApplyEncounterSessionCommand.Action.REFRESH);
        actions.put(EncounterStatePresentationModel.Action.GENERATE, ApplyEncounterSessionCommand.Action.GENERATE);
        actions.put(EncounterStatePresentationModel.Action.SAVE_CURRENT_PLAN, ApplyEncounterSessionCommand.Action.SAVE_CURRENT_PLAN);
        actions.put(EncounterStatePresentationModel.Action.OPEN_SAVED_PLAN, ApplyEncounterSessionCommand.Action.OPEN_SAVED_PLAN);
        actions.put(EncounterStatePresentationModel.Action.CLEAR_GENERATION_HISTORY, ApplyEncounterSessionCommand.Action.CLEAR_GENERATION_HISTORY);
        actions.put(EncounterStatePresentationModel.Action.SHIFT_ALTERNATIVE, ApplyEncounterSessionCommand.Action.SHIFT_ALTERNATIVE);
        actions.put(EncounterStatePresentationModel.Action.ADD_CREATURE, ApplyEncounterSessionCommand.Action.ADD_CREATURE);
        actions.put(EncounterStatePresentationModel.Action.INCREMENT_CREATURE, ApplyEncounterSessionCommand.Action.INCREMENT_CREATURE);
        actions.put(EncounterStatePresentationModel.Action.DECREMENT_CREATURE, ApplyEncounterSessionCommand.Action.DECREMENT_CREATURE);
        actions.put(EncounterStatePresentationModel.Action.REMOVE_CREATURE, ApplyEncounterSessionCommand.Action.REMOVE_CREATURE);
        actions.put(EncounterStatePresentationModel.Action.UNDO_REMOVE, ApplyEncounterSessionCommand.Action.UNDO_REMOVE);
        actions.put(EncounterStatePresentationModel.Action.OPEN_INITIATIVE, ApplyEncounterSessionCommand.Action.OPEN_INITIATIVE);
        actions.put(EncounterStatePresentationModel.Action.BACK_TO_BUILDER, ApplyEncounterSessionCommand.Action.BACK_TO_BUILDER);
        actions.put(EncounterStatePresentationModel.Action.CONFIRM_INITIATIVE, ApplyEncounterSessionCommand.Action.CONFIRM_INITIATIVE);
        actions.put(EncounterStatePresentationModel.Action.ADVANCE_TURN, ApplyEncounterSessionCommand.Action.ADVANCE_TURN);
        actions.put(EncounterStatePresentationModel.Action.SET_INITIATIVE, ApplyEncounterSessionCommand.Action.SET_INITIATIVE);
        actions.put(EncounterStatePresentationModel.Action.ADD_PARTY_MEMBER_TO_COMBAT, ApplyEncounterSessionCommand.Action.ADD_PARTY_MEMBER_TO_COMBAT);
        actions.put(EncounterStatePresentationModel.Action.END_COMBAT, ApplyEncounterSessionCommand.Action.END_COMBAT);
        actions.put(EncounterStatePresentationModel.Action.AWARD_XP, ApplyEncounterSessionCommand.Action.AWARD_XP);
        actions.put(EncounterStatePresentationModel.Action.RETURN_TO_BUILDER_AFTER_RESULTS,
                ApplyEncounterSessionCommand.Action.RETURN_TO_BUILDER_AFTER_RESULTS);
        actions.put(EncounterStatePresentationModel.Action.MUTATE_HP, ApplyEncounterSessionCommand.Action.MUTATE_HP);
        return Map.copyOf(actions);
    }

    private void wireActions(
            InspectorSink inspector,
            CreaturesApplicationService creatures,
            EncounterStateView state,
            EncounterStateIntentHandler intentHandler
    ) {
        state.setOnGenerate(input -> intentHandler.generate());
        state.setOnPreviousAlternative(() -> intentHandler.shiftGeneratedAlternative(-1));
        state.setOnNextAlternative(() -> intentHandler.shiftGeneratedAlternative(1));
        state.setOnSaveEncounter(intentHandler::saveCurrentPlan);
        state.setOnOpenSavedEncounter(intentHandler::openSavedPlan);
        state.setOnClearGenerationHistory(intentHandler::clearGenerationHistory);
        state.setOnRosterIncrement(intentHandler::incrementCreature);
        state.setOnRosterDecrement(intentHandler::decrementCreature);
        state.setOnRosterRemove(intentHandler::removeCreature);
        state.setOnUndoRemove(intentHandler::undoRemove);
        state.setOnOpenCreature(creatureId ->
                inspector.push(CreatureDetailsInspectorEntry.create(
                        creatureId,
                        id -> creatures.loadCreatureDetail(new LoadCreatureDetailQuery(id)))));
        state.setOnStartInitiative(intentHandler::openInitiative);
        state.setOnInitiativeBack(intentHandler::backToBuilder);
        state.setOnInitiativeConfirm(inputs -> intentHandler.confirmInitiative(inputs.stream()
                .map(input -> new EncounterStatePresentationModel.InitiativeEntry(input.id(), input.initiative()))
                .toList()));
        state.setOnNextTurn(intentHandler::nextTurn);
        state.setOnDamage((id, amount) -> intentHandler.mutateHp(id, amount, false));
        state.setOnHeal((id, amount) -> intentHandler.mutateHp(id, amount, true));
        state.setOnSetInitiative(intentHandler::setInitiative);
        state.setOnEndCombat(intentHandler::endCombat);
        state.setOnAwardXp(intentHandler::awardXp);
        state.setOnReturnToBuilder(intentHandler::returnToBuilderAfterResults);
    }

    private void wireRendering(
            EncounterStateView state,
            EncounterStatePresentationModel presentationModel,
            EncounterStateIntentHandler intentHandler
    ) {
        presentationModel.modeProperty().addListener((obs, oldMode, newMode) -> render(state, presentationModel, intentHandler));
        presentationModel.builderStateProperty()
                .addListener((obs, oldState, newState) -> render(state, presentationModel, intentHandler));
        presentationModel.initiativeStateProperty()
                .addListener((obs, oldState, newState) -> render(state, presentationModel, intentHandler));
        presentationModel.combatStateProperty()
                .addListener((obs, oldState, newState) -> render(state, presentationModel, intentHandler));
        presentationModel.resultStateProperty()
                .addListener((obs, oldState, newState) -> render(state, presentationModel, intentHandler));
    }

    private void render(
            EncounterStateView state,
            EncounterStatePresentationModel presentationModel,
            EncounterStateIntentHandler intentHandler
    ) {
        switch (presentationModel.modeProperty().get()) {
            case BUILDER -> state.showBuilder(toBuilderState(presentationModel.builderStateProperty().get()));
            case INITIATIVE -> state.showInitiative(toInitiativeState(presentationModel.initiativeStateProperty().get()));
            case COMBAT -> state.showCombat(
                    toCombatState(
                            presentationModel.combatStateProperty().get(),
                            presentationModel.missingCombatPartyMembers()),
                    intentHandler::addPartyMemberToCombat);
            case RESULTS -> state.showResults(toResultState(presentationModel.resultStateProperty().get()));
        }
    }

    private EncounterStateView.BuilderStateView toBuilderState(
            EncounterStatePresentationModel.BuilderState source
    ) {
        EncounterSessionSnapshot.DifficultySummary difficulty = source.difficulty();
        EncounterStatePresentationModel.BuilderSettings settings = source.settings();
        String partyLabel = "Party: " + source.party().size() + ", Lv "
                + Math.round(source.party().stream().mapToInt(EncounterSessionSnapshot.PartyMember::level)
                .average().orElse(1.0));
        return new EncounterStateView.BuilderStateView(
                partyLabel,
                source.templateLabel(),
                new EncounterStateView.DifficultySummaryView(
                        difficulty.easy(),
                        difficulty.medium(),
                        difficulty.hard(),
                        difficulty.deadly(),
                        difficulty.adjustedXp(),
                        difficulty.difficulty()),
                source.savedPlans().stream()
                        .map(plan -> new EncounterStateView.SavedEncounterPlanView(
                                plan.id(),
                                plan.name(),
                                plan.generatedLabel(),
                                plan.creatureCount()))
                        .toList(),
                new EncounterStateView.BuilderSettingsInput(
                        settings.difficultyLabel(),
                        settings.balanceLevel(),
                        settings.amountValue(),
                        settings.diversityLevel()),
                source.roster().stream()
                        .map(creature -> new EncounterStateView.RosterCardView(
                                creature.creatureId(),
                                creature.name(),
                                creature.cr(),
                                creature.totalXp(),
                                creature.ac(),
                                creature.type(),
                                creature.role(),
                                creature.count()))
                        .toList(),
                source.canStartCombat(),
                source.canPreviousAlternative(),
                source.canNextAlternative(),
                source.canSavePlan(),
                source.canClearGenerationHistory(),
                source.pendingUndo() == null
                        ? null
                        : new EncounterStateView.UndoRemoveView(
                                source.pendingUndo().token(),
                                source.pendingUndo().creature().name()));
    }

    private EncounterStateView.InitiativeStateView toInitiativeState(
            EncounterSessionSnapshot.InitiativeState source
    ) {
        return new EncounterStateView.InitiativeStateView(source.entries().stream()
                .map(entry -> new EncounterStateView.InitiativeEntryView(
                        entry.id(),
                        entry.label(),
                        entry.kind(),
                        entry.initiative()))
                .toList());
    }

    private EncounterStateView.CombatStateView toCombatState(
            EncounterSessionSnapshot.CombatProjection source,
            List<EncounterSessionSnapshot.PartyMember> missingPartyMembers
    ) {
        return new EncounterStateView.CombatStateView(
                source.round(),
                source.status(),
                source.cards().stream()
                        .map(card -> new EncounterStateView.CombatCardView(
                                card.id(),
                                card.name(),
                                card.playerCharacter(),
                                card.active(),
                                card.alive(),
                                card.currentHp(),
                                card.maxHp(),
                                card.armorClass(),
                                card.initiative(),
                                card.count(),
                                card.detail()))
                        .toList(),
                source.allEnemiesDefeated(),
                missingPartyMembers.stream()
                        .map(member -> new EncounterCombatPartyMemberButtonView.Candidate(
                                member.numericId(),
                                member.name(),
                                member.level()))
                        .toList());
    }

    private EncounterStateView.ResultStateView toResultState(EncounterSessionSnapshot.ResultState source) {
        return new EncounterStateView.ResultStateView(
                source.enemies().stream()
                        .map(enemy -> new EncounterStateView.ResultEnemyView(
                                enemy.name(),
                                enemy.status(),
                                enemy.hpLoss(),
                                enemy.xp(),
                                enemy.defeatedByDefault(),
                                enemy.loot()))
                        .toList(),
                source.defeatedCount(),
                source.eligibleXp(),
                source.perPlayerXp(),
                source.goldSummary(),
                source.lootDetail(),
                source.awardStatus(),
                source.xpAwarded(),
                source.canAwardXp(),
                source.partySize());
    }

    private record Binding(Node state) implements ShellBinding {

        @Override
        public String title() {
            return "Encounter";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(ShellSlot.COCKPIT_STATE, state);
        }
    }
}
