package src.data.sessionplanner.query;

import java.util.List;
import java.util.Objects;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.ListSavedEncounterPlansQuery;
import src.domain.encounter.published.LoadEncounterPlanBudgetQuery;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.SavedEncounterPlanSummary;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.CalculateAdventuringDayQuery;
import src.domain.party.published.LoadActivePartyQuery;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.ReadStatus;
import src.domain.sessionplanner.session.port.SessionEncounterFactsLookup;
import src.domain.sessionplanner.session.port.SessionPartyFactsLookup;

public final class ApplicationSessionPlannerFactsQueryAdapter
        implements SessionPartyFactsLookup, SessionEncounterFactsLookup {

    private final PartyApplicationService party;
    private final EncounterApplicationService encounters;

    public ApplicationSessionPlannerFactsQueryAdapter(
            PartyApplicationService party,
            EncounterApplicationService encounters
    ) {
        this.party = Objects.requireNonNull(party, "party");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
    }

    @Override
    public ActivePartyMembersFact loadActivePartyMembers() {
        ActivePartyResult result = party.loadActiveParty(new LoadActivePartyQuery());
        if (result.status() != ReadStatus.SUCCESS) {
            return new ActivePartyMembersFact(false, List.of(), "Aktive Party konnte nicht geladen werden.");
        }
        return new ActivePartyMembersFact(
                true,
                result.members().stream().map(ApplicationSessionPlannerFactsQueryAdapter::toPartyMemberFact).toList(),
                "");
    }

    @Override
    public AdventuringDayFact calculateAdventuringDay(List<Integer> levels, int plannedEncounterXp) {
        AdventuringDayCalculationResult result =
                party.calculateAdventuringDay(new CalculateAdventuringDayQuery(levels, plannedEncounterXp));
        if (result.status() != ReadStatus.SUCCESS
                || result.calculation() == null
                || result.calculation().budget() == null) {
            return AdventuringDayFact.unavailable();
        }
        return new AdventuringDayFact(
                true,
                result.calculation().budget().totalBudgetXp(),
                result.calculation().budget().firstShortRestXp(),
                result.calculation().budget().secondShortRestXp(),
                result.calculation().progress().shortRests(),
                result.calculation().progress().longRests());
    }

    @Override
    public EncounterPlanListFact listEncounterPlans() {
        SavedEncounterPlanListResult result = encounters.listPlans(new ListSavedEncounterPlansQuery());
        if (result.status() != SavedEncounterPlanStatus.SUCCESS) {
            return new EncounterPlanListFact(false, List.of(), result.message());
        }
        return new EncounterPlanListFact(
                true,
                result.plans().stream().map(ApplicationSessionPlannerFactsQueryAdapter::toSavedEncounterPlanFact).toList(),
                "");
    }

    @Override
    public EncounterPlanFact loadEncounterPlan(long encounterPlanId) {
        EncounterPlanBudgetResult result = encounters.loadPlanBudget(new LoadEncounterPlanBudgetQuery(encounterPlanId));
        if (result.status() != EncounterPlanBudgetStatus.SUCCESS || result.summary() == null) {
            String message = result.message().isBlank()
                    ? "Encounter-Plan konnte nicht geladen werden."
                    : result.message();
            return EncounterPlanFact.unavailable(encounterPlanId, message);
        }
        return new EncounterPlanFact(
                true,
                result.summary().planId(),
                result.summary().name(),
                result.summary().generatedLabel(),
                result.summary().creatureCount(),
                result.summary().totalBaseXp(),
                result.summary().adjustedXp(),
                result.summary().xpMultiplier(),
                result.summary().difficultyLabel(),
                "Adj. XP " + result.summary().adjustedXp() + " · " + result.summary().difficultyLabel());
    }

    private static PartyMemberFact toPartyMemberFact(PartyMemberSummary member) {
        return new PartyMemberFact(
                member == null || member.id() == null ? 0L : member.id(),
                member == null ? "" : member.name(),
                member == null ? 0 : member.level());
    }

    private static SavedEncounterPlanFact toSavedEncounterPlanFact(SavedEncounterPlanSummary plan) {
        return new SavedEncounterPlanFact(
                plan == null ? 0L : plan.id(),
                plan == null ? "" : plan.name(),
                plan == null ? "" : plan.generatedLabel(),
                plan == null ? 0 : plan.creatureCount());
    }
}
