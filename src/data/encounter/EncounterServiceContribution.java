package src.data.encounter;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.encounter.repository.ApplicationEncounterCreatureRepository;
import src.data.encounter.repository.ApplicationEncounterTableCandidateRepository;
import src.data.encounter.repository.ApplicationEncounterPartyFactsRepository;
import src.data.encounter.repository.EncounterPublishedStateRepositoryAdapter;
import src.data.encounter.repository.SqliteEncounterPlanRepository;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.application.ApplyEncounterSessionUseCase;
import src.domain.encounter.application.ApplyEncounterStateUseCase;
import src.domain.encounter.application.EncounterGenerationUseCase;
import src.domain.encounter.application.ListSavedEncounterPlansUseCase;
import src.domain.encounter.application.LoadEncounterBudgetUseCase;
import src.domain.encounter.application.LoadEncounterPlanBudgetUseCase;
import src.domain.encounter.application.LoadSavedEncounterPlanUseCase;
import src.domain.encounter.application.PublishEncounterPlanBudgetUseCase;
import src.domain.encounter.application.PublishEncounterSavedPlansUseCase;
import src.domain.encounter.application.PublishEncounterSessionUseCase;
import src.domain.encounter.application.SaveEncounterPlanUseCase;
import src.domain.encounter.application.UpdateEncounterBuilderInputsUseCase;
import src.domain.encounter.model.plan.repository.EncounterPlanPublishedStateRepository;
import src.domain.encounter.model.plan.repository.EncounterPlanRepository;
import src.domain.encounter.model.reference.repository.EncounterCreatureRepository;
import src.domain.encounter.model.reference.repository.EncounterTableCandidateRepository;
import src.domain.encounter.model.session.repository.EncounterPartyFactsRepository;
import src.domain.encounter.model.session.repository.EncounterSessionPublishedStateRepository;
import src.domain.encounter.model.session.repository.EncounterSessionRepository;
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

    private static final long INITIAL_PLAN_ID = 0L;

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public EncounterServiceContribution() {
        // Required by passive service contribution discovery.
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        EncounterPlanRepository repository = new SqliteEncounterPlanRepository();
        EncounterPublishedStateRepositoryAdapter publishedState = new EncounterPublishedStateRepositoryAdapter();
        builder.registerFactory(
                EncounterApplicationService.class,
                services -> createApplicationService(
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

    private static EncounterApplicationService createApplicationService(
            EncounterPlanPublishedStateRepository planPublishedStateRepository,
            EncounterSessionPublishedStateRepository sessionPublishedStateRepository,
            EncounterPlanRepository encounterPlans,
            EncounterPartyFactsRepository party,
            EncounterCreatureRepository creatures,
            EncounterTableCandidateRepository encounterTables
    ) {
        LoadEncounterBudgetUseCase loadBudgetUseCase = new LoadEncounterBudgetUseCase(party);
        SaveEncounterPlanUseCase savePlanUseCase = new SaveEncounterPlanUseCase(encounterPlans);
        LoadSavedEncounterPlanUseCase loadSavedPlanUseCase = new LoadSavedEncounterPlanUseCase(encounterPlans);
        ListSavedEncounterPlansUseCase listSavedPlansUseCase = new ListSavedEncounterPlansUseCase(encounterPlans);
        LoadEncounterPlanBudgetUseCase loadPlanBudgetUseCase =
                new LoadEncounterPlanBudgetUseCase(encounterPlans, party, creatures);
        ApplyEncounterSessionUseCase applySessionUseCase = createApplySessionUseCase(
                party,
                creatures,
                encounterTables,
                savePlanUseCase,
                loadSavedPlanUseCase,
                listSavedPlansUseCase,
                loadBudgetUseCase);
        PublishEncounterSessionUseCase publishSessionUseCase =
                new PublishEncounterSessionUseCase(sessionPublishedStateRepository, loadBudgetUseCase);
        PublishEncounterSavedPlansUseCase publishSavedPlansUseCase =
                new PublishEncounterSavedPlansUseCase(planPublishedStateRepository, listSavedPlansUseCase);
        PublishEncounterPlanBudgetUseCase publishPlanBudgetUseCase =
                new PublishEncounterPlanBudgetUseCase(planPublishedStateRepository, loadPlanBudgetUseCase);
        publishSessionUseCase.execute(applySessionUseCase.session());
        publishSavedPlansUseCase.execute();
        publishPlanBudgetUseCase.execute(INITIAL_PLAN_ID);
        return new EncounterApplicationService(
                new ApplyEncounterStateUseCase(applySessionUseCase, publishSessionUseCase, publishSavedPlansUseCase),
                new UpdateEncounterBuilderInputsUseCase(applySessionUseCase, publishSessionUseCase),
                publishPlanBudgetUseCase);
    }

    private static ApplyEncounterSessionUseCase createApplySessionUseCase(
            EncounterPartyFactsRepository party,
            EncounterCreatureRepository creatures,
            EncounterTableCandidateRepository encounterTables,
            SaveEncounterPlanUseCase savePlanUseCase,
            LoadSavedEncounterPlanUseCase loadSavedPlanUseCase,
            ListSavedEncounterPlansUseCase listSavedPlansUseCase,
            LoadEncounterBudgetUseCase loadBudgetUseCase
    ) {
        EncounterGenerationUseCase generator = new EncounterGenerationUseCase(party, creatures, encounterTables);
        return new ApplyEncounterSessionUseCase(new EncounterSessionRepository(
                party,
                creatures,
                generator,
                loadBudgetUseCase,
                savePlanUseCase,
                loadSavedPlanUseCase,
                listSavedPlansUseCase));
    }
}
