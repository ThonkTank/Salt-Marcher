package src.data.sessionplanner.query;

import java.util.List;
import java.util.Objects;
import shell.api.ServiceRegistry;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.CalculateAdventuringDayCommand;
import src.domain.sessionplanner.session.port.SessionEncounterFactsLookup;
import src.domain.sessionplanner.session.port.SessionPartyFactsLookup;

public final class ApplicationSessionPlannerFactsQueryAdapter
        implements SessionPartyFactsLookup, SessionEncounterFactsLookup {

    private final PartyApplicationService party;
    private final SessionPlannerPartyFactsPublishedReadback partyReadback;
    private final EncounterApplicationService encounters;
    private final SessionPlannerEncounterFactsPublishedReadback encounterReadback;

    public ApplicationSessionPlannerFactsQueryAdapter(
            PartyApplicationService party,
            SessionPlannerPartyFactsPublishedReadback partyReadback,
            EncounterApplicationService encounters,
            SessionPlannerEncounterFactsPublishedReadback encounterReadback
    ) {
        this.party = Objects.requireNonNull(party, "party");
        this.partyReadback = Objects.requireNonNull(partyReadback, "partyReadback");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.encounterReadback = Objects.requireNonNull(encounterReadback, "encounterReadback");
    }

    public static ApplicationSessionPlannerFactsQueryAdapter create(ServiceRegistry services) {
        ServiceRegistry registry = Objects.requireNonNull(services, "services");
        return new ApplicationSessionPlannerFactsQueryAdapter(
                registry.require(PartyApplicationService.class),
                new SessionPlannerPartyFactsPublishedReadback(
                        registry.require(src.domain.party.published.ActivePartyModel.class),
                        registry.require(src.domain.party.published.AdventuringDayCalculationModel.class)),
                registry.require(EncounterApplicationService.class),
                new SessionPlannerEncounterFactsPublishedReadback(
                        registry.require(src.domain.encounter.published.SavedEncounterPlanListModel.class),
                        registry.require(src.domain.encounter.published.EncounterPlanBudgetModel.class)));
    }

    @Override
    public ActivePartyMembersFact loadActivePartyMembers() {
        return partyReadback.loadActivePartyMembers();
    }

    @Override
    public AdventuringDayFact calculateAdventuringDay(List<Integer> levels, int plannedEncounterXp) {
        party.calculateAdventuringDay(new CalculateAdventuringDayCommand(levels, plannedEncounterXp));
        return partyReadback.currentAdventuringDayFact();
    }

    @Override
    public EncounterPlanListFact listEncounterPlans() {
        return encounterReadback.listEncounterPlans();
    }

    @Override
    public EncounterPlanFact loadEncounterPlan(long encounterPlanId) {
        encounters.refreshPlanBudget(new RefreshEncounterPlanBudgetCommand(encounterPlanId));
        return encounterReadback.currentEncounterPlan(encounterPlanId);
    }
}
