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

    private static final long INITIAL_PLAN_ID = 0L;

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public EncounterServiceContribution() {
        // Required by passive service contribution discovery.
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        EncounterPlanRepository repository = new SqliteEncounterPlanRepository();
        EncounterPublishedStateRepositoryAdapter publishedState = new EncounterPublishedStateRepositoryAdapter();
        ApplicationServiceAssembly assembly = new ApplicationServiceAssembly();
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

    private static final class ApplicationServiceAssembly {

        EncounterApplicationService create(
                src.domain.encounter.model.plan.repository.EncounterPlanPublishedStateRepository planPublishedStateRepository,
                src.domain.encounter.model.session.repository.EncounterSessionPublishedStateRepository sessionPublishedStateRepository,
                EncounterPlanRepository encounterPlans,
                src.domain.encounter.model.session.repository.EncounterPartyFactsRepository party,
                src.domain.encounter.model.reference.repository.EncounterCreatureRepository creatures,
                src.domain.encounter.model.reference.repository.EncounterTableCandidateRepository encounterTables
        ) {
            src.domain.encounter.application.LoadEncounterBudgetUseCase loadBudgetUseCase =
                    new src.domain.encounter.application.LoadEncounterBudgetUseCase(party);
            src.domain.encounter.application.SaveEncounterPlanUseCase savePlanUseCase =
                    new src.domain.encounter.application.SaveEncounterPlanUseCase(encounterPlans);
            src.domain.encounter.application.LoadSavedEncounterPlanUseCase loadSavedPlanUseCase =
                    new src.domain.encounter.application.LoadSavedEncounterPlanUseCase(encounterPlans);
            src.domain.encounter.application.ListSavedEncounterPlansUseCase listSavedPlansUseCase =
                    new src.domain.encounter.application.ListSavedEncounterPlansUseCase(encounterPlans);
            src.domain.encounter.application.LoadEncounterPlanBudgetUseCase loadPlanBudgetUseCase =
                    new src.domain.encounter.application.LoadEncounterPlanBudgetUseCase(encounterPlans, party, creatures);
            src.domain.encounter.application.ApplyEncounterSessionUseCase applySessionUseCase = createApplySessionUseCase(
                    party,
                    creatures,
                    encounterTables,
                    savePlanUseCase,
                    loadSavedPlanUseCase,
                    listSavedPlansUseCase,
                    loadBudgetUseCase);
            src.domain.encounter.application.PublishEncounterSessionUseCase publishSessionUseCase =
                    new src.domain.encounter.application.PublishEncounterSessionUseCase(
                            sessionPublishedStateRepository,
                            loadBudgetUseCase);
            src.domain.encounter.application.PublishEncounterSavedPlansUseCase publishSavedPlansUseCase =
                    new src.domain.encounter.application.PublishEncounterSavedPlansUseCase(
                            planPublishedStateRepository,
                            listSavedPlansUseCase);
            src.domain.encounter.application.PublishEncounterPlanBudgetUseCase publishPlanBudgetUseCase =
                    new src.domain.encounter.application.PublishEncounterPlanBudgetUseCase(
                            planPublishedStateRepository,
                            loadPlanBudgetUseCase);
            publishSessionUseCase.execute(applySessionUseCase.session());
            publishSavedPlansUseCase.execute();
            publishPlanBudgetUseCase.execute(INITIAL_PLAN_ID);
            return new EncounterApplicationService(
                    new src.domain.encounter.application.ApplyEncounterStateUseCase(
                            applySessionUseCase,
                            publishSessionUseCase,
                            publishSavedPlansUseCase),
                    new src.domain.encounter.application.UpdateEncounterBuilderInputsUseCase(
                            applySessionUseCase,
                            publishSessionUseCase),
                    publishPlanBudgetUseCase);
        }

        private static src.domain.encounter.application.ApplyEncounterSessionUseCase createApplySessionUseCase(
                src.domain.encounter.model.session.repository.EncounterPartyFactsRepository party,
                src.domain.encounter.model.reference.repository.EncounterCreatureRepository creatures,
                src.domain.encounter.model.reference.repository.EncounterTableCandidateRepository encounterTables,
                src.domain.encounter.application.SaveEncounterPlanUseCase savePlanUseCase,
                src.domain.encounter.application.LoadSavedEncounterPlanUseCase loadSavedPlanUseCase,
                src.domain.encounter.application.ListSavedEncounterPlansUseCase listSavedPlansUseCase,
                src.domain.encounter.application.LoadEncounterBudgetUseCase loadBudgetUseCase
        ) {
            src.domain.encounter.application.EncounterGenerationUseCase generator =
                    new src.domain.encounter.application.EncounterGenerationUseCase(party, creatures, encounterTables);
            return new src.domain.encounter.application.ApplyEncounterSessionUseCase(
                    new src.domain.encounter.model.session.repository.EncounterSessionRepository(
                            party,
                            creatures,
                            generator,
                            loadBudgetUseCase,
                            savePlanUseCase,
                            loadSavedPlanUseCase,
                            listSavedPlansUseCase));
        }
    }
}
