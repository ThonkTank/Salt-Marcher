package src.data.sessionplanner.query;

import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.encounter.published.SavedEncounterPlanChoice;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.CalculateAdventuringDayCommand;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.ReadStatus;
import src.domain.sessionplanner.session.port.SessionEncounterFactsLookup;
import src.domain.sessionplanner.session.port.SessionPartyFactsLookup;

@SuppressWarnings("PMD.CouplingBetweenObjects")
public final class ApplicationSessionPlannerFactsQueryAdapter
        implements SessionPartyFactsLookup, SessionEncounterFactsLookup {

    private final Supplier<PartyApplicationService> partySupplier;
    private final Supplier<ActivePartyModel> activePartyModelSupplier;
    private final Supplier<AdventuringDayCalculationModel> adventuringDayCalculationModelSupplier;
    private final Supplier<EncounterApplicationService> encountersSupplier;
    private final Supplier<SavedEncounterPlanListModel> savedPlansModelSupplier;
    private final Supplier<EncounterPlanBudgetModel> planBudgetModelSupplier;

    public ApplicationSessionPlannerFactsQueryAdapter(
            Supplier<PartyApplicationService> partySupplier,
            Supplier<ActivePartyModel> activePartyModelSupplier,
            Supplier<AdventuringDayCalculationModel> adventuringDayCalculationModelSupplier,
            Supplier<EncounterApplicationService> encountersSupplier,
            Supplier<SavedEncounterPlanListModel> savedPlansModelSupplier,
            Supplier<EncounterPlanBudgetModel> planBudgetModelSupplier
    ) {
        this.partySupplier = Objects.requireNonNull(partySupplier, "partySupplier");
        this.activePartyModelSupplier = Objects.requireNonNull(activePartyModelSupplier, "activePartyModelSupplier");
        this.adventuringDayCalculationModelSupplier = Objects.requireNonNull(
                adventuringDayCalculationModelSupplier,
                "adventuringDayCalculationModelSupplier");
        this.encountersSupplier = Objects.requireNonNull(encountersSupplier, "encountersSupplier");
        this.savedPlansModelSupplier = Objects.requireNonNull(savedPlansModelSupplier, "savedPlansModelSupplier");
        this.planBudgetModelSupplier = Objects.requireNonNull(planBudgetModelSupplier, "planBudgetModelSupplier");
    }

    @Override
    public ActivePartyMembersFact loadActivePartyMembers() {
        ActivePartyModel activePartyModel = activePartyModelSupplier.get();
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
        PartyApplicationService party = partySupplier.get();
        AdventuringDayCalculationModel adventuringDayCalculationModel = adventuringDayCalculationModelSupplier.get();
        party.calculateAdventuringDay(new CalculateAdventuringDayCommand(levels, plannedEncounterXp));
        AdventuringDayCalculationResult result = adventuringDayCalculationModel.current();
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
        SavedEncounterPlanListModel savedPlansModel = savedPlansModelSupplier.get();
        SavedEncounterPlanListResult result = savedPlansModel.current();
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
        EncounterApplicationService encounters = encountersSupplier.get();
        EncounterPlanBudgetModel planBudgetModel = planBudgetModelSupplier.get();
        encounters.refreshPlanBudget(new RefreshEncounterPlanBudgetCommand(encounterPlanId));
        EncounterPlanBudgetResult result = planBudgetModel.current();
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

    private static PartyMemberProfile toPartyMemberFact(PartyMemberSummary member) {
        return new PartyMemberProfile(
                member == null || member.id() == null ? 0L : member.id(),
                member == null ? "" : member.name(),
                member == null ? 0 : member.level());
    }

    private static SavedEncounterPlanFact toSavedEncounterPlanFact(SavedEncounterPlanChoice plan) {
        return new SavedEncounterPlanFact(
                plan == null ? 0L : plan.id(),
                plan == null ? "" : plan.name(),
                plan == null ? "" : plan.summaryText());
    }
}
