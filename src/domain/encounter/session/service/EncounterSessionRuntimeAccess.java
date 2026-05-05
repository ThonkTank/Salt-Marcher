package src.domain.encounter.session.service;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.generation.value.EncounterGenerationRequest;
import src.domain.encounter.session.entity.EncounterSessionRuntimeData;
import src.domain.encounter.session.entity.EncounterSessionViewState;

public interface EncounterSessionRuntimeAccess {

    List<EncounterSessionViewState.PartyMemberData> loadActiveParty();

    Optional<EncounterSessionRuntimeData.BudgetData> loadBudget();

    EncounterSessionRuntimeData.GenerationResultData generate(EncounterGenerationRequest request);

    EncounterSessionRuntimeData.SavePlanOutcome savePlan(EncounterSessionRuntimeData.SavedPlanData plan);

    EncounterSessionRuntimeData.LoadPlanOutcome loadPlan(long planId);

    EncounterSessionRuntimeData.ListPlansOutcome listPlans();

    Optional<EncounterSessionRuntimeData.CreatureDetailData> loadCreature(long creatureId);

    EncounterSessionRuntimeData.AwardXpOutcome awardXp(List<Long> partyMemberIds, int xpPerCharacter);
}
