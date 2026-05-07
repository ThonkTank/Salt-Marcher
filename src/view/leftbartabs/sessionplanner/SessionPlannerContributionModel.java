package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.sessionplanner.published.SessionPlannerEncountersProjection;
import src.domain.sessionplanner.published.SessionPlannerParticipantsProjection;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SessionPlannerSessionSnapshot;
import src.domain.sessionplanner.published.SessionPlannerStatePanelProjection;

@SuppressWarnings("PMD.CouplingBetweenObjects")
public final class SessionPlannerContributionModel {

    private SessionPlannerSessionSnapshot sessionSnapshot = SessionPlannerSessionSnapshot.empty("");
    private SessionPlannerParticipantsProjection participantsProjection = SessionPlannerParticipantsProjection.empty();
    private SessionPlannerEncountersProjection encountersProjection = SessionPlannerEncountersProjection.empty();
    private SessionPlannerStatePanelProjection statePanelProjection = SessionPlannerStatePanelProjection.empty();

    private final ReadOnlyObjectWrapper<ControlsProjection> controlsProjection =
            new ReadOnlyObjectWrapper<>(ControlsProjection.empty());
    private final ReadOnlyObjectWrapper<MainProjection> mainProjection =
            new ReadOnlyObjectWrapper<>(MainProjection.empty());
    private final ReadOnlyObjectWrapper<StateProjection> stateProjection =
            new ReadOnlyObjectWrapper<>(StateProjection.empty());

    public ReadOnlyObjectProperty<ControlsProjection> controlsProjectionProperty() {
        return controlsProjection.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<MainProjection> mainProjectionProperty() {
        return mainProjection.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<StateProjection> stateProjectionProperty() {
        return stateProjection.getReadOnlyProperty();
    }

    public void applySession(SessionPlannerSessionSnapshot snapshot) {
        sessionSnapshot = snapshot == null ? SessionPlannerSessionSnapshot.empty("") : snapshot;
        refreshControlsProjection();
    }

    public void applyParticipants(SessionPlannerParticipantsProjection projection) {
        participantsProjection = projection == null ? SessionPlannerParticipantsProjection.empty() : projection;
        refreshControlsProjection();
    }

    public void applyEncounters(SessionPlannerEncountersProjection projection) {
        encountersProjection = projection == null ? SessionPlannerEncountersProjection.empty() : projection;
        refreshMainProjection();
    }

    public void applyStatePanel(SessionPlannerStatePanelProjection projection) {
        statePanelProjection = projection == null ? SessionPlannerStatePanelProjection.empty() : projection;
        refreshStateProjection();
    }

    private void refreshControlsProjection() {
        controlsProjection.set(ControlsProjection.from(sessionSnapshot, participantsProjection));
    }

    private void refreshMainProjection() {
        mainProjection.set(MainProjection.from(encountersProjection));
    }

    private void refreshStateProjection() {
        stateProjection.set(StateProjection.from(statePanelProjection));
    }
}

record ControlsProjection(
        String statusText,
        ControlsProjection.SessionModel session,
        ControlsProjection.PartyModel party,
        ControlsProjection.BudgetModel budget,
        ControlsProjection.RestAdviceModel restAdvice,
        ControlsProjection.GoldModel goldBudget,
        List<ControlsProjection.AvailablePlanModel> availablePlans,
        List<ControlsProjection.PartyMemberModel> activePartyMembers,
        List<ControlsProjection.SessionParticipantModel> sessionParticipants
) {

    ControlsProjection {
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

    static ControlsProjection empty() {
        return new ControlsProjection(
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

    static ControlsProjection from(
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
        return new ControlsProjection(
                safeSnapshot.status(),
                mapSession(safeSnapshot.session()),
                mapParty(safeProjection.party()),
                mapBudget(safeSnapshot.xpBudget()),
                mapRestAdvice(safeSnapshot.restAdvice()),
                mapGold(safeSnapshot.goldBudget()),
                safeSnapshot.availableEncounterPlans().stream()
                        .map(ControlsProjection::mapAvailablePlan)
                        .toList(),
                safeProjection.activePartyMembers().stream()
                        .map(member -> mapPartyMember(member, participantIds.contains(member.characterId())))
                        .toList(),
                safeProjection.participants().stream()
                        .map(ControlsProjection::mapSessionParticipant)
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
                plan.generatedLabel(),
                plan.creatureCount(),
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
            return new BudgetModel(false, "0", "0", "0", "0", 0.0, false, "Keine Rast-Meilensteine", "Kein XP-Budget verfuegbar.");
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
            String generatedLabel,
            int creatureCount,
            int adjustedXp,
            String difficultyLabel,
            String statusText,
            boolean importEnabled
    ) {

        AvailablePlanModel {
            name = safeText(name);
            generatedLabel = safeText(generatedLabel);
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

record MainProjection(
        List<MainProjection.EncounterModel> encounters,
        List<MainProjection.RestGapModel> restGaps,
        List<MainProjection.LootModel> lootPlaceholders
) {

    MainProjection {
        encounters = safeCopy(encounters);
        restGaps = safeCopy(restGaps);
        lootPlaceholders = safeCopy(lootPlaceholders);
    }

    static MainProjection empty() {
        return new MainProjection(List.of(), List.of(), List.of());
    }

    static MainProjection from(SessionPlannerEncountersProjection projection) {
        SessionPlannerEncountersProjection safe =
                projection == null ? SessionPlannerEncountersProjection.empty() : projection;
        List<SessionPlannerEncountersProjection.PlannedEncounter> sourceEncounters = safe.plannedEncounters();
        List<EncounterModel> mappedEncounters = mapEncounters(sourceEncounters);
        return new MainProjection(
                mappedEncounters,
                safe.restGaps().stream()
                        .map(gap -> new RestGapModel(
                                gap.gapIndex(),
                                gap.leftEncounterId(),
                                gap.rightEncounterId(),
                                restLabel(gap.restKind()),
                                gap.restKind() != null && gap.restKind() != SessionPlannerRestKind.NONE))
                        .toList(),
                safe.lootPlaceholders().stream()
                        .map(loot -> new LootModel(loot.token(), loot.label()))
                        .toList());
    }

    private static List<EncounterModel> mapEncounters(
            List<SessionPlannerEncountersProjection.PlannedEncounter> encounters
    ) {
        List<SessionPlannerEncountersProjection.PlannedEncounter> safe =
                encounters == null ? List.of() : List.copyOf(encounters);
        return java.util.stream.IntStream.range(0, safe.size())
                .mapToObj(index -> {
                    SessionPlannerEncountersProjection.PlannedEncounter encounter = safe.get(index);
                    String comparison = "Ziel " + formatXp(encounter.targetXp())
                            + " XP · Ist " + formatXp(encounter.adjustedXp()) + " XP";
                    return new EncounterModel(
                            encounter.token(),
                            encounter.name(),
                            encounter.generatedLabel(),
                            encounter.creatureCount(),
                            encounter.totalBaseXp(),
                            encounter.adjustedXp(),
                            encounter.xpMultiplier(),
                            encounter.difficultyLabel(),
                            encounter.budgetPercentage(),
                            formatPercent(encounter.budgetPercentage()),
                            formatXp(encounter.targetXp()),
                            comparison,
                            encounter.selected(),
                            index > 0,
                            index < safe.size() - 1);
                })
                .toList();
    }

    private static String restLabel(SessionPlannerRestKind restKind) {
        return switch (restKind == null ? SessionPlannerRestKind.NONE : restKind) {
            case NONE -> "Keine Rast";
            case SHORT_REST -> "Kurze Rast";
            case LONG_REST -> "Lange Rast";
        };
    }

    private static String formatXp(int value) {
        NumberFormat format = NumberFormat.getIntegerInstance(Locale.GERMANY);
        return format.format(Math.max(0, value));
    }

    private static String formatPercent(BigDecimal percentage) {
        BigDecimal safe = percentage == null ? BigDecimal.ZERO : percentage.stripTrailingZeros();
        return safe.toPlainString() + "%";
    }

    private static <T> List<T> safeCopy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    record EncounterModel(
            long token,
            String name,
            String generatedLabel,
            int creatureCount,
            int totalBaseXp,
            int adjustedXp,
            double xpMultiplier,
            String difficultyLabel,
            BigDecimal budgetPercentage,
            String budgetPercentageText,
            String targetXpText,
            String comparisonText,
            boolean selected,
            boolean canMoveUp,
            boolean canMoveDown
    ) {

        EncounterModel {
            name = safeText(name);
            generatedLabel = safeText(generatedLabel);
            difficultyLabel = safeText(difficultyLabel);
            budgetPercentage = budgetPercentage == null ? BigDecimal.ZERO : budgetPercentage;
            budgetPercentageText = safeText(budgetPercentageText);
            targetXpText = safeText(targetXpText);
            comparisonText = safeText(comparisonText);
        }
    }

    record RestGapModel(
            int gapIndex,
            long leftEncounterId,
            long rightEncounterId,
            String label,
            boolean hasAssignedRest
    ) {

        RestGapModel {
            label = safeText(label);
        }
    }

    record LootModel(
            long token,
            String label
    ) {

        LootModel {
            label = safeText(label);
        }
    }

    private static String safeText(String text) {
        return text == null ? "" : text;
    }
}

record StateProjection(
        boolean selectedEncounterAvailable,
        String selectedEncounterTitle,
        String selectedEncounterDetail,
        String selectedEncounterXpSummary,
        String stateContextLabel,
        String placeholderTitle,
        String placeholderDetail
) {

    StateProjection {
        selectedEncounterTitle = safeText(selectedEncounterTitle);
        selectedEncounterDetail = safeText(selectedEncounterDetail);
        selectedEncounterXpSummary = safeText(selectedEncounterXpSummary);
        stateContextLabel = safeText(stateContextLabel);
        placeholderTitle = safeText(placeholderTitle);
        placeholderDetail = safeText(placeholderDetail);
    }

    static StateProjection empty() {
        return new StateProjection(
                false,
                "Kein Session-Encounter ausgewaehlt",
                "Waehle im Planner einen Encounter aus, um den vorbereitenden State-Kontext zu sehen.",
                "",
                "",
                "Katalog-Vorbereitung",
                "Planner-owned read-only Placeholder.");
    }

    static StateProjection from(SessionPlannerStatePanelProjection projection) {
        SessionPlannerStatePanelProjection safe =
                projection == null ? SessionPlannerStatePanelProjection.empty() : projection;
        return new StateProjection(
                safe.selectedEncounterAvailable(),
                safe.selectedEncounterTitle(),
                safe.selectedEncounterDetail(),
                safe.selectedEncounterXpSummary(),
                safe.stateContextLabel(),
                safe.placeholderTitle(),
                safe.placeholderDetail());
    }

    private static String safeText(String text) {
        return text == null ? "" : text;
    }
}
