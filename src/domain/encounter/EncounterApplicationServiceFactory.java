package src.domain.encounter;

import org.jspecify.annotations.Nullable;
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

public final class EncounterApplicationServiceFactory {

    private static final long INITIAL_PLAN_ID = 0L;

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public EncounterApplicationServiceFactory() {
        // Public factory bridge for data-layer runtime assembly.
    }

    public EncounterApplicationService create(
            @Nullable EncounterPartyFactsRepository party,
            @Nullable EncounterCreatureRepository creatures,
            @Nullable EncounterTableCandidateRepository encounterTables,
            @Nullable EncounterPlanRepository encounterPlans,
            EncounterPlanPublishedStateRepository planPublishedStateRepository,
            EncounterSessionPublishedStateRepository sessionPublishedStateRepository
    ) {
        LoadEncounterBudgetUseCase loadBudgetUseCase = party == null ? null : new LoadEncounterBudgetUseCase(party);
        SaveEncounterPlanUseCase savePlanUseCase = encounterPlans == null ? null : new SaveEncounterPlanUseCase(encounterPlans);
        LoadSavedEncounterPlanUseCase loadSavedPlanUseCase =
                encounterPlans == null ? null : new LoadSavedEncounterPlanUseCase(encounterPlans);
        ListSavedEncounterPlansUseCase listSavedPlansUseCase =
                encounterPlans == null ? null : new ListSavedEncounterPlansUseCase(encounterPlans);
        LoadEncounterPlanBudgetUseCase loadPlanBudgetUseCase =
                createPlanBudgetUseCase(party, creatures, encounterPlans);
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
        publishSessionUseCase.execute(applySessionUseCase == null ? null : applySessionUseCase.session());
        publishSavedPlansUseCase.execute();
        publishPlanBudgetUseCase.execute(INITIAL_PLAN_ID);
        return new EncounterApplicationService(
                new ApplyEncounterStateUseCase(applySessionUseCase, publishSessionUseCase, publishSavedPlansUseCase),
                new UpdateEncounterBuilderInputsUseCase(applySessionUseCase, publishSessionUseCase),
                publishPlanBudgetUseCase);
    }

    private static @Nullable LoadEncounterPlanBudgetUseCase createPlanBudgetUseCase(
            @Nullable EncounterPartyFactsRepository party,
            @Nullable EncounterCreatureRepository creatures,
            @Nullable EncounterPlanRepository encounterPlans
    ) {
        return party == null || creatures == null || encounterPlans == null
                ? null
                : new LoadEncounterPlanBudgetUseCase(encounterPlans, party, creatures);
    }

    private static @Nullable ApplyEncounterSessionUseCase createApplySessionUseCase(
            @Nullable EncounterPartyFactsRepository party,
            @Nullable EncounterCreatureRepository creatures,
            @Nullable EncounterTableCandidateRepository encounterTables,
            @Nullable SaveEncounterPlanUseCase savePlanUseCase,
            @Nullable LoadSavedEncounterPlanUseCase loadSavedPlanUseCase,
            @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase,
            @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase
    ) {
        if (party == null || creatures == null) {
            return null;
        }
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
