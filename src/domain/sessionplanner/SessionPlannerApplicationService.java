package src.domain.sessionplanner;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.sessionplanner.application.AddSessionLootPlaceholderUseCase;
import src.domain.sessionplanner.application.AddSessionParticipantUseCase;
import src.domain.sessionplanner.application.AttachSessionEncounterUseCase;
import src.domain.sessionplanner.application.ClearSessionRestGapUseCase;
import src.domain.sessionplanner.application.CreateSessionPlanUseCase;
import src.domain.sessionplanner.application.CurrentSessionPlanRuntimeAccess;
import src.domain.sessionplanner.application.MoveSessionEncounterDownUseCase;
import src.domain.sessionplanner.application.MoveSessionEncounterUpUseCase;
import src.domain.sessionplanner.application.RefreshSessionPlanUseCase;
import src.domain.sessionplanner.application.RemoveSessionEncounterUseCase;
import src.domain.sessionplanner.application.RemoveSessionLootPlaceholderUseCase;
import src.domain.sessionplanner.application.RemoveSessionParticipantUseCase;
import src.domain.sessionplanner.application.SelectSessionEncounterUseCase;
import src.domain.sessionplanner.application.SetSessionEncounterAllocationUseCase;
import src.domain.sessionplanner.application.SetSessionEncounterDaysUseCase;
import src.domain.sessionplanner.application.SetSessionRestGapUseCase;
import src.domain.sessionplanner.published.AddSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.AddSessionParticipantCommand;
import src.domain.sessionplanner.published.AttachSessionEncounterCommand;
import src.domain.sessionplanner.published.ClearSessionRestGapCommand;
import src.domain.sessionplanner.published.CreateSessionPlanCommand;
import src.domain.sessionplanner.published.LoadSessionPlannerQuery;
import src.domain.sessionplanner.published.MoveSessionEncounterDownCommand;
import src.domain.sessionplanner.published.MoveSessionEncounterUpCommand;
import src.domain.sessionplanner.published.RefreshSessionPlannerCommand;
import src.domain.sessionplanner.published.RemoveSessionEncounterCommand;
import src.domain.sessionplanner.published.RemoveSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.RemoveSessionParticipantCommand;
import src.domain.sessionplanner.published.SelectSessionEncounterCommand;
import src.domain.sessionplanner.published.SessionPlannerModel;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SessionPlannerSnapshot;
import src.domain.sessionplanner.published.SetSessionEncounterAllocationCommand;
import src.domain.sessionplanner.published.SetSessionEncounterDaysCommand;
import src.domain.sessionplanner.published.SetSessionRestGapCommand;
import src.domain.sessionplanner.session.aggregate.SessionPlan;
import src.domain.sessionplanner.session.port.SessionEncounterFactsLookup;
import src.domain.sessionplanner.session.port.SessionPartyFactsLookup;
import src.domain.sessionplanner.session.port.SessionPlanRepository;
import src.domain.sessionplanner.session.value.SessionEncounter;
import src.domain.sessionplanner.session.value.SessionRestPlacement;

public final class SessionPlannerApplicationService {

    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final List<Consumer<SessionPlannerSnapshot>> sessionListeners = new ArrayList<>();
    private final SessionPlannerModel sessionModel = new SessionPlannerModel(
            this::currentSessionSnapshot,
            this::subscribeSessionListener);
    private final CurrentSessionPlanRuntimeAccess runtime;
    private final CreateSessionPlanUseCase createSessionUseCase;
    private final RefreshSessionPlanUseCase refreshSessionUseCase;
    private final AddSessionParticipantUseCase addParticipantUseCase;
    private final RemoveSessionParticipantUseCase removeParticipantUseCase;
    private final SetSessionEncounterDaysUseCase setEncounterDaysUseCase;
    private final AttachSessionEncounterUseCase attachEncounterUseCase;
    private final RemoveSessionEncounterUseCase removeEncounterUseCase;
    private final MoveSessionEncounterUpUseCase moveEncounterUpUseCase;
    private final MoveSessionEncounterDownUseCase moveEncounterDownUseCase;
    private final SetSessionEncounterAllocationUseCase setEncounterAllocationUseCase;
    private final SelectSessionEncounterUseCase selectEncounterUseCase;
    private final SetSessionRestGapUseCase setRestGapUseCase;
    private final ClearSessionRestGapUseCase clearRestGapUseCase;
    private final AddSessionLootPlaceholderUseCase addLootPlaceholderUseCase;
    private final RemoveSessionLootPlaceholderUseCase removeLootPlaceholderUseCase;

    public SessionPlannerApplicationService(
            SessionPlanRepository repository,
            SessionPartyFactsLookup partyFacts,
            SessionEncounterFactsLookup encounterFacts
    ) {
        this.runtime = new CurrentSessionPlanRuntimeAccess(
                Objects.requireNonNull(repository, "repository"),
                Objects.requireNonNull(partyFacts, "partyFacts"),
                Objects.requireNonNull(encounterFacts, "encounterFacts"));
        this.createSessionUseCase = new CreateSessionPlanUseCase(runtime);
        this.refreshSessionUseCase = new RefreshSessionPlanUseCase(runtime);
        this.addParticipantUseCase = new AddSessionParticipantUseCase(runtime);
        this.removeParticipantUseCase = new RemoveSessionParticipantUseCase(runtime);
        this.setEncounterDaysUseCase = new SetSessionEncounterDaysUseCase(runtime);
        this.attachEncounterUseCase = new AttachSessionEncounterUseCase(runtime);
        this.removeEncounterUseCase = new RemoveSessionEncounterUseCase(runtime);
        this.moveEncounterUpUseCase = new MoveSessionEncounterUpUseCase(runtime);
        this.moveEncounterDownUseCase = new MoveSessionEncounterDownUseCase(runtime);
        this.setEncounterAllocationUseCase = new SetSessionEncounterAllocationUseCase(runtime);
        this.selectEncounterUseCase = new SelectSessionEncounterUseCase(runtime);
        this.setRestGapUseCase = new SetSessionRestGapUseCase(runtime);
        this.clearRestGapUseCase = new ClearSessionRestGapUseCase(runtime);
        this.addLootPlaceholderUseCase = new AddSessionLootPlaceholderUseCase(runtime);
        this.removeLootPlaceholderUseCase = new RemoveSessionLootPlaceholderUseCase(runtime);
    }

    public SessionPlannerModel loadSession(LoadSessionPlannerQuery query) {
        Objects.requireNonNull(query, "query");
        currentSessionSnapshot();
        return sessionModel;
    }

    public void createSession(CreateSessionPlanCommand command) {
        createSessionUseCase.execute();
        publishCurrentSnapshot();
    }

    public void refreshSession(RefreshSessionPlannerCommand command) {
        refreshSessionUseCase.execute();
        publishCurrentSnapshot();
    }

    public void addParticipant(AddSessionParticipantCommand command) {
        AddSessionParticipantCommand effective = command == null
                ? new AddSessionParticipantCommand(0L)
                : command;
        addParticipantUseCase.execute(effective.characterId());
        publishCurrentSnapshot();
    }

    public void removeParticipant(RemoveSessionParticipantCommand command) {
        RemoveSessionParticipantCommand effective = command == null
                ? new RemoveSessionParticipantCommand(0L)
                : command;
        removeParticipantUseCase.execute(effective.characterId());
        publishCurrentSnapshot();
    }

    public void setEncounterDays(SetSessionEncounterDaysCommand command) {
        SetSessionEncounterDaysCommand effective = command == null
                ? new SetSessionEncounterDaysCommand(BigDecimal.ONE)
                : command;
        setEncounterDaysUseCase.execute(effective.encounterDays());
        publishCurrentSnapshot();
    }

    public void attachEncounter(AttachSessionEncounterCommand command) {
        AttachSessionEncounterCommand effective = command == null
                ? new AttachSessionEncounterCommand(0L)
                : command;
        attachEncounterUseCase.execute(effective.encounterPlanId());
        publishCurrentSnapshot();
    }

    public void removeEncounter(RemoveSessionEncounterCommand command) {
        RemoveSessionEncounterCommand effective = command == null
                ? new RemoveSessionEncounterCommand(0L)
                : command;
        removeEncounterUseCase.execute(effective.encounterId());
        publishCurrentSnapshot();
    }

    public void moveEncounterUp(MoveSessionEncounterUpCommand command) {
        MoveSessionEncounterUpCommand effective = command == null
                ? new MoveSessionEncounterUpCommand(0L)
                : command;
        moveEncounterUpUseCase.execute(effective.encounterId());
        publishCurrentSnapshot();
    }

    public void moveEncounterDown(MoveSessionEncounterDownCommand command) {
        MoveSessionEncounterDownCommand effective = command == null
                ? new MoveSessionEncounterDownCommand(0L)
                : command;
        moveEncounterDownUseCase.execute(effective.encounterId());
        publishCurrentSnapshot();
    }

    public void setEncounterAllocation(SetSessionEncounterAllocationCommand command) {
        SetSessionEncounterAllocationCommand effective = command == null
                ? new SetSessionEncounterAllocationCommand(0L, BigDecimal.ZERO)
                : command;
        setEncounterAllocationUseCase.execute(effective.encounterId(), effective.budgetPercentage());
        publishCurrentSnapshot();
    }

    public void selectEncounter(SelectSessionEncounterCommand command) {
        SelectSessionEncounterCommand effective = command == null
                ? new SelectSessionEncounterCommand(0L)
                : command;
        selectEncounterUseCase.execute(effective.encounterId());
        publishCurrentSnapshot();
    }

    public void setRestGap(SetSessionRestGapCommand command) {
        SetSessionRestGapCommand effective = command == null
                ? new SetSessionRestGapCommand(0L, 0L, SessionPlannerRestKind.NONE)
                : command;
        if (effective.restKind() == SessionPlannerRestKind.NONE) {
            clearRestGapUseCase.execute(effective.leftEncounterId(), effective.rightEncounterId());
        } else {
            setRestGapUseCase.execute(toRestPlacement(effective));
        }
        publishCurrentSnapshot();
    }

    public void clearRestGap(ClearSessionRestGapCommand command) {
        ClearSessionRestGapCommand effective = command == null
                ? new ClearSessionRestGapCommand(0L, 0L)
                : command;
        clearRestGapUseCase.execute(effective.leftEncounterId(), effective.rightEncounterId());
        publishCurrentSnapshot();
    }

    public void addLootPlaceholder(AddSessionLootPlaceholderCommand command) {
        addLootPlaceholderUseCase.execute();
        publishCurrentSnapshot();
    }

    public void removeLootPlaceholder(RemoveSessionLootPlaceholderCommand command) {
        RemoveSessionLootPlaceholderCommand effective = command == null
                ? new RemoveSessionLootPlaceholderCommand(0L)
                : command;
        removeLootPlaceholderUseCase.execute(effective.lootId());
        publishCurrentSnapshot();
    }

    private void publishCurrentSnapshot() {
        SessionPlannerSnapshot snapshot = currentSessionSnapshot();
        notifySessionListeners(snapshot);
    }

    private SessionPlannerSnapshot currentSessionSnapshot() {
        SessionPlan session = runtime.loadOrCreateCurrent();
        SessionPartyFactsLookup.ActivePartyMembersFact partyMembersFact = runtime.partyFacts().loadActivePartyMembers();
        List<SessionPlannerSnapshot.SessionParticipant> participants = buildParticipants(session, partyMembersFact);
        List<Integer> resolvedLevels = participants.stream()
                .filter(SessionPlannerSnapshot.SessionParticipant::available)
                .map(SessionPlannerSnapshot.SessionParticipant::level)
                .toList();
        boolean sessionReady = !participants.isEmpty()
                && participants.stream().allMatch(SessionPlannerSnapshot.SessionParticipant::available);
        Map<Long, SessionEncounterFactsLookup.EncounterPlanFact> loadedEncounters = loadSessionEncounterFacts(session);
        SessionPartyFactsLookup.AdventuringDayFact budgetFact = sessionReady
                ? runtime.partyFacts().calculateAdventuringDay(resolvedLevels, plannedEncounterXp(session, loadedEncounters))
                : SessionPartyFactsLookup.AdventuringDayFact.unavailable();
        int scaledBudgetXp = budgetFact.available() ? session.encounterDays().scaleBudget(budgetFact.totalBudgetXp()) : 0;
        SessionEncounterFactsLookup.EncounterPlanListFact encounterPlansFact = runtime.encounterFacts().listEncounterPlans();
        List<SessionPlannerSnapshot.AvailableEncounterPlan> availablePlans = buildAvailablePlans(encounterPlansFact, loadedEncounters);
        List<SessionPlannerSnapshot.PlannedEncounter> plannedEncounters =
                buildPlannedEncounters(session, scaledBudgetXp, loadedEncounters);
        int placedShortRests = countShortRests(session.restPlacements());
        int placedLongRests = countLongRests(session.restPlacements());
        return new SessionPlannerSnapshot(
                buildPartyState(session, resolvedLevels, participants, partyMembersFact),
                new SessionPlannerSnapshot.SessionState(
                        session.sessionId(),
                        session.encounterDays().value(),
                        session.encounterDays().displayText(),
                        session.selectedEncounterId(),
                        session.selectedEncounterId() > 0L),
                buildXpBudgetState(session, budgetFact, scaledBudgetXp, loadedEncounters),
                buildRestAdviceState(budgetFact, placedShortRests, placedLongRests),
                SessionPlannerSnapshot.GoldBudgetState.placeholder(session.lootPlaceholders().size()),
                availablePlans,
                buildActivePartyMembers(partyMembersFact.members()),
                participants,
                plannedEncounters,
                buildRestGaps(session),
                session.lootPlaceholders().stream()
                        .map(loot -> new SessionPlannerSnapshot.LootPlaceholder(loot.lootId(), loot.label()))
                        .toList(),
                resolveStatus(participants, partyMembersFact, encounterPlansFact, session.statusText()));
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

    private static SessionPlannerSnapshot.PartyState buildPartyState(
            SessionPlan session,
            List<Integer> resolvedLevels,
            List<SessionPlannerSnapshot.SessionParticipant> participants,
            SessionPartyFactsLookup.ActivePartyMembersFact partyMembersFact
    ) {
        int sessionSize = session.participantRefs().size();
        int averageLevel = resolvedLevels.isEmpty()
                ? 0
                : (int) Math.round(resolvedLevels.stream().mapToInt(Integer::intValue).average().orElse(0.0));
        String headline = sessionSize <= 0
                ? "Keine Session-Teilnehmer"
                : sessionSize + " Session-Teilnehmer";
        String detail;
        if (sessionSize <= 0) {
            detail = "Session hat noch keine Teilnehmer.";
        } else if (!partyMembersFact.available()) {
            detail = partyMembersFact.statusText().isBlank()
                    ? "Aktive Party ist derzeit nicht lesbar."
                    : partyMembersFact.statusText();
        } else {
            long missing = participants.stream().filter(participant -> !participant.available()).count();
            if (missing > 0) {
                detail = resolvedLevels.size() + " aufgeloest · " + missing + " fehlend";
            } else {
                detail = "Durchschnittsstufe " + averageLevel + " · Level " + joinLevels(resolvedLevels);
            }
        }
        return new SessionPlannerSnapshot.PartyState(
                resolvedLevels,
                sessionSize,
                averageLevel,
                sessionSize > 0 && participants.stream().allMatch(SessionPlannerSnapshot.SessionParticipant::available),
                headline,
                detail);
    }

    private static SessionPlannerSnapshot.XpBudgetState buildXpBudgetState(
            SessionPlan session,
            SessionPartyFactsLookup.AdventuringDayFact budgetFact,
            int scaledBudgetXp,
            Map<Long, SessionEncounterFactsLookup.EncounterPlanFact> loadedEncounters
    ) {
        if (!budgetFact.available()) {
            return SessionPlannerSnapshot.XpBudgetState.empty();
        }
        int plannedXp = plannedEncounterXp(session, loadedEncounters);
        int remainingXp = Math.max(0, scaledBudgetXp - plannedXp);
        int overBudgetXp = Math.max(0, plannedXp - scaledBudgetXp);
        boolean overBudget = overBudgetXp > 0;
        return new SessionPlannerSnapshot.XpBudgetState(
                true,
                scaledBudgetXp,
                plannedXp,
                remainingXp,
                overBudgetXp,
                session.encounterDays().scaleBudget(budgetFact.firstShortRestXp()),
                session.encounterDays().scaleBudget(budgetFact.secondShortRestXp()),
                scaledBudgetXp <= 0 ? 0.0 : plannedXp / (double) scaledBudgetXp,
                overBudget,
                overBudget ? overBudgetXp + " XP ueber Budget" : remainingXp + " XP verbleibend");
    }

    private static SessionPlannerSnapshot.RestAdviceState buildRestAdviceState(
            SessionPartyFactsLookup.AdventuringDayFact budgetFact,
            int placedShortRests,
            int placedLongRests
    ) {
        if (!budgetFact.available()) {
            return SessionPlannerSnapshot.RestAdviceState.empty();
        }
        return new SessionPlannerSnapshot.RestAdviceState(
                true,
                budgetFact.recommendedShortRests(),
                budgetFact.recommendedLongRests(),
                placedShortRests,
                placedLongRests,
                "Empfohlen " + budgetFact.recommendedShortRests() + " SR / " + budgetFact.recommendedLongRests()
                        + " LR · platziert " + placedShortRests + " SR / " + placedLongRests + " LR");
    }

    private List<SessionPlannerSnapshot.AvailableEncounterPlan> buildAvailablePlans(
            SessionEncounterFactsLookup.EncounterPlanListFact encounterPlansFact,
            Map<Long, SessionEncounterFactsLookup.EncounterPlanFact> loadedEncounters
    ) {
        if (!encounterPlansFact.available()) {
            return List.of();
        }
        List<SessionPlannerSnapshot.AvailableEncounterPlan> availablePlans = new ArrayList<>();
        for (SessionEncounterFactsLookup.SavedEncounterPlanFact plan : encounterPlansFact.plans()) {
            SessionEncounterFactsLookup.EncounterPlanFact detail = runtime.encounterFacts().loadEncounterPlan(plan.planId());
            loadedEncounters.put(plan.planId(), detail);
            availablePlans.add(new SessionPlannerSnapshot.AvailableEncounterPlan(
                    plan.planId(),
                    detail.name().isBlank() ? plan.name() : detail.name(),
                    detail.generatedLabel().isBlank() ? plan.generatedLabel() : detail.generatedLabel(),
                    detail.creatureCount() <= 0 ? plan.creatureCount() : detail.creatureCount(),
                    detail.adjustedXp(),
                    detail.difficultyLabel(),
                    detail.statusText(),
                    detail.available()));
        }
        return List.copyOf(availablePlans);
    }

    private Map<Long, SessionEncounterFactsLookup.EncounterPlanFact> loadSessionEncounterFacts(SessionPlan session) {
        Map<Long, SessionEncounterFactsLookup.EncounterPlanFact> loadedEncounters = new HashMap<>();
        for (SessionEncounter encounter : session.encounters()) {
            loadedEncounters.computeIfAbsent(encounter.encounterPlanId(), runtime.encounterFacts()::loadEncounterPlan);
        }
        return loadedEncounters;
    }

    private static List<SessionPlannerSnapshot.SessionParticipant> buildParticipants(
            SessionPlan session,
            SessionPartyFactsLookup.ActivePartyMembersFact activeMembers
    ) {
        List<SessionPlannerSnapshot.SessionParticipant> participants = new ArrayList<>();
        for (Long participantRef : session.participantRefs()) {
            SessionPartyFactsLookup.PartyMemberProfile member = activeMembers.resolve(participantRef);
            if (member == null) {
                participants.add(new SessionPlannerSnapshot.SessionParticipant(
                        participantRef,
                        "Charakter #" + participantRef,
                        0,
                        false,
                        "Nicht mehr in der aktiven Party verfuegbar."));
            } else {
                participants.add(new SessionPlannerSnapshot.SessionParticipant(
                        member.characterId(),
                        member.displayName(),
                        member.currentLevel(),
                        true,
                        ""));
            }
        }
        return List.copyOf(participants);
    }

    private static List<SessionPlannerSnapshot.ActivePartyMember> buildActivePartyMembers(
            List<SessionPartyFactsLookup.PartyMemberProfile> members
    ) {
        List<SessionPlannerSnapshot.ActivePartyMember> activePartyMembers = new ArrayList<>();
        for (SessionPartyFactsLookup.PartyMemberProfile member
                : members == null ? List.<SessionPartyFactsLookup.PartyMemberProfile>of() : members) {
            activePartyMembers.add(new SessionPlannerSnapshot.ActivePartyMember(
                    member.characterId(),
                    member.displayName(),
                    member.currentLevel()));
        }
        return List.copyOf(activePartyMembers);
    }

    private List<SessionPlannerSnapshot.PlannedEncounter> buildPlannedEncounters(
            SessionPlan session,
            int scaledBudgetXp,
            Map<Long, SessionEncounterFactsLookup.EncounterPlanFact> loadedEncounters
    ) {
        List<SessionPlannerSnapshot.PlannedEncounter> plannedEncounters = new ArrayList<>();
        for (SessionEncounter encounter : session.encounters()) {
            SessionEncounterFactsLookup.EncounterPlanFact detail = loadedEncounters.computeIfAbsent(
                    encounter.encounterPlanId(),
                    runtime.encounterFacts()::loadEncounterPlan);
            int targetXp = encounter.allocation().budgetPercentage()
                    .multiply(BigDecimal.valueOf(scaledBudgetXp))
                    .divide(HUNDRED, 0, RoundingMode.HALF_UP)
                    .intValue();
            plannedEncounters.add(new SessionPlannerSnapshot.PlannedEncounter(
                    encounter.encounterId(),
                    encounter.encounterPlanId(),
                    detail.name(),
                    detail.generatedLabel(),
                    detail.creatureCount(),
                    detail.totalBaseXp(),
                    detail.adjustedXp(),
                    detail.xpMultiplier(),
                    detail.difficultyLabel(),
                    encounter.allocation().budgetPercentage(),
                    targetXp,
                    session.selectedEncounterId() == encounter.encounterId()));
        }
        return List.copyOf(plannedEncounters);
    }

    private static List<SessionPlannerSnapshot.RestGap> buildRestGaps(SessionPlan session) {
        List<SessionPlannerSnapshot.RestGap> gaps = new ArrayList<>();
        List<SessionEncounter> encounters = session.encounters();
        for (int index = 0; index < encounters.size() - 1; index++) {
            SessionEncounter left = encounters.get(index);
            SessionEncounter right = encounters.get(index + 1);
            gaps.add(new SessionPlannerSnapshot.RestGap(
                    index,
                    left.encounterId(),
                    right.encounterId(),
                    restKindForGap(left.encounterId(), right.encounterId(), session.restPlacements())));
        }
        return List.copyOf(gaps);
    }

    private static String resolveStatus(
            List<SessionPlannerSnapshot.SessionParticipant> participants,
            SessionPartyFactsLookup.ActivePartyMembersFact partyMembersFact,
            SessionEncounterFactsLookup.EncounterPlanListFact encounterPlansFact,
            String sessionStatusText
    ) {
        if (sessionStatusText != null && !sessionStatusText.isBlank()) {
            return sessionStatusText;
        }
        if (participants.isEmpty()) {
            return "Session hat noch keine Teilnehmer.";
        }
        boolean missingParticipants = participants.stream().anyMatch(participant -> !participant.available());
        if (missingParticipants) {
            return "Session enthaelt nicht mehr aufloesbare Teilnehmer-Referenzen.";
        }
        if (!partyMembersFact.available()) {
            return partyMembersFact.statusText().isBlank()
                    ? "Aktive Party konnte nicht geladen werden."
                    : partyMembersFact.statusText();
        }
        if (!encounterPlansFact.available()) {
            return encounterPlansFact.statusText().isBlank()
                    ? "Encounter-Plaene konnten nicht geladen werden."
                    : encounterPlansFact.statusText();
        }
        if (encounterPlansFact.plans().isEmpty()) {
            return "Keine gespeicherten Encounter-Plaene gefunden.";
        }
        return "";
    }

    private static int plannedEncounterXp(
            SessionPlan session,
            Map<Long, SessionEncounterFactsLookup.EncounterPlanFact> loadedEncounters
    ) {
        return session.encounters().stream()
                .mapToInt(encounter -> loadedEncounters.getOrDefault(
                        encounter.encounterPlanId(),
                        SessionEncounterFactsLookup.EncounterPlanFact.unavailable(
                                encounter.encounterPlanId(),
                                "Encounter-Plan fehlt.")).adjustedXp())
                .sum();
    }

    private static int countShortRests(List<SessionRestPlacement> placements) {
        return (int) placements.stream()
                .filter(SessionRestPlacement::isShortRest)
                .count();
    }

    private static int countLongRests(List<SessionRestPlacement> placements) {
        return (int) placements.stream()
                .filter(SessionRestPlacement::isLongRest)
                .count();
    }

    private static SessionPlannerRestKind restKindForGap(
            long leftEncounterId,
            long rightEncounterId,
            List<SessionRestPlacement> placements
    ) {
        for (SessionRestPlacement placement : placements) {
            if (!placement.matchesGap(leftEncounterId, rightEncounterId)) {
                continue;
            }
            return placement.isLongRest()
                    ? SessionPlannerRestKind.LONG_REST
                    : SessionPlannerRestKind.SHORT_REST;
        }
        return SessionPlannerRestKind.NONE;
    }

    private static String joinLevels(List<Integer> levels) {
        return levels.stream()
                .map(String::valueOf)
                .reduce((left, right) -> left + ", " + right)
                .orElse("-");
    }

    private static SessionRestPlacement toRestPlacement(SetSessionRestGapCommand command) {
        return switch (command.restKind()) {
            case SHORT_REST -> SessionRestPlacement.shortRestBetween(command.leftEncounterId(), command.rightEncounterId());
            case LONG_REST -> SessionRestPlacement.longRestBetween(command.leftEncounterId(), command.rightEncounterId());
            case NONE -> SessionRestPlacement.shortRestBetween(command.leftEncounterId(), command.rightEncounterId());
        };
    }
}
