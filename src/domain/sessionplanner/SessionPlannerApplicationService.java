package src.domain.sessionplanner;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.ListSavedEncounterPlansQuery;
import src.domain.encounter.published.LoadEncounterPlanBudgetQuery;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.SavedEncounterPlanSummary;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyCompositionResult;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.CalculateAdventuringDayQuery;
import src.domain.party.published.LoadActivePartyCompositionQuery;
import src.domain.party.published.ReadStatus;
import src.domain.sessionplanner.published.ApplySessionPlannerCommand;
import src.domain.sessionplanner.published.LoadSessionPlannerQuery;
import src.domain.sessionplanner.published.SessionPlannerModel;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SessionPlannerSnapshot;

public final class SessionPlannerApplicationService {

    private final PartyApplicationService party;
    private final EncounterApplicationService encounters;
    private final List<Consumer<SessionPlannerSnapshot>> sessionListeners = new ArrayList<>();
    private final SessionPlannerModel sessionModel = new SessionPlannerModel(
            this::currentSessionSnapshot,
            this::subscribeSessionListener);
    private final PlannerSession session = new PlannerSession();

    public SessionPlannerApplicationService(
            PartyApplicationService party,
            EncounterApplicationService encounters
    ) {
        this.party = Objects.requireNonNull(party, "party");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
    }

    public SessionPlannerModel loadSession(LoadSessionPlannerQuery query) {
        Objects.requireNonNull(query, "query");
        return sessionModel;
    }

    public SessionPlannerSnapshot applySession(ApplySessionPlannerCommand command) {
        ApplySessionPlannerCommand effective = command == null
                ? new ApplySessionPlannerCommand(
                        ApplySessionPlannerCommand.Action.REFRESH,
                        0L,
                        0L,
                        -1,
                        SessionPlannerRestKind.NONE,
                        0L)
                : command;
        session.apply(effective);
        SessionPlannerSnapshot snapshot = currentSessionSnapshot();
        notifySessionListeners(snapshot);
        return snapshot;
    }

    private SessionPlannerSnapshot currentSessionSnapshot() {
        return session.snapshot();
    }

    private Runnable subscribeSessionListener(Consumer<SessionPlannerSnapshot> listener) {
        Consumer<SessionPlannerSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
        sessionListeners.add(safeListener);
        return () -> sessionListeners.remove(safeListener);
    }

    private void notifySessionListeners(SessionPlannerSnapshot snapshot) {
        List<Consumer<SessionPlannerSnapshot>> listeners = List.copyOf(sessionListeners);
        for (Consumer<SessionPlannerSnapshot> listener : listeners) {
            listener.accept(snapshot);
        }
    }

    private final class PlannerSession {

        private final List<EncounterEntry> plannedEncounters = new ArrayList<>();
        private final List<SessionPlannerRestKind> restGaps = new ArrayList<>();
        private final List<LootEntry> lootPlaceholders = new ArrayList<>();
        private long nextEncounterToken = 1L;
        private long nextLootToken = 1L;
        private String status = "";

        void apply(ApplySessionPlannerCommand command) {
            switch (command.action()) {
                case REFRESH -> status = "";
                case IMPORT_ENCOUNTER_PLAN -> importEncounterPlan(command.encounterPlanId());
                case REMOVE_ENCOUNTER -> removeEncounter(command.encounterToken());
                case MOVE_ENCOUNTER_UP -> moveEncounter(command.encounterToken(), -1);
                case MOVE_ENCOUNTER_DOWN -> moveEncounter(command.encounterToken(), 1);
                case SET_REST_GAP -> setRestGap(command.gapIndex(), command.restKind());
                case CLEAR_REST_GAP -> clearRestGap(command.gapIndex());
                case ADD_LOOT_PLACEHOLDER -> addLootPlaceholder();
                case REMOVE_LOOT_PLACEHOLDER -> removeLootPlaceholder(command.lootToken());
            }
        }

        SessionPlannerSnapshot snapshot() {
            ActivePartyCompositionResult compositionResult =
                    party.loadActivePartyComposition(new LoadActivePartyCompositionQuery());
            SessionPlannerSnapshot.PartyState partyState = partyState(compositionResult);
            List<SessionPlannerSnapshot.AvailableEncounterPlan> availablePlans =
                    loadAvailableEncounterPlans(partyState.ready());
            return new SessionPlannerSnapshot(
                    partyState,
                    xpBudgetState(partyState.activePartyLevels()),
                    restAdviceState(partyState.activePartyLevels()),
                    SessionPlannerSnapshot.GoldBudgetState.placeholder(lootPlaceholders.size()),
                    availablePlans,
                    plannedEncounters.stream().map(EncounterEntry::toSnapshot).toList(),
                    restGapSnapshots(),
                    lootPlaceholders.stream().map(LootEntry::toSnapshot).toList(),
                    resolvedStatus(compositionResult, availablePlans));
        }

        private SessionPlannerSnapshot.PartyState partyState(ActivePartyCompositionResult compositionResult) {
            if (compositionResult.status() != ReadStatus.SUCCESS) {
                return new SessionPlannerSnapshot.PartyState(
                        List.of(),
                        0,
                        0,
                        false,
                        "Party nicht verfuegbar",
                        "Aktive Party konnte nicht geladen werden.");
            }
            List<Integer> activeLevels = compositionResult.composition().activePartyLevels();
            if (activeLevels.isEmpty()) {
                return SessionPlannerSnapshot.PartyState.empty();
            }
            int averageLevel = compositionResult.composition().averageLevel();
            return new SessionPlannerSnapshot.PartyState(
                    activeLevels,
                    activeLevels.size(),
                    averageLevel,
                    true,
                    activeLevels.size() + " aktive Charaktere",
                    "Durchschnittsstufe " + averageLevel + " · Level " + joinLevels(activeLevels));
        }

        private List<SessionPlannerSnapshot.AvailableEncounterPlan> loadAvailableEncounterPlans(boolean partyReady) {
            SavedEncounterPlanListResult result = encounters.listPlans(new ListSavedEncounterPlansQuery());
            if (result.status() != SavedEncounterPlanStatus.SUCCESS) {
                if (!result.message().isBlank()) {
                    status = result.message();
                }
                return List.of();
            }
            List<SessionPlannerSnapshot.AvailableEncounterPlan> entries = new ArrayList<>();
            for (SavedEncounterPlanSummary plan : result.plans()) {
                if (!partyReady) {
                    entries.add(new SessionPlannerSnapshot.AvailableEncounterPlan(
                            plan.id(),
                            plan.name(),
                            plan.generatedLabel(),
                            plan.creatureCount(),
                            0,
                            "",
                            "Aktive Party fehlt",
                            false));
                    continue;
                }
                EncounterPlanBudgetResult budget = encounters.loadPlanBudget(new LoadEncounterPlanBudgetQuery(plan.id()));
                if (budget.status() == EncounterPlanBudgetStatus.SUCCESS && budget.summary() != null) {
                    entries.add(new SessionPlannerSnapshot.AvailableEncounterPlan(
                            budget.summary().planId(),
                            budget.summary().name(),
                            budget.summary().generatedLabel(),
                            budget.summary().creatureCount(),
                            budget.summary().adjustedXp(),
                            budget.summary().difficultyLabel(),
                            "Adj. XP " + budget.summary().adjustedXp() + " · " + budget.summary().difficultyLabel(),
                            true));
                } else {
                    entries.add(new SessionPlannerSnapshot.AvailableEncounterPlan(
                            plan.id(),
                            plan.name(),
                            plan.generatedLabel(),
                            plan.creatureCount(),
                            0,
                            "",
                            budget.message().isBlank() ? budget.status().name() : budget.message(),
                            false));
                }
            }
            return List.copyOf(entries);
        }

        private SessionPlannerSnapshot.XpBudgetState xpBudgetState(List<Integer> activePartyLevels) {
            if (activePartyLevels == null || activePartyLevels.isEmpty()) {
                return SessionPlannerSnapshot.XpBudgetState.empty();
            }
            AdventuringDayCalculationResult calculation =
                    party.calculateAdventuringDay(new CalculateAdventuringDayQuery(activePartyLevels, plannedEncounterXp()));
            if (calculation.status() != ReadStatus.SUCCESS || calculation.calculation() == null) {
                return SessionPlannerSnapshot.XpBudgetState.empty();
            }
            int totalBudgetXp = calculation.calculation().budget().totalBudgetXp();
            int plannedXp = plannedEncounterXp();
            int remaining = Math.max(0, totalBudgetXp - plannedXp);
            int overBudget = Math.max(0, plannedXp - totalBudgetXp);
            boolean over = overBudget > 0;
            return new SessionPlannerSnapshot.XpBudgetState(
                    true,
                    totalBudgetXp,
                    plannedXp,
                    remaining,
                    overBudget,
                    calculation.calculation().budget().firstShortRestXp(),
                    calculation.calculation().budget().secondShortRestXp(),
                    totalBudgetXp <= 0 ? 0.0 : plannedXp / (double) totalBudgetXp,
                    over,
                    over ? overBudget + " XP ueber Budget" : remaining + " XP verbleibend");
        }

        private SessionPlannerSnapshot.RestAdviceState restAdviceState(List<Integer> activePartyLevels) {
            if (activePartyLevels == null || activePartyLevels.isEmpty()) {
                return SessionPlannerSnapshot.RestAdviceState.empty();
            }
            AdventuringDayCalculationResult calculation =
                    party.calculateAdventuringDay(new CalculateAdventuringDayQuery(activePartyLevels, plannedEncounterXp()));
            if (calculation.status() != ReadStatus.SUCCESS || calculation.calculation() == null) {
                return SessionPlannerSnapshot.RestAdviceState.empty();
            }
            int placedShortRests = (int) restGaps.stream().filter(kind -> kind == SessionPlannerRestKind.SHORT_REST).count();
            int placedLongRests = (int) restGaps.stream().filter(kind -> kind == SessionPlannerRestKind.LONG_REST).count();
            int recommendedShortRests = calculation.calculation().progress().shortRests();
            int recommendedLongRests = calculation.calculation().progress().longRests();
            return new SessionPlannerSnapshot.RestAdviceState(
                    true,
                    recommendedShortRests,
                    recommendedLongRests,
                    placedShortRests,
                    placedLongRests,
                    "Empfohlen " + recommendedShortRests + " SR / " + recommendedLongRests
                            + " LR · platziert " + placedShortRests + " SR / " + placedLongRests + " LR");
        }

        private List<SessionPlannerSnapshot.RestGap> restGapSnapshots() {
            List<SessionPlannerSnapshot.RestGap> gaps = new ArrayList<>(restGaps.size());
            for (int index = 0; index < restGaps.size(); index++) {
                gaps.add(new SessionPlannerSnapshot.RestGap(index, restGaps.get(index)));
            }
            return List.copyOf(gaps);
        }

        private String resolvedStatus(
                ActivePartyCompositionResult compositionResult,
                List<SessionPlannerSnapshot.AvailableEncounterPlan> availablePlans
        ) {
            if (!status.isBlank()) {
                return status;
            }
            if (compositionResult.status() != ReadStatus.SUCCESS) {
                return "Aktive Party konnte nicht geladen werden.";
            }
            if (compositionResult.composition().activePartyLevels().isEmpty()) {
                return "Session Planner wartet auf eine aktive Party.";
            }
            if (availablePlans.isEmpty()) {
                return "Keine gespeicherten Encounter-Plaene gefunden.";
            }
            return "";
        }

        private void importEncounterPlan(long encounterPlanId) {
            EncounterPlanBudgetResult result = encounters.loadPlanBudget(new LoadEncounterPlanBudgetQuery(encounterPlanId));
            if (result.status() != EncounterPlanBudgetStatus.SUCCESS || result.summary() == null) {
                status = result.message().isBlank() ? "Encounter-Plan konnte nicht importiert werden." : result.message();
                return;
            }
            plannedEncounters.add(new EncounterEntry(nextEncounterToken++, result.summary()));
            reconcileRestGaps();
            status = "Encounter-Plan importiert.";
        }

        private void removeEncounter(long encounterToken) {
            int index = encounterIndex(encounterToken);
            if (index < 0) {
                return;
            }
            int previousSize = plannedEncounters.size();
            plannedEncounters.remove(index);
            if (previousSize <= 1) {
                restGaps.clear();
            } else if (index == 0) {
                restGaps.remove(0);
            } else if (index == previousSize - 1) {
                restGaps.remove(restGaps.size() - 1);
            } else {
                SessionPlannerRestKind left = restGaps.get(index - 1);
                SessionPlannerRestKind right = restGaps.get(index);
                restGaps.set(index - 1, left != SessionPlannerRestKind.NONE ? left : right);
                restGaps.remove(index);
            }
            reconcileRestGaps();
            status = "Encounter entfernt.";
        }

        private void moveEncounter(long encounterToken, int delta) {
            int index = encounterIndex(encounterToken);
            int nextIndex = index + delta;
            if (index < 0 || nextIndex < 0 || nextIndex >= plannedEncounters.size()) {
                return;
            }
            Collections.swap(plannedEncounters, index, nextIndex);
            status = "Encounter verschoben.";
        }

        private void setRestGap(int gapIndex, SessionPlannerRestKind restKind) {
            if (gapIndex < 0 || gapIndex >= restGaps.size()) {
                return;
            }
            restGaps.set(gapIndex, restKind == null ? SessionPlannerRestKind.NONE : restKind);
            status = "Rast aktualisiert.";
        }

        private void clearRestGap(int gapIndex) {
            if (gapIndex < 0 || gapIndex >= restGaps.size()) {
                return;
            }
            restGaps.set(gapIndex, SessionPlannerRestKind.NONE);
            status = "Rast entfernt.";
        }

        private void addLootPlaceholder() {
            lootPlaceholders.add(new LootEntry(nextLootToken++, "Loot-Platzhalter " + (lootPlaceholders.size() + 1)));
            status = "Loot-Platzhalter hinzugefuegt.";
        }

        private void removeLootPlaceholder(long lootToken) {
            lootPlaceholders.removeIf(entry -> entry.token == lootToken);
            status = "Loot-Platzhalter entfernt.";
        }

        private int plannedEncounterXp() {
            return plannedEncounters.stream().mapToInt(entry -> entry.adjustedXp).sum();
        }

        private int encounterIndex(long encounterToken) {
            for (int index = 0; index < plannedEncounters.size(); index++) {
                if (plannedEncounters.get(index).token == encounterToken) {
                    return index;
                }
            }
            return -1;
        }

        private void reconcileRestGaps() {
            int required = Math.max(0, plannedEncounters.size() - 1);
            while (restGaps.size() < required) {
                restGaps.add(SessionPlannerRestKind.NONE);
            }
            while (restGaps.size() > required) {
                restGaps.remove(restGaps.size() - 1);
            }
        }

        private String joinLevels(List<Integer> activePartyLevels) {
            return activePartyLevels.stream()
                    .map(String::valueOf)
                    .reduce((left, right) -> left + ", " + right)
                    .orElse("-");
        }
    }

    private record EncounterEntry(
            long token,
            long planId,
            String name,
            String generatedLabel,
            int creatureCount,
            int totalBaseXp,
            int adjustedXp,
            double xpMultiplier,
            String difficultyLabel
    ) {

        EncounterEntry(long token, src.domain.encounter.published.EncounterPlanBudgetSummary summary) {
            this(
                    token,
                    summary.planId(),
                    summary.name(),
                    summary.generatedLabel(),
                    summary.creatureCount(),
                    summary.totalBaseXp(),
                    summary.adjustedXp(),
                    summary.xpMultiplier(),
                    summary.difficultyLabel());
        }

        SessionPlannerSnapshot.PlannedEncounter toSnapshot() {
            return new SessionPlannerSnapshot.PlannedEncounter(
                    token,
                    planId,
                    name,
                    generatedLabel,
                    creatureCount,
                    totalBaseXp,
                    adjustedXp,
                    xpMultiplier,
                    difficultyLabel);
        }
    }

    private record LootEntry(
            long token,
            String label
    ) {

        SessionPlannerSnapshot.LootPlaceholder toSnapshot() {
            return new SessionPlannerSnapshot.LootPlaceholder(token, label);
        }
    }
}
