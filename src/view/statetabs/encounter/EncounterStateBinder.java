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
        CreatureDetailModel detailModel = runtimeContext.services().require(CreatureDetailModel.class);
        CreaturesApplicationService creatures = runtimeContext.services().require(CreaturesApplicationService.class);
        EncounterStateModel stateModel = runtimeContext.services().require(EncounterStateModel.class);
        EncounterApplicationService encounters = runtimeContext.services().require(EncounterApplicationService.class);
        EncounterStateContributionModel presentationModel = new EncounterStateContributionModel();
        EncounterStateIntentHandler intentHandler = new EncounterStateIntentHandler(
                presentationModel,
                encounters,
                creatures,
                creatureId -> openCreatureDetails(runtimeContext.inspector(), detailModel, creatureId));
        EncounterStateContributionModel.ContentModels contentModels = presentationModel.contentModels();
        EncounterBuilderStateView builderView = new EncounterBuilderStateView();
        EncounterInitiativeStateView initiativeView = new EncounterInitiativeStateView();
        EncounterCombatStateView combatView = new EncounterCombatStateView();
        EncounterResultsStateView resultsView = new EncounterResultsStateView();
        EncounterStateView state = new EncounterStateView(builderView, initiativeView, combatView, resultsView);
        state.bind(contentModels.state());
        builderView.bind(contentModels.builder());
        initiativeView.bind(contentModels.initiative());
        combatView.bind(contentModels.combat());
        resultsView.bind(contentModels.results());
        stateModel.subscribe(presentationModel::apply);
        presentationModel.apply(stateModel.current());
        builderView.onViewInputEvent(intentHandler::consume);
        initiativeView.onViewInputEvent(intentHandler::consume);
        combatView.onViewInputEvent(intentHandler::consume);
        resultsView.onViewInputEvent(intentHandler::consume);
        return new Binding(state);
    }

    private static void openCreatureDetails(
            InspectorSink inspector,
            CreatureDetailModel detailModel,
            long creatureId
    ) {
        if (!hasResolvedId(creatureId)) {
            return;
        }
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
