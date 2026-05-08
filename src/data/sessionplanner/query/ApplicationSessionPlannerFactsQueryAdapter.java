package src.data.sessionplanner.query;

import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;
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
    private final Supplier<SessionEncounterFactsLookup> encounterFactsSupplier;

    public ApplicationSessionPlannerFactsQueryAdapter(
            Supplier<PartyApplicationService> partySupplier,
            Supplier<ActivePartyModel> activePartyModelSupplier,
            Supplier<AdventuringDayCalculationModel> adventuringDayCalculationModelSupplier,
            Supplier<SessionEncounterFactsLookup> encounterFactsSupplier
    ) {
        this.partySupplier = Objects.requireNonNull(partySupplier, "partySupplier");
        this.activePartyModelSupplier = Objects.requireNonNull(activePartyModelSupplier, "activePartyModelSupplier");
        this.adventuringDayCalculationModelSupplier = Objects.requireNonNull(
                adventuringDayCalculationModelSupplier,
                "adventuringDayCalculationModelSupplier");
        this.encounterFactsSupplier = Objects.requireNonNull(encounterFactsSupplier, "encounterFactsSupplier");
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
        return encounterFactsSupplier.get().listEncounterPlans();
    }

    @Override
    public EncounterPlanFact loadEncounterPlan(long encounterPlanId) {
        return encounterFactsSupplier.get().loadEncounterPlan(encounterPlanId);
    }

    private static PartyMemberProfile toPartyMemberFact(PartyMemberSummary member) {
        return new PartyMemberProfile(
                member == null || member.id() == null ? 0L : member.id(),
                member == null ? "" : member.name(),
                member == null ? 0 : member.level());
    }

}
