package src.view.statetabs.encounter;

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
        EncounterStateView state = new EncounterStateView();
        EncounterStateRenderer renderer = new EncounterStateRenderer(
                state,
                builderView,
                initiativeView,
                combatView,
                resultsView,
                presentationModel);
        stateModel.subscribe(presentationModel::apply);
        presentationModel.apply(stateModel.current());
        bindSessionActions(encounters, intentHandler);
        presentationModel.creatureDetailSelectionProperty().addListener((obs, before, after) -> {
            if (after == null || !EncounterStateInputCopies.hasId(after.longValue())) {
                return;
            }
            openCreatureDetails(runtimeContext.inspector(), creatures, after.longValue());
            presentationModel.clearCreatureDetailSelection();
        });
        builderView.onViewInputEvent(intentHandler::consume);
        initiativeView.onViewInputEvent(intentHandler::consume);
        combatView.onViewInputEvent(intentHandler::consume);
        resultsView.onViewInputEvent(intentHandler::consume);
        wireRendering(renderer, presentationModel);
        renderer.render();
        return new Binding(state);
    }

    private static void bindSessionActions(
            EncounterApplicationService encounters,
            EncounterStateIntentHandler intentHandler
    ) {
        intentHandler.onPublishedEventRequested(event -> encounters.applyState(EncounterStateCommandFactory.fromPublishedEvent(event)));
    }

    private static void openCreatureDetails(
            InspectorSink inspector,
            CreaturesApplicationService creatures,
            long creatureId
    ) {
        if (!EncounterStateInputCopies.hasId(creatureId)) {
            return;
        }
        inspector.push(CreatureDetailsInspectorEntry.create(
                creatureId,
                id -> creatures.loadCreatureDetail(new LoadCreatureDetailQuery(id))));
    }

    private void wireRendering(EncounterStateRenderer renderer, EncounterStateContributionModel presentationModel) {
        presentationModel.modeProperty().addListener((obs, before, after) -> renderer.render());
        presentationModel.builderStateProperty().addListener((obs, before, after) -> renderer.render());
        presentationModel.initiativeStateProperty().addListener((obs, before, after) -> renderer.render());
        presentationModel.combatStateProperty().addListener((obs, before, after) -> renderer.render());
        presentationModel.resultStateProperty().addListener((obs, before, after) -> renderer.render());
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
