package src.view.statetabs.encounter;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.EnumMap;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.ApplyEncounterSessionCommand;
import src.domain.encounter.published.LoadEncounterSessionQuery;
import src.domain.encounter.published.EncounterSessionModel;
import src.domain.encounter.published.EncounterSessionSnapshot;

final class EncounterStateBinder {

    private static final Map<EncounterStatePublishedEvent.Action, ApplyEncounterSessionCommand.Action> ACTIONS =
            buildActions();

    private final ShellRuntimeContext runtimeContext;

    EncounterStateBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        EncounterApplicationService encounters = runtimeContext.services().require(EncounterApplicationService.class);
        EncounterSessionModel sessionModel = encounters.loadSession(new LoadEncounterSessionQuery());
        EncounterStateContributionModel presentationModel = new EncounterStateContributionModel();
        EncounterStateIntentHandler intentHandler = new EncounterStateIntentHandler(presentationModel);
        EncounterBuilderStateView builderView = new EncounterBuilderStateView();
        EncounterInitiativeStateView initiativeView = new EncounterInitiativeStateView();
        EncounterCombatStateView combatView = new EncounterCombatStateView();
        EncounterResultsStateView resultsView = new EncounterResultsStateView();
        EncounterStateView state = new EncounterStateView();
        sessionModel.subscribe(presentationModel::apply);
        presentationModel.apply(sessionModel.current());
        bindSessionActions(encounters, intentHandler);
        builderView.onViewInputEvent(intentHandler::consume);
        initiativeView.onViewInputEvent(intentHandler::consume);
        combatView.onViewInputEvent(intentHandler::consume);
        resultsView.onViewInputEvent(intentHandler::consume);
        wireRendering(state, builderView, initiativeView, combatView, resultsView, presentationModel);
        render(state, builderView, initiativeView, combatView, resultsView, presentationModel);
        return new Binding(state);
    }

    private static void bindSessionActions(
            EncounterApplicationService encounters,
            EncounterStateIntentHandler intentHandler
    ) {
        intentHandler.onPublishedEventRequested(intent -> {
            if (intent == null) {
                return;
            }
            encounters.applySession(toCommand(intent));
        });
    }

    private static ApplyEncounterSessionCommand toCommand(EncounterStatePublishedEvent intent) {
        if (intent == null) {
            return new ApplyEncounterSessionCommand(
                    ApplyEncounterSessionCommand.Action.REFRESH,
                    null,
                    EncounterSessionSnapshot.BuilderInputs.empty(),
                    0L,
                    0L,
                    0,
                    0L,
                    List.of(),
                    "",
                    0,
                    0,
                    0,
                    false);
        }
        EncounterStatePublishedEvent safeIntent = intent;
        return new ApplyEncounterSessionCommand(
                toAction(safeIntent.action()),
                null,
                EncounterSessionSnapshot.BuilderInputs.empty(),
                safeIntent.creatureId(),
                safeIntent.savedPlanId(),
                safeIntent.delta(),
                safeIntent.undoToken(),
                safeIntent.initiatives().stream()
                        .map(entry -> new EncounterSessionSnapshot.InitiativeInput(entry.id(), entry.initiative()))
                        .toList(),
                safeIntent.combatantId(),
                safeIntent.initiative(),
                safeIntent.partyMemberId(),
                safeIntent.amount(),
                safeIntent.healing());
    }

    private static ApplyEncounterSessionCommand.Action toAction(EncounterStatePublishedEvent.Action action) {
        ApplyEncounterSessionCommand.Action mappedAction = ACTIONS.get(action);
        return mappedAction == null ? ApplyEncounterSessionCommand.Action.REFRESH : mappedAction;
    }

    private static Map<EncounterStatePublishedEvent.Action, ApplyEncounterSessionCommand.Action> buildActions() {
        Map<EncounterStatePublishedEvent.Action, ApplyEncounterSessionCommand.Action> actions =
                new EnumMap<>(EncounterStatePublishedEvent.Action.class);
        actions.put(EncounterStatePublishedEvent.Action.GENERATE, ApplyEncounterSessionCommand.Action.GENERATE);
        actions.put(EncounterStatePublishedEvent.Action.SAVE_CURRENT_PLAN, ApplyEncounterSessionCommand.Action.SAVE_CURRENT_PLAN);
        actions.put(EncounterStatePublishedEvent.Action.APPLY_SAVED_PLAN, ApplyEncounterSessionCommand.Action.OPEN_SAVED_PLAN);
        actions.put(EncounterStatePublishedEvent.Action.CLEAR_GENERATION_HISTORY, ApplyEncounterSessionCommand.Action.CLEAR_GENERATION_HISTORY);
        actions.put(EncounterStatePublishedEvent.Action.SHIFT_ALTERNATIVE, ApplyEncounterSessionCommand.Action.SHIFT_ALTERNATIVE);
        actions.put(EncounterStatePublishedEvent.Action.ADD_CREATURE, ApplyEncounterSessionCommand.Action.ADD_CREATURE);
        actions.put(EncounterStatePublishedEvent.Action.INCREMENT_CREATURE, ApplyEncounterSessionCommand.Action.INCREMENT_CREATURE);
        actions.put(EncounterStatePublishedEvent.Action.DECREMENT_CREATURE, ApplyEncounterSessionCommand.Action.DECREMENT_CREATURE);
        actions.put(EncounterStatePublishedEvent.Action.REMOVE_CREATURE, ApplyEncounterSessionCommand.Action.REMOVE_CREATURE);
        actions.put(EncounterStatePublishedEvent.Action.UNDO_REMOVE, ApplyEncounterSessionCommand.Action.UNDO_REMOVE);
        actions.put(EncounterStatePublishedEvent.Action.START_INITIATIVE, ApplyEncounterSessionCommand.Action.OPEN_INITIATIVE);
        actions.put(EncounterStatePublishedEvent.Action.BACK_TO_BUILDER, ApplyEncounterSessionCommand.Action.BACK_TO_BUILDER);
        actions.put(EncounterStatePublishedEvent.Action.CONFIRM_INITIATIVE, ApplyEncounterSessionCommand.Action.CONFIRM_INITIATIVE);
        actions.put(EncounterStatePublishedEvent.Action.ADVANCE_TURN, ApplyEncounterSessionCommand.Action.ADVANCE_TURN);
        actions.put(EncounterStatePublishedEvent.Action.SET_INITIATIVE, ApplyEncounterSessionCommand.Action.SET_INITIATIVE);
        actions.put(EncounterStatePublishedEvent.Action.ADD_PARTY_MEMBER_TO_COMBAT, ApplyEncounterSessionCommand.Action.ADD_PARTY_MEMBER_TO_COMBAT);
        actions.put(EncounterStatePublishedEvent.Action.END_COMBAT, ApplyEncounterSessionCommand.Action.END_COMBAT);
        actions.put(EncounterStatePublishedEvent.Action.AWARD_XP, ApplyEncounterSessionCommand.Action.AWARD_XP);
        actions.put(EncounterStatePublishedEvent.Action.RETURN_TO_BUILDER_AFTER_RESULTS,
                ApplyEncounterSessionCommand.Action.RETURN_TO_BUILDER_AFTER_RESULTS);
        actions.put(EncounterStatePublishedEvent.Action.MUTATE_HP, ApplyEncounterSessionCommand.Action.MUTATE_HP);
        return Map.copyOf(actions);
    }

    private void wireRendering(
            EncounterStateView state,
            EncounterBuilderStateView builderView,
            EncounterInitiativeStateView initiativeView,
            EncounterCombatStateView combatView,
            EncounterResultsStateView resultsView,
            EncounterStateContributionModel presentationModel
    ) {
        presentationModel.modeProperty().addListener((obs, oldMode, newMode) ->
                render(state, builderView, initiativeView, combatView, resultsView, presentationModel));
        presentationModel.builderStateProperty()
                .addListener((obs, oldState, newState) ->
                        render(state, builderView, initiativeView, combatView, resultsView, presentationModel));
        presentationModel.initiativeStateProperty()
                .addListener((obs, oldState, newState) ->
                        render(state, builderView, initiativeView, combatView, resultsView, presentationModel));
        presentationModel.combatStateProperty()
                .addListener((obs, oldState, newState) ->
                        render(state, builderView, initiativeView, combatView, resultsView, presentationModel));
        presentationModel.resultStateProperty()
                .addListener((obs, oldState, newState) ->
                        render(state, builderView, initiativeView, combatView, resultsView, presentationModel));
    }

    private void render(
            EncounterStateView state,
            EncounterBuilderStateView builderView,
            EncounterInitiativeStateView initiativeView,
            EncounterCombatStateView combatView,
            EncounterResultsStateView resultsView,
            EncounterStateContributionModel presentationModel
    ) {
        switch (presentationModel.modeProperty().get()) {
            case BUILDER -> {
                builderView.showBuilder(toBuilderState(presentationModel.builderStateProperty().get()));
                state.showContent(builderView);
            }
            case INITIATIVE -> {
                initiativeView.showInitiative(toInitiativeState(presentationModel.initiativeStateProperty().get()));
                state.showContent(initiativeView);
            }
            case COMBAT -> {
                combatView.showCombat(
                        toCombatState(
                                presentationModel.combatStateProperty().get(),
                                presentationModel.missingCombatPartyMembers()));
                state.showContent(combatView);
            }
            case RESULTS -> {
                resultsView.showResults(toResultState(presentationModel.resultStateProperty().get()));
                state.showContent(resultsView);
            }
        }
    }

    private EncounterStateView.BuilderStateView toBuilderState(
            EncounterStateContributionModel.BuilderState source
    ) {
        EncounterSessionSnapshot.DifficultySummary difficulty = source.difficulty();
        EncounterStateContributionModel.BuilderSettings settings = source.settings();
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
                        .map(member -> new EncounterStateView.PartyMemberCandidate(
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
