package src.view.statetabs.encounter;

import java.util.Objects;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.worldplanner.WorldPlannerApplicationService;

final class EncounterStateViewModel {

    private final EncounterStateContributionModel presentationModel = new EncounterStateContributionModel();
    private final EncounterStateIntentHandler intentHandler;

    EncounterStateViewModel(
            EncounterApplicationService encounters,
            WorldPlannerApplicationService worldPlanner,
            CreaturesApplicationService creatures,
            EncounterStateIntentHandler.CreatureDetailSink creatureDetailSink
    ) {
        intentHandler = new EncounterStateIntentHandler(
                presentationModel,
                Objects.requireNonNull(encounters, "encounters"),
                worldPlanner,
                Objects.requireNonNull(creatures, "creatures"),
                creatureDetailSink);
    }

    EncounterStateContributionModel.ContentModels contentModels() {
        return presentationModel.contentModels();
    }

    void apply(EncounterStateSnapshot snapshot) {
        presentationModel.apply(snapshot);
    }

    void handleBuilderInput(EncounterBuilderStateViewInputEvent event) {
        intentHandler.consume(event);
    }

    void handleInitiativeInput(EncounterInitiativeStateViewInputEvent event) {
        intentHandler.consume(event);
    }

    void handleCombatInput(EncounterCombatStateViewInputEvent event) {
        intentHandler.consume(event);
    }

    void handleResultsInput(EncounterResultsStateViewInputEvent event) {
        intentHandler.consume(event);
    }
}
