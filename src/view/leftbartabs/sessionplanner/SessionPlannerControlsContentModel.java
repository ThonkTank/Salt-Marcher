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
            Set<Long> participantIds = safeProjection.participants().stream()
                    .map(SessionPlannerParticipantsProjection.SessionParticipant::characterId)
                    .collect(Collectors.toSet());
            return new Projection(
                    safeSnapshot.status(),
                    mapSession(safeSnapshot.session()),
                    mapParty(safeProjection.party()),
                    mapBudget(safeSnapshot.xpBudget()),
                    mapRestAdvice(safeSnapshot.restAdvice()),
                    mapGold(safeSnapshot.goldBudget()),
                    safeSnapshot.availableEncounterPlans().stream()
                            .map(Projection::mapAvailablePlan)
                            .toList(),
                    safeProjection.activePartyMembers().stream()
                            .map(member -> mapPartyMember(member, participantIds.contains(member.characterId())))
                            .toList(),
                    safeProjection.participants().stream()
                            .map(Projection::mapSessionParticipant)
                            .toList());
        }

        private static SessionModel mapSession(SessionPlannerSessionSnapshot.SessionState session) {
            SessionPlannerSessionSnapshot.SessionState safe =
                    session == null ? SessionPlannerSessionSnapshot.SessionState.empty() : session;
            String selectionText = safe.hasSelectedEncounter()
                    ? "Encounter fuer State-Panel ausgewaehlt"
                    : "Noch kein Encounter fuer State-Panel ausgewaehlt";
            return new SessionModel(
                    safe.sessionId(),
                    safe.encounterDaysText(),
                    safe.hasSelectedEncounter(),
                    selectionText);
        }

        private static PartyModel mapParty(SessionPlannerParticipantsProjection.PartyState party) {
            SessionPlannerParticipantsProjection.PartyState safe =
                    party == null ? SessionPlannerParticipantsProjection.PartyState.empty() : party;
            return new PartyModel(safe.headline(), safe.detail(), safe.ready());
        }

        private static BudgetModel mapBudget(SessionPlannerSessionSnapshot.XpBudgetState budget) {
            SessionPlannerSessionSnapshot.XpBudgetState safe =
                    budget == null ? SessionPlannerSessionSnapshot.XpBudgetState.empty() : budget;
            return new BudgetModel(
                    safe.available(),
                    formatXp(safe.totalBudgetXp()),
                    formatXp(safe.plannedEncounterXp()),
                    formatXp(safe.remainingXp()),
                    formatXp(safe.overBudgetXp()),
                    safe.progressFraction(),
                    safe.overBudget(),
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
                SessionPlannerSessionSnapshot.AvailableEncounterPlan plan
        ) {
            return new AvailablePlanModel(
                    plan.planId(),
                    plan.name(),
                    plan.summaryText(),
                    plan.adjustedXp(),
                    plan.difficultyLabel(),
                    plan.statusText(),
                    plan.importEnabled());
        }

        private static PartyMemberModel mapPartyMember(
                SessionPlannerParticipantsProjection.ActivePartyMember member,
                boolean alreadyInSession
        ) {
            return new PartyMemberModel(
                    member.characterId(),
                    member.name(),
                    member.level(),
                    alreadyInSession);
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
                    true);
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

        private static <T> List<T> safeCopy(List<T> values) {
            return values == null ? List.of() : List.copyOf(values);
        }

        record SessionModel(
                long sessionId,
                String encounterDaysText,
                boolean hasSelectedEncounter,
                String selectionText
        ) {

            SessionModel {
                encounterDaysText = encounterDaysText == null ? "1" : encounterDaysText;
                selectionText = selectionText == null ? "" : selectionText;
            }

            static SessionModel empty() {
                return new SessionModel(0L, "1", false, "Noch kein Encounter fuer State-Panel ausgewaehlt");
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
                double progressFraction,
                boolean overBudget,
                String milestonesText,
                String summaryText
        ) {

            BudgetModel {
                totalBudgetText = safeText(totalBudgetText);
                plannedXpText = safeText(plannedXpText);
                remainingXpText = safeText(remainingXpText);
                overBudgetText = safeText(overBudgetText);
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
                        0.0,
                        false,
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
                boolean importEnabled
        ) {

            AvailablePlanModel {
                name = safeText(name);
                summaryText = safeText(summaryText);
                difficultyLabel = safeText(difficultyLabel);
                statusText = safeText(statusText);
            }
        }

        record PartyMemberModel(
                long characterId,
                String name,
                int level,
                boolean alreadyInSession
        ) {

            PartyMemberModel {
                name = safeText(name);
            }
        }

        record SessionParticipantModel(
                long characterId,
                String name,
                int level,
                boolean available,
                String detail,
                boolean removable
        ) {

            SessionParticipantModel {
                name = safeText(name);
                detail = safeText(detail);
            }
        }

        private static String safeText(String text) {
            return text == null ? "" : text;
        }
    }
}
