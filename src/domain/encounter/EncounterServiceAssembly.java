package src.domain.encounter;

import shell.api.ServiceRegistry;

final class EncounterServiceAssembly {

    private final EncounterPublishedStateServiceAssembly publishedState =
            new EncounterPublishedStateServiceAssembly();

    EncounterApplicationService createApplicationService(ServiceRegistry services) {
        return EncounterApplicationServiceFactoryServiceAssembly.create(services, publishedState);
    }

    src.domain.encounter.published.EncounterStateModel stateModel(ServiceRegistry services) {
        return publishedState.stateModel();
    }

    src.domain.encounter.published.EncounterBuilderInputsModel builderInputsModel(ServiceRegistry services) {
        return publishedState.builderInputsModel();
    }

    src.domain.encounter.published.EncounterTuningPreviewModel tuningPreviewModel(ServiceRegistry services) {
        return publishedState.tuningPreviewModel();
    }

    src.domain.encounter.published.SavedEncounterPlanListModel savedPlansModel(ServiceRegistry services) {
        return publishedState.savedPlansModel();
    }

    src.domain.encounter.published.EncounterPlanBudgetModel planBudgetModel(ServiceRegistry services) {
        return publishedState.planBudgetModel();
    }

}
