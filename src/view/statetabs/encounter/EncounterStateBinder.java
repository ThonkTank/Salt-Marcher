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
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.encounter.published.EncounterStateModel;
import src.view.slotcontent.details.creature.CreatureDetailsInspectorEntry;

final class EncounterStateBinder {

    private final ShellRuntimeContext runtimeContext;

    EncounterStateBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        CreaturesApplicationService creatures = runtimeContext.services().require(CreaturesApplicationService.class);
        EncounterApplicationService encounters = runtimeContext.services().require(EncounterApplicationService.class);
        EncounterStateModel stateModel = runtimeContext.services().require(EncounterStateModel.class);
        EncounterStateContributionModel presentationModel = new EncounterStateContributionModel();
        EncounterStateIntentHandler intentHandler = new EncounterStateIntentHandler(presentationModel);
        EncounterBuilderStateView builderView = new EncounterBuilderStateView();
        EncounterInitiativeStateView initiativeView = new EncounterInitiativeStateView();
        EncounterCombatStateView combatView = new EncounterCombatStateView();
        EncounterResultsStateView resultsView = new EncounterResultsStateView();
        EncounterStateView state = new EncounterStateView(builderView, initiativeView, combatView, resultsView);
        stateModel.subscribe(presentationModel::apply);
        presentationModel.apply(stateModel.current());
        bindSessionActions(encounters, intentHandler);
        presentationModel.creatureDetailSelectionProperty().addListener((obs, before, after) -> {
            if (after == null || !hasResolvedId(after.longValue())) {
                return;
            }
            openCreatureDetails(runtimeContext.inspector(), creatures, after.longValue());
            presentationModel.clearCreatureDetailSelection();
        });
        builderView.onViewInputEvent(intentHandler::consume);
        initiativeView.onViewInputEvent(intentHandler::consume);
        combatView.onViewInputEvent(intentHandler::consume);
        resultsView.onViewInputEvent(intentHandler::consume);
        wireRendering(state, presentationModel);
        state.render(presentationModel);
        return new Binding(state);
    }

    private static void bindSessionActions(
            EncounterApplicationService encounters,
            EncounterStateIntentHandler intentHandler
    ) {
        intentHandler.onPublishedEventRequested(event -> encounters.applyState(toCommand(event)));
    }

    private static void openCreatureDetails(
            InspectorSink inspector,
            CreaturesApplicationService creatures,
            long creatureId
    ) {
        if (!hasResolvedId(creatureId)) {
            return;
        }
        inspector.push(CreatureDetailsInspectorEntry.create(
                creatureId,
                id -> creatures.loadCreatureDetail(new LoadCreatureDetailQuery(id))));
    }

    private void wireRendering(EncounterStateView state, EncounterStateContributionModel presentationModel) {
        presentationModel.modeProperty().addListener((obs, before, after) -> state.render(presentationModel));
        presentationModel.builderStateProperty().addListener((obs, before, after) -> state.render(presentationModel));
        presentationModel.initiativeStateProperty().addListener((obs, before, after) -> state.render(presentationModel));
        presentationModel.combatStateProperty().addListener((obs, before, after) -> state.render(presentationModel));
        presentationModel.resultStateProperty().addListener((obs, before, after) -> state.render(presentationModel));
    }

    private static boolean hasResolvedId(long candidate) {
        return candidate > 0L;
    }

    private static ApplyEncounterStateCommand toCommand(EncounterStatePublishedEvent event) {
        if (event == null) {
            return command(ApplyEncounterStateCommand.Action.REFRESH);
        }
        return switch (event.mutation()) {
            case EncounterStatePublishedEvent.GenerateMutation ignored ->
                    command(ApplyEncounterStateCommand.Action.GENERATE);
            case EncounterStatePublishedEvent.ShiftAlternativeMutation shift ->
                    command(ApplyEncounterStateCommand.Action.SHIFT_ALTERNATIVE, shift.alternativeShift());
            case EncounterStatePublishedEvent.SaveCurrentPlanMutation ignored ->
                    command(ApplyEncounterStateCommand.Action.SAVE_CURRENT_PLAN);
            case EncounterStatePublishedEvent.OpenSavedPlanMutation openPlan ->
                    command(ApplyEncounterStateCommand.Action.OPEN_SAVED_PLAN, openPlan.selectedPlanId());
            case EncounterStatePublishedEvent.IncrementCreatureMutation increment ->
                    command(ApplyEncounterStateCommand.Action.INCREMENT_CREATURE, increment.creatureId());
            case EncounterStatePublishedEvent.DecrementCreatureMutation decrement ->
                    command(ApplyEncounterStateCommand.Action.DECREMENT_CREATURE, decrement.creatureId());
            case EncounterStatePublishedEvent.RemoveCreatureMutation removal ->
                    command(ApplyEncounterStateCommand.Action.REMOVE_CREATURE, removal.creatureId());
            case EncounterStatePublishedEvent.UndoRemoveMutation undo ->
                    command(ApplyEncounterStateCommand.Action.UNDO_REMOVE, undo.undoToken());
            case EncounterStatePublishedEvent.ClearGenerationHistoryMutation ignored ->
                    command(ApplyEncounterStateCommand.Action.CLEAR_GENERATION_HISTORY);
            case EncounterStatePublishedEvent.OpenInitiativeMutation ignored ->
                    command(ApplyEncounterStateCommand.Action.OPEN_INITIATIVE);
            case EncounterStatePublishedEvent.BackToBuilderMutation ignored ->
                    command(ApplyEncounterStateCommand.Action.BACK_TO_BUILDER);
            case EncounterStatePublishedEvent.ConfirmInitiativeMutation confirm ->
                    new ApplyEncounterStateCommand(
                            ApplyEncounterStateCommand.Action.CONFIRM_INITIATIVE,
                            0L,
                            0L,
                            0,
                            0L,
                            confirm.initiatives().stream()
                                    .map(entry -> new ApplyEncounterStateCommand.InitiativeValue(
                                            entry.id(),
                                            entry.initiative()))
                                    .toList(),
                            "",
                            0,
                            0L,
                            0,
                            false);
            case EncounterStatePublishedEvent.AdvanceTurnMutation ignored ->
                    command(ApplyEncounterStateCommand.Action.ADVANCE_TURN);
            case EncounterStatePublishedEvent.EndCombatMutation ignored ->
                    command(ApplyEncounterStateCommand.Action.END_COMBAT);
            case EncounterStatePublishedEvent.HpChangeMutation hp ->
                    new ApplyEncounterStateCommand(
                            ApplyEncounterStateCommand.Action.MUTATE_HP,
                            0L,
                            0L,
                            0,
                            0L,
                            List.of(),
                            hp.combatantId(),
                            0,
                            0L,
                            hp.amount(),
                            hp.healing());
            case EncounterStatePublishedEvent.InitiativeEditMutation initiative ->
                    new ApplyEncounterStateCommand(
                            ApplyEncounterStateCommand.Action.ADJUST_INITIATIVE,
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
            case EncounterStatePublishedEvent.PartyMemberJoinMutation partyMember ->
                    new ApplyEncounterStateCommand(
                            ApplyEncounterStateCommand.Action.ADD_PARTY_MEMBER_TO_COMBAT,
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
            case EncounterStatePublishedEvent.AwardXpMutation ignored ->
                    command(ApplyEncounterStateCommand.Action.AWARD_XP);
            case EncounterStatePublishedEvent.ReturnToBuilderMutation ignored ->
                    command(ApplyEncounterStateCommand.Action.RETURN_TO_BUILDER_AFTER_RESULTS);
        };
    }

    private static ApplyEncounterStateCommand command(ApplyEncounterStateCommand.Action action) {
        return new ApplyEncounterStateCommand(
                action,
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

    private static ApplyEncounterStateCommand command(
            ApplyEncounterStateCommand.Action action,
            int delta
    ) {
        return new ApplyEncounterStateCommand(
                action,
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

    private static ApplyEncounterStateCommand command(
            ApplyEncounterStateCommand.Action action,
            long longValue
    ) {
        return switch (action) {
            case OPEN_SAVED_PLAN -> new ApplyEncounterStateCommand(
                    action,
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
                    REMOVE_CREATURE -> new ApplyEncounterStateCommand(
                    action,
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
            case UNDO_REMOVE -> new ApplyEncounterStateCommand(
                    action,
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
