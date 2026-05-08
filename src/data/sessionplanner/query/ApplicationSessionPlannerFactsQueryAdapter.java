package src.data.sessionplanner.query;

import java.util.List;
import java.util.Objects;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanSummary;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.AdventuringDayPlanningSummary;
import src.domain.party.published.CalculateAdventuringDayCommand;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.ReadStatus;
import src.domain.sessionplanner.session.port.SessionEncounterFactsLookup;
import src.domain.sessionplanner.session.port.SessionPartyFactsLookup;

@SuppressWarnings("PMD.CouplingBetweenObjects")
public final class ApplicationSessionPlannerFactsQueryAdapter
        implements SessionPartyFactsLookup, SessionEncounterFactsLookup {

    private final PartyApplicationService party;
    private final ActivePartyModel activePartyModel;
    private final EncounterApplicationService encounters;
    private AdventuringDayCalculationResult currentAdventuringDayCalculation;
    private SavedEncounterPlanListResult currentSavedPlans;
    private EncounterPlanBudgetResult currentPlanBudget;

    public ApplicationSessionPlannerFactsQueryAdapter(
            PartyApplicationService party,
            ActivePartyModel activePartyModel,
            AdventuringDayCalculationModel adventuringDayCalculationModel,
            EncounterApplicationService encounters,
            SavedEncounterPlanListModel savedPlansModel,
            EncounterPlanBudgetModel planBudgetModel
    ) {
        this.party = Objects.requireNonNull(party, "party");
        this.activePartyModel = Objects.requireNonNull(activePartyModel, "activePartyModel");
        AdventuringDayCalculationModel calculationModel =
                Objects.requireNonNull(adventuringDayCalculationModel, "adventuringDayCalculationModel");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        SavedEncounterPlanListModel savedPlans =
                Objects.requireNonNull(savedPlansModel, "savedPlansModel");
        EncounterPlanBudgetModel planBudget =
                Objects.requireNonNull(planBudgetModel, "planBudgetModel");
        this.currentAdventuringDayCalculation = calculationModel.current();
        this.currentSavedPlans = savedPlans.current();
        this.currentPlanBudget = planBudget.current();
        calculationModel.subscribe(result -> currentAdventuringDayCalculation = result);
        savedPlans.subscribe(result -> currentSavedPlans = result);
        planBudget.subscribe(result -> currentPlanBudget = result);
    }

    @Override
    public ActivePartyMembersFact loadActivePartyMembers() {
        ActivePartyResult result = activePartyModel.current();
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
        party.calculateAdventuringDay(new CalculateAdventuringDayCommand(levels, plannedEncounterXp));
        AdventuringDayCalculationResult result = currentAdventuringDayCalculation;
        AdventuringDayPlanningSummary summary = result == null ? null : result.planningSummary();
        if (result == null || result.status() != ReadStatus.SUCCESS || summary == null) {
            return AdventuringDayFact.unavailable();
        }
        return new AdventuringDayFact(
                true,
                summary.totalBudgetXp(),
                summary.firstShortRestXp(),
                summary.secondShortRestXp(),
                summary.recommendedShortRests(),
                summary.recommendedLongRests());
    }

    @Override
    public EncounterPlanListFact listEncounterPlans() {
        SavedEncounterPlanListResult result = currentSavedPlans;
        if (result == null || result.status() != SavedEncounterPlanStatus.SUCCESS) {
            return new EncounterPlanListFact(false, List.of(), result == null ? "" : result.message());
        }
        return new EncounterPlanListFact(
                true,
                result.plans().stream().map(ApplicationSessionPlannerFactsQueryAdapter::toSavedEncounterPlanFact).toList(),
                "");
    }

    @Override
    public EncounterPlanFact loadEncounterPlan(long encounterPlanId) {
        encounters.refreshPlanBudget(new RefreshEncounterPlanBudgetCommand(encounterPlanId));
        EncounterPlanBudgetResult result = currentPlanBudget;
        if (result == null || result.status() != EncounterPlanBudgetStatus.SUCCESS || result.summary() == null) {
            String message = result == null || result.message().isBlank()
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

    private static PartyMemberProfile toPartyMemberFact(PartyMemberSummary member) {
        return new PartyMemberProfile(
                member == null || member.id() == null ? 0L : member.id(),
                member == null ? "" : member.name(),
                member == null ? 0 : member.level());
    }

    private static SavedEncounterPlanFact toSavedEncounterPlanFact(SavedEncounterPlanSummary plan) {
        return new SavedEncounterPlanFact(
                plan == null ? 0L : plan.planId(),
                plan == null ? "" : plan.name(),
                plan == null ? "" : plan.summaryText());
    }

}
