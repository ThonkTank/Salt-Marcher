package src.domain.sessionplanner;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.EncounterPlanBudgetSummary;
import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.SavedEncounterPlanSummary;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.AdventuringDayPlanningSummary;
import src.domain.party.published.CalculateAdventuringDayCommand;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.ReadStatus;
import src.domain.sessionplanner.model.session.SessionActivePartyMembersFact;
import src.domain.sessionplanner.model.session.SessionAdventuringDayBudgetFact;
import src.domain.sessionplanner.model.session.SessionEncounterPlanFact;
import src.domain.sessionplanner.model.session.SessionEncounterPlanListFact;
import src.domain.sessionplanner.model.session.SessionLocationReference;
import src.domain.sessionplanner.model.session.SessionPartyMemberProfile;
import src.domain.sessionplanner.model.session.SessionSavedEncounterPlanFact;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

final class SessionPlannerForeignFacts {

    private static final long NO_LOCATION_ID = 0L;

    private final PartyApplicationService party;
    private final ActivePartyModel activeParty;
    private final AdventuringDayCalculationModel adventuringDay;
    private final EncounterApplicationService encounters;
    private final SavedEncounterPlanListModel savedPlans;
    private final EncounterPlanBudgetModel planBudget;
    private final @Nullable WorldPlannerSnapshotModel worldPlanner;

    SessionPlannerForeignFacts(
            PartyApplicationService party,
            ActivePartyModel activePartyModel,
            AdventuringDayCalculationModel adventuringDayCalculationModel,
            EncounterApplicationService encounters,
            SavedEncounterPlanListModel savedPlansModel,
            EncounterPlanBudgetModel planBudgetModel,
            @Nullable WorldPlannerSnapshotModel worldPlanner
    ) {
        this.party = Objects.requireNonNull(party, "party");
        activeParty = Objects.requireNonNull(activePartyModel, "activePartyModel");
        adventuringDay = Objects.requireNonNull(adventuringDayCalculationModel, "adventuringDayCalculationModel");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        savedPlans = Objects.requireNonNull(savedPlansModel, "savedPlansModel");
        planBudget = Objects.requireNonNull(planBudgetModel, "planBudgetModel");
        this.worldPlanner = worldPlanner;
    }

    SessionActivePartyMembersFact activePartyMembers() {
        return toActivePartyMembersFact(activeParty.current());
    }

    SessionAdventuringDayBudgetFact calculateAdventuringDay(List<Integer> levels, int plannedEncounterXp) {
        party.calculateAdventuringDay(new CalculateAdventuringDayCommand(levels, plannedEncounterXp));
        return toAdventuringDayFact(adventuringDay.current());
    }

    SessionEncounterPlanListFact encounterPlans() {
        return toEncounterPlanListFact(savedPlans.current());
    }

    SessionEncounterPlanFact loadEncounterPlan(long encounterPlanId) {
        encounters.refreshPlanBudget(new RefreshEncounterPlanBudgetCommand(encounterPlanId));
        return encounterPlan(encounterPlanId, planBudget.current());
    }

    List<SessionLocationReference> availableLocations() {
        if (worldPlanner == null) {
            return List.of();
        }
        return worldPlanner.current().locations().stream()
                .map(location -> new SessionLocationReference(location.locationId(), location.displayName()))
                .toList();
    }

    boolean locationExists(long locationId) {
        return locationId <= NO_LOCATION_ID || availableLocations().stream()
                .anyMatch(location -> location.locationId() == locationId);
    }

    void subscribeLocationRefresh(Runnable refresh) {
        if (worldPlanner != null) {
            worldPlanner.subscribe(ignored -> refresh.run());
        }
    }

    private static SessionEncounterPlanFact encounterPlan(
            long encounterPlanId,
            EncounterPlanBudgetResult result
    ) {
        if (result == null || result.status() != EncounterPlanBudgetStatus.SUCCESS || result.summary() == null) {
            String message = result == null || result.message().isBlank()
                    ? "Encounter-Plan konnte nicht geladen werden."
                    : result.message();
            return SessionEncounterPlanFact.unavailable(encounterPlanId, message);
        }
        EncounterPlanBudgetSummary summary = result.summary();
        return new SessionEncounterPlanFact(
                true,
                summary.planId(),
                summary.name(),
                summary.generatedLabel(),
                summary.creatureCount(),
                summary.totalBaseXp(),
                summary.adjustedXp(),
                summary.xpMultiplier(),
                summary.difficultyLabel(),
                "Adj. XP " + summary.adjustedXp() + " · " + summary.difficultyLabel());
    }

    private static SessionActivePartyMembersFact toActivePartyMembersFact(ActivePartyResult result) {
        if (result == null || result.status() != ReadStatus.SUCCESS) {
            return new SessionActivePartyMembersFact(
                    false,
                    List.of(),
                    "Aktive Party konnte nicht geladen werden.");
        }
        return new SessionActivePartyMembersFact(
                true,
                result.members().stream()
                        .map(SessionPlannerForeignFacts::toPartyMemberFact)
                        .toList(),
                "");
    }

    private static SessionAdventuringDayBudgetFact toAdventuringDayFact(AdventuringDayCalculationResult result) {
        AdventuringDayPlanningSummary summary = result == null ? null : result.planningSummary();
        if (result == null || result.status() != ReadStatus.SUCCESS || summary == null) {
            return SessionAdventuringDayBudgetFact.unavailable();
        }
        return new SessionAdventuringDayBudgetFact(
                true,
                summary.totalBudgetXp(),
                summary.firstShortRestXp(),
                summary.secondShortRestXp(),
                summary.recommendedShortRests(),
                summary.recommendedLongRests());
    }

    private static SessionPartyMemberProfile toPartyMemberFact(PartyMemberSummary member) {
        return new SessionPartyMemberProfile(
                member == null || member.id() == null ? 0L : member.id(),
                member == null ? "" : member.name(),
                member == null ? 0 : member.level());
    }

    private static SessionEncounterPlanListFact toEncounterPlanListFact(SavedEncounterPlanListResult result) {
        if (result == null || result.status() != SavedEncounterPlanStatus.SUCCESS) {
            return new SessionEncounterPlanListFact(
                    false,
                    List.of(),
                    result == null ? "" : result.message());
        }
        return new SessionEncounterPlanListFact(
                true,
                result.plans().stream()
                        .map(SessionPlannerForeignFacts::toSavedEncounterPlanFact)
                        .toList(),
                "");
    }

    private static SessionSavedEncounterPlanFact toSavedEncounterPlanFact(SavedEncounterPlanSummary plan) {
        return new SessionSavedEncounterPlanFact(
                plan == null ? 0L : plan.planId(),
                plan == null ? "" : plan.name(),
                plan == null ? "" : plan.summaryText());
    }
}
