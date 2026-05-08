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
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.SelectCreatureDetailCommand;
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
        CreatureDetailModel detailModel = runtimeContext.services().require(CreatureDetailModel.class);
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
            openCreatureDetails(runtimeContext.inspector(), creatures, detailModel, after.longValue());
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
            CreatureDetailModel detailModel,
            long creatureId
    ) {
        if (!hasResolvedId(creatureId)) {
            return;
        }
        creatures.selectCreatureDetail(new SelectCreatureDetailCommand(creatureId));
        inspector.push(CreatureDetailsInspectorEntry.create(
                creatureId,
                detailModel.current()));
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
            case EncounterStatePublishedEvent.BuilderMutation builder -> toBuilderCommand(builder);
            case EncounterStatePublishedEvent.InitiativeMutation initiative -> toInitiativeCommand(initiative);
            case EncounterStatePublishedEvent.CombatMutation combat -> toCombatCommand(combat);
            case EncounterStatePublishedEvent.ResultMutation result -> toResultCommand(result);
        };
    }

    private static ApplyEncounterStateCommand toBuilderCommand(EncounterStatePublishedEvent.BuilderMutation builder) {
        return switch (builder.change()) {
            case GENERATE -> command(ApplyEncounterStateCommand.Action.GENERATE);
            case SHIFT_ALTERNATIVE -> command(ApplyEncounterStateCommand.Action.SHIFT_ALTERNATIVE, builder.delta());
            case SAVE_CURRENT_PLAN -> command(ApplyEncounterStateCommand.Action.SAVE_CURRENT_PLAN);
            case OPEN_SAVED_PLAN -> command(ApplyEncounterStateCommand.Action.OPEN_SAVED_PLAN, builder.referenceId());
            case INCREMENT_CREATURE -> command(ApplyEncounterStateCommand.Action.INCREMENT_CREATURE, builder.referenceId());
            case DECREMENT_CREATURE -> command(ApplyEncounterStateCommand.Action.DECREMENT_CREATURE, builder.referenceId());
            case REMOVE_CREATURE -> command(ApplyEncounterStateCommand.Action.REMOVE_CREATURE, builder.referenceId());
            case UNDO_REMOVE -> command(ApplyEncounterStateCommand.Action.UNDO_REMOVE, builder.referenceId());
            case CLEAR_GENERATION_HISTORY -> command(ApplyEncounterStateCommand.Action.CLEAR_GENERATION_HISTORY);
            case OPEN_INITIATIVE -> command(ApplyEncounterStateCommand.Action.OPEN_INITIATIVE);
        };
    }

    private static ApplyEncounterStateCommand toInitiativeCommand(EncounterStatePublishedEvent.InitiativeMutation initiative) {
        if (initiative.returnToBuilder()) {
            return command(ApplyEncounterStateCommand.Action.BACK_TO_BUILDER);
        }
        return new ApplyEncounterStateCommand(
                ApplyEncounterStateCommand.Action.CONFIRM_INITIATIVE,
                0L,
                0L,
                0,
                0L,
                initiative.submissions().stream()
                        .map(entry -> new ApplyEncounterStateCommand.InitiativeValue(
                                entry.combatantId(),
                                entry.rolledInitiative()))
                        .toList(),
                "",
                0,
                0L,
                0,
                false);
    }

    private static ApplyEncounterStateCommand toCombatCommand(EncounterStatePublishedEvent.CombatMutation combat) {
        return switch (combat.change()) {
            case ADVANCE_TURN -> command(ApplyEncounterStateCommand.Action.ADVANCE_TURN);
            case END_COMBAT -> command(ApplyEncounterStateCommand.Action.END_COMBAT);
            case MUTATE_HP -> new ApplyEncounterStateCommand(
                    ApplyEncounterStateCommand.Action.MUTATE_HP,
                    0L,
                    0L,
                    0,
                    0L,
                    List.of(),
                    combat.combatantId(),
                    0,
                    0L,
                    combat.numericValue(),
                    combat.healing());
            case ADJUST_INITIATIVE -> new ApplyEncounterStateCommand(
                    ApplyEncounterStateCommand.Action.ADJUST_INITIATIVE,
                    0L,
                    0L,
                    0,
                    0L,
                    List.of(),
                    combat.combatantId(),
                    combat.numericValue(),
                    0L,
                    0,
                    false);
            case ADD_PARTY_MEMBER_TO_COMBAT -> new ApplyEncounterStateCommand(
                    ApplyEncounterStateCommand.Action.ADD_PARTY_MEMBER_TO_COMBAT,
                    0L,
                    0L,
                    0,
                    0L,
                    List.of(),
                    "",
                    combat.numericValue(),
                    combat.partyMemberId(),
                    0,
                    false);
        };
    }

    private static ApplyEncounterStateCommand toResultCommand(EncounterStatePublishedEvent.ResultMutation result) {
        return result.awardExperience()
                ? command(ApplyEncounterStateCommand.Action.AWARD_XP)
                : command(ApplyEncounterStateCommand.Action.RETURN_TO_BUILDER_AFTER_RESULTS);
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
