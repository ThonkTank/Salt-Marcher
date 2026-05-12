package src.data.encounter;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.encounter.repository.ApplicationEncounterCreatureRepository;
import src.data.encounter.repository.ApplicationEncounterTableCandidateRepository;
import src.data.encounter.repository.ApplicationEncounterPartyFactsRepository;
import src.data.encounter.repository.EncounterPublishedStateRepositoryAdapter;
import src.data.encounter.repository.SqliteEncounterPlanRepository;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.model.plan.repository.EncounterPlanRepository;
import src.domain.encounter.published.EncounterBuilderInputsModel;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.EncounterStateModel;
import src.domain.encounter.published.EncounterTuningPreviewModel;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.PartyMutationModel;

public final class EncounterServiceContribution implements ServiceContribution {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public EncounterServiceContribution() {
        // Required by passive service contribution discovery.
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        EncounterPlanRepository repository = new SqliteEncounterPlanRepository();
        EncounterPublishedStateRepositoryAdapter publishedState = new EncounterPublishedStateRepositoryAdapter();
        EncounterApplicationServiceAssembly assembly = new EncounterApplicationServiceAssembly();
        builder.registerFactory(
                EncounterApplicationService.class,
                services -> assembly.create(
                        publishedState,
                        publishedState,
                        repository,
                        new ApplicationEncounterPartyFactsRepository(
                                services.require(PartyApplicationService.class),
                                services.require(ActivePartyModel.class),
                                services.require(ActivePartyCompositionModel.class),
                                services.require(AdventuringDaySummaryModel.class),
                                services.require(PartyMutationModel.class)),
                        new ApplicationEncounterCreatureRepository(),
                        new ApplicationEncounterTableCandidateRepository()));
        builder.register(EncounterStateModel.class, publishedState.stateModel);
        builder.register(EncounterBuilderInputsModel.class, publishedState.builderInputsModel);
        builder.register(EncounterTuningPreviewModel.class, publishedState.tuningPreviewModel);
        builder.register(SavedEncounterPlanListModel.class, publishedState.savedPlansModel);
        builder.register(EncounterPlanBudgetModel.class, publishedState.planBudgetModel);
    }
}
