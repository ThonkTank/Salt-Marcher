package src.view.statetabs.encounter;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.InspectorSink;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.LoadCreatureDetailQuery;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.ApplyEncounterSessionCommand;
import src.domain.encounter.published.EncounterSessionModel;
import src.domain.encounter.published.EncounterSessionSnapshot;
import src.domain.encounter.published.LoadEncounterSessionQuery;
import src.view.slotcontent.details.creature.CreatureDetailsInspectorEntry;

final class EncounterStateBinder {

    private final ShellRuntimeContext runtimeContext;

    EncounterStateBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        CreaturesApplicationService creatures = runtimeContext.services().require(CreaturesApplicationService.class);
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
        presentationModel.creatureDetailSelectionProperty().addListener((obs, before, after) -> {
            if (after == null || after.longValue() <= 0L) {
                return;
            }
            openCreatureDetails(runtimeContext.inspector(), creatures, after.longValue());
            presentationModel.clearCreatureDetailSelection();
        });
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
        intentHandler.onPublishedEventRequested(event -> encounters.applySession(toCommand(event)));
    }

    private static void openCreatureDetails(
            InspectorSink inspector,
            CreaturesApplicationService creatures,
            long creatureId
    ) {
        if (creatureId <= 0L) {
            return;
        }
        inspector.push(CreatureDetailsInspectorEntry.create(
                creatureId,
                id -> creatures.loadCreatureDetail(new LoadCreatureDetailQuery(id))));
    }

    private static ApplyEncounterSessionCommand toCommand(EncounterStatePublishedEvent event) {
        if (event == null) {
            return refreshCommand();
        }
        if (event.mutation() instanceof EncounterStatePublishedEvent.BuilderMutation builderMutation) {
            return toBuilderCommand(builderMutation);
        }
        if (event.mutation() instanceof EncounterStatePublishedEvent.InitiativeSubmission initiativeSubmission) {
            return toInitiativeCommand(initiativeSubmission);
        }
        if (event.mutation() instanceof EncounterStatePublishedEvent.CombatMutation combatMutation) {
            return toCombatCommand(combatMutation);
        }
        if (event.mutation() instanceof EncounterStatePublishedEvent.ResultMutation resultMutation) {
            return toResultCommand(resultMutation);
        }
        return refreshCommand();
    }

    private static ApplyEncounterSessionCommand toBuilderCommand(EncounterStatePublishedEvent.BuilderMutation mutation) {
        if (mutation.change() instanceof EncounterStatePublishedEvent.GeneratorMutation generator) {
            if (generator.generate()) {
                return command(ApplyEncounterSessionCommand.Action.GENERATE);
            }
            return command(ApplyEncounterSessionCommand.Action.SHIFT_ALTERNATIVE, generator.alternativeShift());
        }
        if (mutation.change() instanceof EncounterStatePublishedEvent.PlanMutation plan) {
            if (plan.saveCurrentPlan()) {
                return command(ApplyEncounterSessionCommand.Action.SAVE_CURRENT_PLAN);
            }
            return command(ApplyEncounterSessionCommand.Action.OPEN_SAVED_PLAN, plan.selectedPlanId());
        }
        if (mutation.change() instanceof EncounterStatePublishedEvent.RosterMutation roster) {
            if (roster.removeCreature()) {
                return command(ApplyEncounterSessionCommand.Action.REMOVE_CREATURE, roster.creatureId());
            }
            if (roster.delta() > 0) {
                return command(ApplyEncounterSessionCommand.Action.INCREMENT_CREATURE, roster.creatureId());
            }
            return command(ApplyEncounterSessionCommand.Action.DECREMENT_CREATURE, roster.creatureId());
        }
        if (mutation.change() instanceof EncounterStatePublishedEvent.UndoMutation undoMutation) {
            return command(ApplyEncounterSessionCommand.Action.UNDO_REMOVE, undoMutation.token());
        }
        if (mutation.change() instanceof EncounterStatePublishedEvent.BuilderActionMutation builderAction) {
            if (builderAction.clearHistory()) {
                return command(ApplyEncounterSessionCommand.Action.CLEAR_GENERATION_HISTORY);
            }
            return command(ApplyEncounterSessionCommand.Action.OPEN_INITIATIVE);
        }
        return refreshCommand();
    }

    private static ApplyEncounterSessionCommand toInitiativeCommand(EncounterStatePublishedEvent.InitiativeSubmission submission) {
        if (submission.backToBuilder()) {
            return command(ApplyEncounterSessionCommand.Action.BACK_TO_BUILDER);
        }
        return new ApplyEncounterSessionCommand(
                ApplyEncounterSessionCommand.Action.CONFIRM_INITIATIVE,
                null,
                EncounterSessionSnapshot.BuilderInputs.empty(),
                0L,
                0L,
                0,
                0L,
                submission.initiatives().stream()
                        .map(entry -> new EncounterSessionSnapshot.InitiativeInput(entry.id(), entry.initiative()))
                        .toList(),
                "",
                0,
                0L,
                0,
                false);
    }

    private static ApplyEncounterSessionCommand toCombatCommand(EncounterStatePublishedEvent.CombatMutation mutation) {
        if (mutation.change() instanceof EncounterStatePublishedEvent.AdvanceTurnMutation) {
            return command(ApplyEncounterSessionCommand.Action.ADVANCE_TURN);
        }
        if (mutation.change() instanceof EncounterStatePublishedEvent.HpMutation hp) {
            return new ApplyEncounterSessionCommand(
                    ApplyEncounterSessionCommand.Action.MUTATE_HP,
                    null,
                    EncounterSessionSnapshot.BuilderInputs.empty(),
                    0L,
                    0L,
                    hp.amount(),
                    0L,
                    List.of(),
                    hp.combatantId(),
                    0,
                    0L,
                    hp.amount(),
                    hp.healing());
        }
        if (mutation.change() instanceof EncounterStatePublishedEvent.InitiativeAdjustment initiative) {
            return new ApplyEncounterSessionCommand(
                    ApplyEncounterSessionCommand.Action.SET_INITIATIVE,
                    null,
                    EncounterSessionSnapshot.BuilderInputs.empty(),
                    0L,
                    0L,
                    0,
                    0L,
                    List.of(),
                    initiative.combatantId(),
                    initiative.initiativeValue(),
                    0L,
                    0,
                    false);
        }
        if (mutation.change() instanceof EncounterStatePublishedEvent.PartyMemberAddition partyMember) {
            return new ApplyEncounterSessionCommand(
                    ApplyEncounterSessionCommand.Action.ADD_PARTY_MEMBER_TO_COMBAT,
                    null,
                    EncounterSessionSnapshot.BuilderInputs.empty(),
                    0L,
                    0L,
                    0,
                    0L,
                    List.of(),
                    "",
                    partyMember.initiativeValue(),
                    partyMember.partyMemberId(),
                    0,
                    false);
        }
        if (mutation.change() instanceof EncounterStatePublishedEvent.EndCombatMutation) {
            return command(ApplyEncounterSessionCommand.Action.END_COMBAT);
        }
        return refreshCommand();
    }

    private static ApplyEncounterSessionCommand toResultCommand(EncounterStatePublishedEvent.ResultMutation mutation) {
        if (mutation.change() instanceof EncounterStatePublishedEvent.AwardXpMutation) {
            return command(ApplyEncounterSessionCommand.Action.AWARD_XP);
        }
        if (mutation.change() instanceof EncounterStatePublishedEvent.ReturnToBuilderMutation) {
            return command(ApplyEncounterSessionCommand.Action.RETURN_TO_BUILDER_AFTER_RESULTS);
        }
        return refreshCommand();
    }

    private void wireRendering(
            EncounterStateView state,
            EncounterBuilderStateView builderView,
            EncounterInitiativeStateView initiativeView,
            EncounterCombatStateView combatView,
            EncounterResultsStateView resultsView,
            EncounterStateContributionModel presentationModel
    ) {
        presentationModel.modeProperty().addListener((obs, before, after) ->
                render(state, builderView, initiativeView, combatView, resultsView, presentationModel));
        presentationModel.builderStateProperty().addListener((obs, before, after) ->
                render(state, builderView, initiativeView, combatView, resultsView, presentationModel));
        presentationModel.initiativeStateProperty().addListener((obs, before, after) ->
                render(state, builderView, initiativeView, combatView, resultsView, presentationModel));
        presentationModel.combatStateProperty().addListener((obs, before, after) ->
                render(state, builderView, initiativeView, combatView, resultsView, presentationModel));
        presentationModel.resultStateProperty().addListener((obs, before, after) ->
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
                builderView.showBuilder(presentationModel.builderStateProperty().get());
                state.showContent(builderView);
            }
            case INITIATIVE -> {
                initiativeView.showInitiative(presentationModel.initiativeStateProperty().get());
                state.showContent(initiativeView);
            }
            case COMBAT -> {
                combatView.showCombat(presentationModel.combatStateProperty().get());
                state.showContent(combatView);
            }
            case RESULTS -> {
                resultsView.showResults(presentationModel.resultStateProperty().get());
                state.showContent(resultsView);
            }
        }
    }

    private static ApplyEncounterSessionCommand refreshCommand() {
        return command(ApplyEncounterSessionCommand.Action.REFRESH);
    }

    private static ApplyEncounterSessionCommand command(ApplyEncounterSessionCommand.Action action) {
        return new ApplyEncounterSessionCommand(
                action,
                null,
                EncounterSessionSnapshot.BuilderInputs.empty(),
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

    private static ApplyEncounterSessionCommand command(
            ApplyEncounterSessionCommand.Action action,
            int delta
    ) {
        return new ApplyEncounterSessionCommand(
                action,
                null,
                EncounterSessionSnapshot.BuilderInputs.empty(),
                0L,
                0L,
                delta,
                0L,
                List.of(),
                "",
                0,
                0L,
                0,
                false);
    }

    private static ApplyEncounterSessionCommand command(
            ApplyEncounterSessionCommand.Action action,
            long longValue
    ) {
        return switch (action) {
            case OPEN_SAVED_PLAN -> new ApplyEncounterSessionCommand(
                    action,
                    null,
                    EncounterSessionSnapshot.BuilderInputs.empty(),
                    0L,
                    longValue,
                    0,
                    0L,
                    List.of(),
                    "",
                    0,
                    0L,
                    0,
                    false);
            case INCREMENT_CREATURE,
                    DECREMENT_CREATURE,
                    REMOVE_CREATURE -> new ApplyEncounterSessionCommand(
                    action,
                    null,
                    EncounterSessionSnapshot.BuilderInputs.empty(),
                    longValue,
                    0L,
                    0,
                    0L,
                    List.of(),
                    "",
                    0,
                    0L,
                    0,
                    false);
            case UNDO_REMOVE -> new ApplyEncounterSessionCommand(
                    action,
                    null,
                    EncounterSessionSnapshot.BuilderInputs.empty(),
                    0L,
                    0L,
                    0,
                    longValue,
                    List.of(),
                    "",
                    0,
                    0L,
                    0,
                    false);
            default -> command(action);
        };
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
