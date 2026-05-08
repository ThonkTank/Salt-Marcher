package src.domain.encounter.runtime.service;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.application.ApplyEncounterSessionUseCase;
import src.domain.encounter.application.EncounterGenerationUseCase;
import src.domain.encounter.application.EncounterSessionRuntimeAdapter;
import src.domain.encounter.application.ListSavedEncounterPlansUseCase;
import src.domain.encounter.application.LoadEncounterBudgetUseCase;
import src.domain.encounter.application.LoadEncounterPlanBudgetUseCase;
import src.domain.encounter.application.LoadSavedEncounterPlanUseCase;
import src.domain.encounter.application.SaveEncounterPlanUseCase;
import src.domain.encounter.plan.port.EncounterPlanRepository;
import src.domain.encounter.session.port.EncounterPartyFactsRepository;
import src.domain.encountertable.EncounterTableApplicationService;

record EncounterRuntimeBootstrap(
        @Nullable ApplyEncounterSessionUseCase applySessionUseCase,
        EncounterSessionPublicationAccess sessionPublicationAccess,
        EncounterPlanPublicationAccess planPublicationAccess
) {

    static EncounterRuntimeBootstrap create(
            @Nullable EncounterPartyFactsRepository party,
            @Nullable CreaturesApplicationService creatures,
            @Nullable EncounterTableApplicationService encounterTables,
            @Nullable EncounterPlanRepository encounterPlans,
            EncounterPlanPublishedStateRepository planPublishedStateRepository,
            EncounterSessionPublishedStateRepository sessionPublishedStateRepository
    ) {
        EncounterRuntimeUseCases useCases = createUseCases(party, creatures, encounterTables, encounterPlans);
        return new EncounterRuntimeBootstrap(
                useCases.applySessionUseCase(),
                new EncounterSessionPublicationAccess(
                        Objects.requireNonNull(sessionPublishedStateRepository, "sessionPublishedStateRepository"),
                        useCases.loadBudgetUseCase()),
                new EncounterPlanPublicationAccess(
                        Objects.requireNonNull(planPublishedStateRepository, "planPublishedStateRepository"),
                        useCases.listSavedPlansUseCase(),
                        useCases.loadPlanBudgetUseCase()));
    }

    private static EncounterRuntimeUseCases createUseCases(
            @Nullable EncounterPartyFactsRepository party,
            @Nullable CreaturesApplicationService creatures,
            @Nullable EncounterTableApplicationService encounterTables,
            @Nullable EncounterPlanRepository encounterPlans
    ) {
        SaveEncounterPlanUseCase savePlanUseCase = encounterPlans == null ? null : new SaveEncounterPlanUseCase(encounterPlans);
        LoadSavedEncounterPlanUseCase loadSavedPlanUseCase =
                encounterPlans == null ? null : new LoadSavedEncounterPlanUseCase(encounterPlans);
        ListSavedEncounterPlansUseCase listSavedPlansUseCase =
                encounterPlans == null ? null : new ListSavedEncounterPlansUseCase(encounterPlans);
        LoadEncounterBudgetUseCase loadBudgetUseCase = party == null ? null : new LoadEncounterBudgetUseCase(party);
        return new EncounterRuntimeUseCases(
                createApplySessionUseCase(
                        party,
                        creatures,
                        encounterTables,
                        savePlanUseCase,
                        loadSavedPlanUseCase,
                        listSavedPlansUseCase,
                        loadBudgetUseCase),
                loadBudgetUseCase,
                createLoadPlanBudgetUseCase(party, creatures, encounterPlans),
                listSavedPlansUseCase);
    }

    private static @Nullable ApplyEncounterSessionUseCase createApplySessionUseCase(
            @Nullable EncounterPartyFactsRepository party,
            @Nullable CreaturesApplicationService creatures,
            @Nullable EncounterTableApplicationService encounterTables,
            @Nullable SaveEncounterPlanUseCase savePlanUseCase,
            @Nullable LoadSavedEncounterPlanUseCase loadSavedPlanUseCase,
            @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase,
            @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase
    ) {
        if (party == null || creatures == null) {
            return null;
        }
        EncounterGenerationUseCase generator = new EncounterGenerationUseCase(party, creatures, encounterTables);
        return new ApplyEncounterSessionUseCase(new EncounterSessionRuntimeAdapter(
                party,
                creatures,
                generator,
                loadBudgetUseCase,
                savePlanUseCase,
                loadSavedPlanUseCase,
                listSavedPlansUseCase));
    }

    private static @Nullable LoadEncounterPlanBudgetUseCase createLoadPlanBudgetUseCase(
            @Nullable EncounterPartyFactsRepository party,
            @Nullable CreaturesApplicationService creatures,
            @Nullable EncounterPlanRepository encounterPlans
    ) {
        if (party == null || creatures == null || encounterPlans == null) {
            return null;
        }
        return new LoadEncounterPlanBudgetUseCase(encounterPlans, party, creatures);
    }

    private record EncounterRuntimeUseCases(
            @Nullable ApplyEncounterSessionUseCase applySessionUseCase,
            @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase,
            @Nullable LoadEncounterPlanBudgetUseCase loadPlanBudgetUseCase,
            @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase
    ) {
    }
}
