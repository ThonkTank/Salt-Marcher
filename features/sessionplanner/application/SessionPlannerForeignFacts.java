package features.sessionplanner.application;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import org.jspecify.annotations.Nullable;
import features.encounter.api.EncounterApi;
import features.encounter.api.EncounterPlanBudgetModel;
import features.encounter.api.EncounterPlanBudgetResult;
import features.encounter.api.EncounterPlanBudgetStatus;
import features.encounter.api.EncounterPlanBudgetSummary;
import features.encounter.api.RefreshEncounterPlanBudgetCommand;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encounter.api.SavedEncounterPlanListResult;
import features.encounter.api.SavedEncounterPlanStatus;
import features.encounter.api.SavedEncounterPlanSummary;
import features.party.api.PartyApi;
import features.party.api.ActivePartyModel;
import features.party.api.ActivePartyResult;
import features.party.api.AdventuringDayCalculationModel;
import features.party.api.AdventuringDayCalculationResult;
import features.party.api.AdventuringDayPlanningSummary;
import features.party.api.CalculateAdventuringDayCommand;
import features.party.api.PartyMemberSummary;
import features.party.api.ReadStatus;
import features.sessionplanner.domain.session.SessionActivePartyMembersFact;
import features.sessionplanner.domain.session.SessionAdventuringDayBudgetFact;
import features.sessionplanner.domain.session.SessionEncounterPlanFact;
import features.sessionplanner.domain.session.SessionEncounterPlanListFact;
import features.sessionplanner.domain.session.SessionLocationReference;
import features.sessionplanner.domain.session.SessionPartyMemberProfile;
import features.sessionplanner.domain.session.SessionSavedEncounterPlanFact;
import features.worldplanner.api.WorldPlannerSnapshotModel;

public final class SessionPlannerForeignFacts {

    private static final long NO_LOCATION_ID = 0L;

    private final PartyApi party;
    private final ActivePartyModel activeParty;
    private final AdventuringDayCalculationModel adventuringDay;
    private final EncounterApi encounters;
    private final SavedEncounterPlanListModel savedPlans;
    private final EncounterPlanBudgetModel planBudget;
    private final @Nullable WorldPlannerSnapshotModel worldPlanner;

    public SessionPlannerForeignFacts(
            PartyApi party,
            ActivePartyModel activePartyModel,
            AdventuringDayCalculationModel adventuringDayCalculationModel,
            EncounterApi encounters,
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

    public void subscribeLocationRefresh(Runnable refresh) {
        if (worldPlanner != null) {
            worldPlanner.subscribe(ignored -> refresh.run());
        }
    }

    public void subscribePartyRefresh(Runnable refresh) {
        Objects.requireNonNull(refresh, "refresh");
        AtomicReference<PartyGenerationFacts> previous = new AtomicReference<>(
                PartyGenerationFacts.from(activeParty.current()));
        activeParty.subscribe(result -> {
            PartyGenerationFacts current = PartyGenerationFacts.from(result);
            if (!current.equals(previous.getAndSet(current))) {
                refresh.run();
            }
        });
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

    private record PartyGenerationFacts(
            ReadStatus status,
            List<MemberGenerationFacts> members
    ) {

        private static PartyGenerationFacts from(ActivePartyResult result) {
            if (result == null) {
                return new PartyGenerationFacts(ReadStatus.STORAGE_ERROR, List.of());
            }
            return new PartyGenerationFacts(
                    result.status(),
                    result.members().stream()
                            .map(member -> new MemberGenerationFacts(
                                    member == null || member.id() == null ? 0L : member.id(),
                                    member == null ? 0 : member.level()))
                            .sorted(java.util.Comparator.comparingLong(MemberGenerationFacts::id))
                            .toList());
        }
    }

    private record MemberGenerationFacts(long id, int level) {
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
