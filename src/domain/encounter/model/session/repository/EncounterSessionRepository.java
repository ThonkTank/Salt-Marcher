package src.domain.encounter.model.session.repository;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.model.generation.EncounterGenerationRequest;
import src.domain.encounter.model.plan.EncounterPlan;
import src.domain.encounter.model.reference.repository.EncounterCreatureRepository;
import src.domain.encounter.model.session.EncounterSession;
import src.domain.encounter.model.session.AwardXpOutcome;
import src.domain.encounter.model.session.BudgetData;
import src.domain.encounter.model.session.CreatureDetailData;
import src.domain.encounter.model.session.GenerationResultData;
import src.domain.encounter.model.session.ListPlansOutcome;
import src.domain.encounter.model.session.PartyMemberData;
import src.domain.encounter.model.session.PlanOutcome;

public final class EncounterSessionRepository implements EncounterSession.SessionRepository {

    private final EncounterPartyFactsRepository party;
    private final EncounterSessionUseCaseAdaptersRepository useCases;
    private final EncounterSessionDataMapperRepository dataMapper;

    public EncounterSessionRepository(
            EncounterPartyFactsRepository party,
            EncounterCreatureRepository creatures,
            Object creatureCatalog,
            EncounterSessionUseCaseAdaptersRepository useCases
    ) {
        this.party = party;
        this.useCases = useCases;
        this.dataMapper = new EncounterSessionDataMapperRepository(creatures, creatureCatalog);
    }

    @Override
    public List<PartyMemberData> loadActiveParty() {
        return party.loadActiveParty();
    }

    @Override
    public Optional<BudgetData> loadBudget() {
        return useCases.loadBudget(dataMapper);
    }

    @Override
    public GenerationResultData generate(EncounterGenerationRequest request) {
        return useCases.generate(request, dataMapper);
    }

    @Override
    public PlanOutcome savePlan(EncounterPlan plan) {
        return useCases.savePlan(plan, dataMapper);
    }

    @Override
    public PlanOutcome loadPlan(long planId) {
        return useCases.loadPlan(planId, dataMapper);
    }

    @Override
    public ListPlansOutcome listPlans() {
        return useCases.listPlans();
    }

    @Override
    public Optional<CreatureDetailData> loadCreature(long creatureId) {
        return dataMapper.toCreatureDetail(creatureId);
    }

    @Override
    public AwardXpOutcome awardXp(List<Long> partyMemberIds, int xpPerCharacter) {
        return new AwardXpOutcome(party.awardXp(partyMemberIds, xpPerCharacter));
    }
}
