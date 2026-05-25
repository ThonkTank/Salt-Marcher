package src.domain.encounter;

import shell.api.ServiceRegistry;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureEncounterCandidatesModel;
import src.domain.encounter.application.ApplyEncounterStateUseCase;
import src.domain.encounter.model.generation.usecase.EncounterGenerationUseCase;
import src.domain.encounter.model.plan.repository.EncounterPlanRepository;
import src.domain.encounter.model.plan.usecase.ListSavedEncounterPlansUseCase;
import src.domain.encounter.model.plan.usecase.LoadEncounterPlanBudgetUseCase;
import src.domain.encounter.model.plan.usecase.LoadSavedEncounterPlanUseCase;
import src.domain.encounter.model.plan.usecase.PublishEncounterPlanBudgetUseCase;
import src.domain.encounter.model.plan.usecase.PublishEncounterSavedPlansUseCase;
import src.domain.encounter.model.plan.usecase.SaveEncounterPlanUseCase;
import src.domain.encounter.model.reference.port.ApplicationEncounterCreatureCatalogPort;
import src.domain.encounter.model.reference.port.ApplicationEncounterTableCandidatePort;
import src.domain.encounter.model.reference.repository.EncounterCreatureRepository;
import src.domain.encounter.model.reference.repository.EncounterTableCandidateRepository;
import src.domain.encounter.model.session.repository.EncounterPartyFactsRepository;
import src.domain.encounter.model.session.repository.EncounterSessionRepository;
import src.domain.encounter.model.session.repository.EncounterSessionUseCaseAdaptersRepository;
import src.domain.encounter.model.session.usecase.ApplyEncounterSessionUseCase;
import src.domain.encounter.model.session.usecase.LoadEncounterBudgetUseCase;
import src.domain.encounter.model.session.usecase.PublishEncounterSessionUseCase;
import src.domain.encounter.model.session.usecase.UpdateEncounterBuilderInputsUseCase;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.published.EncounterTableCandidatesModel;

final class EncounterApplicationServiceFactoryServiceAssembly {

    private static final long INITIAL_PLAN_ID = 0L;

    private EncounterApplicationServiceFactoryServiceAssembly() {
    }

    static EncounterApplicationService create(
            ServiceRegistry services,
            EncounterPublishedStateServiceAssembly publishedState
    ) {
        EncounterPlanRepository repository = services.require(EncounterPlanRepository.class);
        EncounterPartyFactsRepository party = EncounterPartyFactsReadbackServiceAssembly.create(services);
        EncounterCreatureRepository creatures = new EncounterCreatureRequestServiceAssembly(
                services.require(CreaturesApplicationService.class));
        ApplicationEncounterCreatureCatalogPort creatureCatalog = new EncounterCreatureCatalogServiceAssembly(
                services.require(CreatureDetailModel.class),
                services.require(CreatureEncounterCandidatesModel.class));
        EncounterTableCandidateRepository encounterTables = new EncounterTableCandidateRequestServiceAssembly(
                services.require(EncounterTableApplicationService.class));
        ApplicationEncounterTableCandidatePort tableCandidates =
                new EncounterTableCandidateServiceAssembly(services.require(EncounterTableCandidatesModel.class));
        return create(repository, party, creatures, creatureCatalog, encounterTables, tableCandidates, publishedState);
    }

    private static EncounterApplicationService create(
            EncounterPlanRepository encounterPlans,
            EncounterPartyFactsRepository party,
            EncounterCreatureRepository creatures,
            ApplicationEncounterCreatureCatalogPort creatureCatalog,
            EncounterTableCandidateRepository encounterTables,
            ApplicationEncounterTableCandidatePort tableCandidates,
            EncounterPublishedStateServiceAssembly publishedState
    ) {
        LoadEncounterBudgetUseCase loadBudgetUseCase = new LoadEncounterBudgetUseCase(party);
        SaveEncounterPlanUseCase savePlanUseCase = new SaveEncounterPlanUseCase(encounterPlans);
        LoadSavedEncounterPlanUseCase loadSavedPlanUseCase = new LoadSavedEncounterPlanUseCase(encounterPlans);
        ListSavedEncounterPlansUseCase listSavedPlansUseCase = new ListSavedEncounterPlansUseCase(encounterPlans);
        LoadEncounterPlanBudgetUseCase loadPlanBudgetUseCase =
                new LoadEncounterPlanBudgetUseCase(encounterPlans, party, creatures, creatureCatalog);
        ApplyEncounterSessionUseCase applySessionUseCase = createApplySessionUseCase(
                party,
                creatures,
                creatureCatalog,
                encounterTables,
                tableCandidates,
                savePlanUseCase,
                loadSavedPlanUseCase,
                listSavedPlansUseCase,
                loadBudgetUseCase);
        PublishEncounterSessionUseCase publishSessionUseCase =
                new PublishEncounterSessionUseCase(publishedState.sessionRepository(), loadBudgetUseCase);
        PublishEncounterSavedPlansUseCase publishSavedPlansUseCase =
                new PublishEncounterSavedPlansUseCase(publishedState.planRepository(), listSavedPlansUseCase);
        PublishEncounterPlanBudgetUseCase publishPlanBudgetUseCase =
                new PublishEncounterPlanBudgetUseCase(publishedState.planRepository(), loadPlanBudgetUseCase);
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
            ApplicationEncounterCreatureCatalogPort creatureCatalog,
            EncounterTableCandidateRepository encounterTables,
            ApplicationEncounterTableCandidatePort tableCandidates,
            SaveEncounterPlanUseCase savePlanUseCase,
            LoadSavedEncounterPlanUseCase loadSavedPlanUseCase,
            ListSavedEncounterPlansUseCase listSavedPlansUseCase,
            LoadEncounterBudgetUseCase loadBudgetUseCase
    ) {
        EncounterGenerationUseCase generator =
                new EncounterGenerationUseCase(party, creatures, creatureCatalog, encounterTables, tableCandidates);
        return new ApplyEncounterSessionUseCase(
                new EncounterSessionRepository(
                        party,
                        creatures,
                        creatureCatalog,
                        new EncounterSessionUseCaseAdaptersRepository(
                                generator::execute,
                                () -> {
                                    LoadEncounterBudgetUseCase.Result result = loadBudgetUseCase.execute();
                                    return new EncounterSessionUseCaseAdaptersRepository.EncounterBudgetLoadResult(
                                            result.status(),
                                            result.budget());
                                },
                                savePlanUseCase::execute,
                                loadSavedPlanUseCase::execute,
                                listSavedPlansUseCase::execute)));
    }
}
