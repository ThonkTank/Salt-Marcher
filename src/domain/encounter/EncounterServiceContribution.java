package src.domain.encounter;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.domain.encounter.published.EncounterBuilderInputsModel;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.EncounterStateModel;
import src.domain.encounter.published.EncounterTuningPreviewModel;
import src.domain.encounter.published.SavedEncounterPlanListModel;

public final class EncounterServiceContribution implements ServiceContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public EncounterServiceContribution() {
    }

    @Override
    public void register(ServiceRegistry.Builder services) {
        EncounterServiceAssembly assembly = new EncounterServiceAssembly();
        services.registerFactory(EncounterApplicationService.class, assembly::createApplicationService);
        services.registerFactory(EncounterStateModel.class, assembly::stateModel);
        services.registerFactory(EncounterBuilderInputsModel.class, assembly::builderInputsModel);
        services.registerFactory(EncounterTuningPreviewModel.class, assembly::tuningPreviewModel);
        services.registerFactory(SavedEncounterPlanListModel.class, assembly::savedPlansModel);
        services.registerFactory(EncounterPlanBudgetModel.class, assembly::planBudgetModel);
    }
}
