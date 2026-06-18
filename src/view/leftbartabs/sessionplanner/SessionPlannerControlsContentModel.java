package src.view.leftbartabs.sessionplanner;

import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.sessionplanner.published.SessionPlannerParticipantsProjection;
import src.domain.sessionplanner.published.SessionPlannerSessionSnapshot;

public final class SessionPlannerControlsContentModel {

    private static final String STYLE_TEXT_SECONDARY = "text-secondary";
    private static final String STYLE_BUDGET_OK = "session-planner-budget-ok";
    private static final String STYLE_BUDGET_OVER = "session-planner-budget-over";
    private static final String XP_SUFFIX = " XP";
    private static final long NO_SESSION_ID = 0L;

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.empty());
    private SessionPlannerSessionSnapshot sessionSnapshot = SessionPlannerSessionSnapshot.empty("");
    private SessionPlannerParticipantsProjection participantsProjection = SessionPlannerParticipantsProjection.empty();

    ReadOnlyObjectProperty<Projection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void applySession(SessionPlannerSessionSnapshot snapshot) {
        sessionSnapshot = snapshot == null ? SessionPlannerSessionSnapshot.empty("") : snapshot;
        refreshProjection();
    }

    void applyParticipants(SessionPlannerParticipantsProjection projection) {
        participantsProjection = projection == null ? SessionPlannerParticipantsProjection.empty() : projection;
        refreshProjection();
    }

    boolean hasCurrentSession() {
        return projection.get().session().hasCurrentSession();
    }

    private void refreshProjection() {
        projection.set(Projection.from(sessionSnapshot, participantsProjection));
    }

    record Projection(
            String statusText,
            Projection.SessionModel session,
            Projection.PartyModel party,
            Projection.BudgetModel budget,
            Projection.RestAdviceModel restAdvice,
            Projection.GoldModel goldBudget,
            List<Projection.AvailablePlanModel> availablePlans,
            List<String> partyMemberSelectorValues,
            List<Projection.PartyMemberModel> activePartyMembers,
            List<Projection.SessionParticipantModel> sessionParticipants
    ) {

        Projection {
            statusText = statusText == null ? "" : statusText;
            session = session == null ? SessionModel.empty() : session;
            party = party == null ? PartyModel.empty() : party;
            budget = budget == null ? BudgetModel.empty() : budget;
            restAdvice = restAdvice == null ? RestAdviceModel.empty() : restAdvice;
            goldBudget = goldBudget == null ? GoldModel.placeholder() : goldBudget;
            availablePlans = safeCopy(availablePlans);
            partyMemberSelectorValues = safeCopy(partyMemberSelectorValues);
            activePartyMembers = safeCopy(activePartyMembers);
            sessionParticipants = safeCopy(sessionParticipants);
        }

        static Projection empty() {
            return new Projection(
                    "",
                    SessionModel.empty(),
                    PartyModel.empty(),
                    BudgetModel.empty(),
                    RestAdviceModel.empty(),
                    GoldModel.placeholder(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of());
        }

        static Projection from(
                SessionPlannerSessionSnapshot snapshot,
                SessionPlannerParticipantsProjection projection
        ) {
            SessionPlannerSessionSnapshot safeSnapshot =
                    snapshot == null ? SessionPlannerSessionSnapshot.empty("") : snapshot;
            SessionPlannerParticipantsProjection safeProjection =
                    projection == null ? SessionPlannerParticipantsProjection.empty() : projection;
            boolean hasCurrentSession = safeSnapshot.session().sessionId() > NO_SESSION_ID;
            Set<Long> participantIds = safeProjection.participants().stream()
                    .map(SessionPlannerParticipantsProjection.SessionParticipant::characterId)
                    .collect(Collectors.toSet());
            List<PartyMemberModel> selectablePartyMembers = safeProjection.activePartyMembers().stream()
                    .filter(member -> hasCurrentSession && !participantIds.contains(member.characterId()))
                    .map(member -> mapPartyMember(member, false, true))
                    .toList();
            return new Projection(
                    safeSnapshot.status(),
                    mapSession(safeSnapshot.session()),
                    mapParty(safeProjection.party()),
                    mapBudget(safeSnapshot.xpBudget()),
                    mapRestAdvice(safeSnapshot.restAdvice()),
                    mapGold(safeSnapshot.goldBudget()),
                    safeSnapshot.availableEncounterPlans().stream()
                            .map(plan -> mapAvailablePlan(plan, hasCurrentSession))
                            .toList(),
                    selectablePartyMembers.stream()
                            .map(PartyMemberModel::selectorValue)
                            .toList(),
                    selectablePartyMembers,
                    safeProjection.participants().stream()
                            .map(Projection::mapSessionParticipant)
                            .toList());
        }

        private static SessionModel mapSession(SessionPlannerSessionSnapshot.SessionState session) {
            SessionPlannerSessionSnapshot.SessionState safe =
                    session == null ? SessionPlannerSessionSnapshot.SessionState.empty() : session;
            if (safe.sessionId() <= NO_SESSION_ID) {
                return SessionModel.empty();
            }
            String selectionText = safe.hasSelectedEncounter()
                    ? "Encounter fuer State-Panel ausgewaehlt"
                    : "Noch kein Encounter fuer State-Panel ausgewaehlt";
            return new SessionModel(
                    safe.sessionId(),
                    safe.displayName(),
                    safe.encounterDaysText(),
                    safe.hasSelectedEncounter(),
                    selectionText,
                    false);
        }

        private static PartyModel mapParty(SessionPlannerParticipantsProjection.PartyState party) {
            SessionPlannerParticipantsProjection.PartyState safe =
                    party == null ? SessionPlannerParticipantsProjection.PartyState.empty() : party;
            return new PartyModel(safe.headline(), safe.detail(), safe.ready());
        }

        private static BudgetModel mapBudget(SessionPlannerSessionSnapshot.XpBudgetState budget) {
            SessionPlannerSessionSnapshot.XpBudgetState safe =
                    budget == null ? SessionPlannerSessionSnapshot.XpBudgetState.empty() : budget;
            String totalBudgetText = formatXp(safe.totalBudgetXp());
            String plannedXpText = formatXp(safe.plannedEncounterXp());
            String remainingXpText = formatXp(safe.remainingXp());
            String overBudgetText = formatXp(safe.overBudgetXp());
            return new BudgetModel(
                    safe.available(),
                    totalBudgetText,
                    plannedXpText,
                    remainingXpText,
                    overBudgetText,
                    "Budget " + totalBudgetText + XP_SUFFIX,
                    "Geplant " + plannedXpText + XP_SUFFIX,
                    safe.overBudget()
                            ? overBudgetText + XP_SUFFIX + " ueber"
                            : remainingXpText + XP_SUFFIX + " frei",
                    safe.progressFraction(),
                    safe.overBudget(),
                    safe.overBudget() ? STYLE_BUDGET_OVER : STYLE_BUDGET_OK,
                    milestoneText(safe.firstShortRestXp(), safe.secondShortRestXp()),
                    safe.summary());
        }

        private static RestAdviceModel mapRestAdvice(SessionPlannerSessionSnapshot.RestAdviceState restAdvice) {
            SessionPlannerSessionSnapshot.RestAdviceState safe =
                    restAdvice == null ? SessionPlannerSessionSnapshot.RestAdviceState.empty() : restAdvice;
            return new RestAdviceModel(
                    safe.available(),
                    safe.recommendedShortRests(),
                    safe.recommendedLongRests(),
                    safe.placedShortRests(),
                    safe.placedLongRests(),
                    safe.summary());
        }

        private static GoldModel mapGold(SessionPlannerSessionSnapshot.GoldBudgetState gold) {
            SessionPlannerSessionSnapshot.GoldBudgetState safe =
                    gold == null ? SessionPlannerSessionSnapshot.GoldBudgetState.placeholder(0) : gold;
            return new GoldModel(safe.headline(), safe.detail(), safe.available());
        }

        private static AvailablePlanModel mapAvailablePlan(
                SessionPlannerSessionSnapshot.AvailableEncounterPlan plan,
                boolean hasCurrentSession
        ) {
            boolean importEnabled = hasCurrentSession && plan.importEnabled();
            return new AvailablePlanModel(
                    plan.planId(),
                    plan.name(),
                    plan.summaryText(),
                    plan.adjustedXp(),
                    plan.difficultyLabel(),
                    plan.statusText(),
                    importEnabled,
                    "An Session anhaengen",
                    "accent",
                    !importEnabled);
        }

        private static PartyMemberModel mapPartyMember(
                SessionPlannerParticipantsProjection.ActivePartyMember member,
                boolean alreadyInSession,
                boolean hasCurrentSession
        ) {
            boolean actionDisabled = alreadyInSession || !hasCurrentSession;
            return new PartyMemberModel(
                    member.characterId(),
                    member.name(),
                    member.level(),
                    alreadyInSession,
                    selectorValue(member.characterId(), member.name(), member.level()),
                    "Level " + member.level(),
                    alreadyInSession ? "Schon in Session" : "Hinzufuegen",
                    actionDisabled ? "flat" : "accent",
                    actionDisabled);
        }

        private static SessionParticipantModel mapSessionParticipant(
                SessionPlannerParticipantsProjection.SessionParticipant participant
        ) {
            String label = participant.level() > 0
                    ? "Level " + participant.level()
                    : participant.statusText();
            return new SessionParticipantModel(
                    participant.characterId(),
                    participant.name(),
                    participant.level(),
                    participant.available(),
                    label,
                    true,
                    participant.available() ? STYLE_TEXT_SECONDARY : "session-planner-gap-active",
                    "Entfernen",
                    false);
        }

        private static String milestoneText(int firstShortRestXp, int secondShortRestXp) {
            if (firstShortRestXp <= 0 && secondShortRestXp <= 0) {
                return "Keine Rast-Meilensteine";
            }
            return "SR " + formatXp(firstShortRestXp) + " · SR " + formatXp(secondShortRestXp);
        }

        private static String formatXp(int value) {
            NumberFormat format = NumberFormat.getIntegerInstance(Locale.GERMANY);
            return format.format(Math.max(0, value));
        }

        private static String selectorValue(long characterId, String name, int level) {
            return safeText(name).replace('\t', ' ') + " - Level " + Math.max(0, level) + "\t" + characterId;
        }

        private static <T> List<T> safeCopy(List<T> values) {
            return values == null ? List.of() : List.copyOf(values);
        }

        record SessionModel(
                long sessionId,
                String sessionIdText,
                String encounterDaysText,
                boolean hasSelectedEncounter,
                String selectionText,
                boolean sessionActionsDisabled
        ) {

            SessionModel {
                sessionIdText = sessionIdText == null ? "" : sessionIdText;
                encounterDaysText = encounterDaysText == null ? "" : encounterDaysText;
                selectionText = selectionText == null ? "" : selectionText;
            }

            boolean hasCurrentSession() {
                return sessionId > 0L;
            }

            static SessionModel empty() {
                return new SessionModel(
                        0L,
                        "Keine Session",
                        "",
                        false,
                        "Erstelle oder oeffne eine Session.",
                        true);
            }
        }

        record PartyModel(
                String headline,
                String detail,
                boolean ready
        ) {

            PartyModel {
                headline = headline == null ? "" : headline;
                detail = detail == null ? "" : detail;
            }

            static PartyModel empty() {
                return new PartyModel("Keine aktive Party", "Session Planner ist deaktiviert.", false);
            }
        }

        record BudgetModel(
                boolean available,
                String totalBudgetText,
                String plannedXpText,
                String remainingXpText,
                String overBudgetText,
                String totalBudgetLine,
                String plannedXpLine,
                String remainingXpLine,
                double progressFraction,
                boolean overBudget,
                String budgetStyleClass,
                String milestonesText,
                String summaryText
        ) {

            BudgetModel {
                totalBudgetText = safeText(totalBudgetText);
                plannedXpText = safeText(plannedXpText);
                remainingXpText = safeText(remainingXpText);
                overBudgetText = safeText(overBudgetText);
                totalBudgetLine = safeText(totalBudgetLine);
                plannedXpLine = safeText(plannedXpLine);
                remainingXpLine = safeText(remainingXpLine);
                budgetStyleClass = safeText(budgetStyleClass);
                milestonesText = safeText(milestonesText);
                summaryText = safeText(summaryText);
            }

            static BudgetModel empty() {
                return new BudgetModel(
                        false,
                        "0",
                        "0",
                        "0",
                        "0",
                        "Budget 0 XP",
                        "Geplant 0 XP",
                        "0 XP frei",
                        0.0,
                        false,
                        STYLE_BUDGET_OK,
                        "Keine Rast-Meilensteine",
                        "Kein XP-Budget verfuegbar.");
            }
        }

        record RestAdviceModel(
                boolean available,
                int recommendedShortRests,
                int recommendedLongRests,
                int placedShortRests,
                int placedLongRests,
                String summaryText
        ) {

            RestAdviceModel {
                summaryText = safeText(summaryText);
            }

            static RestAdviceModel empty() {
                return new RestAdviceModel(false, 0, 0, 0, 0, "Keine Rastempfehlung verfuegbar.");
            }
        }

        record GoldModel(
                String headline,
                String detail,
                boolean available
        ) {

            GoldModel {
                headline = safeText(headline);
                detail = safeText(detail);
            }

            static GoldModel placeholder() {
                return new GoldModel("Goldbudget offen", "Loot-Platzhalter werden sichtbar, Gold folgt spaeter.", false);
            }
        }

        record AvailablePlanModel(
                long planId,
                String name,
                String summaryText,
                int adjustedXp,
                String difficultyLabel,
                String statusText,
                boolean importEnabled,
                String actionText,
                String actionStyleClass,
                boolean actionDisabled
        ) {

            AvailablePlanModel {
                name = safeText(name);
                summaryText = safeText(summaryText);
                difficultyLabel = safeText(difficultyLabel);
                statusText = safeText(statusText);
                actionText = safeText(actionText);
                actionStyleClass = safeText(actionStyleClass);
            }
        }

        record PartyMemberModel(
                long characterId,
                String name,
                int level,
                boolean alreadyInSession,
                String selectorValue,
                String detailText,
                String actionText,
                String actionStyleClass,
                boolean actionDisabled
        ) {

            PartyMemberModel {
                name = safeText(name);
                selectorValue = safeText(selectorValue);
                detailText = safeText(detailText);
                actionText = safeText(actionText);
                actionStyleClass = safeText(actionStyleClass);
            }
        }

        record SessionParticipantModel(
                long characterId,
                String name,
                int level,
                boolean available,
                String detail,
                boolean removable,
                String detailStyleClass,
                String actionText,
                boolean actionDisabled
        ) {

            SessionParticipantModel {
                name = safeText(name);
                detail = safeText(detail);
                detailStyleClass = safeText(detailStyleClass);
                actionText = safeText(actionText);
            }
        }

        private static String safeText(String text) {
            return text == null ? "" : text;
        }
    }
}
