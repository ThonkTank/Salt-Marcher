package src.view.statetabs.encounter;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.InspectorSink;
import shell.api.InspectorEntrySpec;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.SelectCreatureDetailCommand;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterStateModel;
import src.view.slotcontent.details.creature.CreatureDetailsContentModel;
import src.view.slotcontent.details.creature.CreatureDetailsView;

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
        EncounterStateIntentHandler intentHandler = new EncounterStateIntentHandler(presentationModel, encounters);
        EncounterBuilderStateView builderView = new EncounterBuilderStateView();
        EncounterInitiativeStateView initiativeView = new EncounterInitiativeStateView();
        EncounterCombatStateView combatView = new EncounterCombatStateView();
        EncounterResultsStateView resultsView = new EncounterResultsStateView();
        EncounterStateView state = new EncounterStateView(builderView, initiativeView, combatView, resultsView);
        stateModel.subscribe(presentationModel::apply);
        presentationModel.apply(stateModel.current());
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
        inspector.push(new InspectorEntrySpec(
                "Creature",
                "creature:" + creatureId,
                () -> creatureDetailsContent(detailModel.current()),
                null));
    }

    private static Node creatureDetailsContent(CreatureDetailResult detailResult) {
        CreatureDetailsView detailView = new CreatureDetailsView();
        CreatureDetailsContentModel contentModel = new CreatureDetailsContentModel(detailResult);
        detailView.bind(contentModel);
        contentModel.load();
        return detailView;
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
