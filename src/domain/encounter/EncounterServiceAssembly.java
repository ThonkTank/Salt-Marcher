package src.domain.encounter;

import shell.api.ServiceRegistry;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureEncounterCandidatesModel;
import src.domain.encounter.model.generation.EncounterGenerator;
import src.domain.encounter.model.plan.repository.EncounterPlanRepository;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.published.EncounterTableCandidatesModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.PartyMutationModel;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

final class EncounterServiceAssembly {

    private final EncounterPublishedState publishedState = new EncounterPublishedState();

    EncounterApplicationService createApplicationService(ServiceRegistry services) {
        EncounterForeignFacts facts = new EncounterForeignFacts(
                services.require(CreaturesApplicationService.class),
                services.require(CreatureDetailModel.class),
                services.require(CreatureEncounterCandidatesModel.class),
                services.require(EncounterTableApplicationService.class),
                services.require(EncounterTableCandidatesModel.class),
                services.find(WorldPlannerSnapshotModel.class).orElse(null),
                services.require(PartyApplicationService.class),
                services.require(ActivePartyModel.class),
                services.require(ActivePartyCompositionModel.class),
                services.require(AdventuringDaySummaryModel.class),
                services.require(PartyMutationModel.class));
        EncounterPlanGateway plans = new EncounterPlanGateway(services.require(EncounterPlanRepository.class), facts);
        EncounterSessionRuntimeAccess runtime = new EncounterSessionRuntimeAccess(
                facts,
                plans,
                new EncounterGenerator(facts));
        return new EncounterApplicationService(runtime, plans, publishedState);
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
