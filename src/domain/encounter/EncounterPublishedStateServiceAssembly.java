package src.domain.encounter;

import src.domain.encounter.model.plan.repository.EncounterPlanPublishedStateRepository;
import src.domain.encounter.model.session.repository.EncounterSessionPublishedStateRepository;

final class EncounterPublishedStateServiceAssembly {

    private final EncounterSessionPublishedStateServiceAssembly session =
            new EncounterSessionPublishedStateServiceAssembly();
    private final EncounterPlanPublishedStateServiceAssembly plan =
            new EncounterPlanPublishedStateServiceAssembly();

    EncounterSessionPublishedStateRepository sessionRepository() {
        return session;
    }

    EncounterPlanPublishedStateRepository planRepository() {
        return plan;
    }

    src.domain.encounter.published.EncounterStateModel stateModel() {
        return session.stateModel();
    }

    src.domain.encounter.published.EncounterBuilderInputsModel builderInputsModel() {
        return session.builderInputsModel();
    }

    src.domain.encounter.published.EncounterTuningPreviewModel tuningPreviewModel() {
        return session.tuningPreviewModel();
    }

    src.domain.encounter.published.SavedEncounterPlanListModel savedPlansModel() {
        return plan.savedPlansModel();
    }

    src.domain.encounter.published.EncounterPlanBudgetModel planBudgetModel() {
        return plan.planBudgetModel();
    }

}
