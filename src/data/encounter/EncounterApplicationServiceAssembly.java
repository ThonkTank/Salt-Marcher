package src.data.encounter;

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

final class EncounterApplicationServiceAssembly {

    private static final long INITIAL_PLAN_ID = 0L;

    EncounterApplicationService create(
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
