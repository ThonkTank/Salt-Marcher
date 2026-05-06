package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import javafx.beans.property.ReadOnlyListProperty;
import javafx.beans.property.ReadOnlyListWrapper;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import javafx.collections.FXCollections;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SessionPlannerSnapshot;

public final class SessionPlannerContributionModel {

    private final ReadOnlyObjectWrapper<SessionModel> session =
            new ReadOnlyObjectWrapper<>(SessionModel.empty());
    private final ReadOnlyObjectWrapper<PartyModel> party =
            new ReadOnlyObjectWrapper<>(PartyModel.empty());
    private final ReadOnlyObjectWrapper<BudgetModel> budget =
            new ReadOnlyObjectWrapper<>(BudgetModel.empty());
    private final ReadOnlyObjectWrapper<RestAdviceModel> restAdvice =
            new ReadOnlyObjectWrapper<>(RestAdviceModel.empty());
    private final ReadOnlyObjectWrapper<GoldModel> goldBudget =
            new ReadOnlyObjectWrapper<>(GoldModel.placeholder());
    private final ReadOnlyObjectWrapper<StateModel> state =
            new ReadOnlyObjectWrapper<>(StateModel.empty());
    private final ReadOnlyStringWrapper statusText = new ReadOnlyStringWrapper("");
    private final ReadOnlyListWrapper<AvailablePlanModel> availablePlans =
            new ReadOnlyListWrapper<>(FXCollections.observableArrayList());
    private final ReadOnlyListWrapper<PartyMemberModel> activePartyMembers =
            new ReadOnlyListWrapper<>(FXCollections.observableArrayList());
    private final ReadOnlyListWrapper<SessionParticipantModel> sessionParticipants =
            new ReadOnlyListWrapper<>(FXCollections.observableArrayList());
    private final ReadOnlyListWrapper<EncounterModel> plannedEncounters =
            new ReadOnlyListWrapper<>(FXCollections.observableArrayList());
    private final ReadOnlyListWrapper<RestGapModel> restGaps =
            new ReadOnlyListWrapper<>(FXCollections.observableArrayList());
    private final ReadOnlyListWrapper<LootModel> lootPlaceholders =
            new ReadOnlyListWrapper<>(FXCollections.observableArrayList());

    public ReadOnlyObjectProperty<SessionModel> sessionProperty() {
        return session.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<PartyModel> partyProperty() {
        return party.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<BudgetModel> budgetProperty() {
        return budget.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<RestAdviceModel> restAdviceProperty() {
        return restAdvice.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<GoldModel> goldBudgetProperty() {
        return goldBudget.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<StateModel> stateProperty() {
        return state.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty statusTextProperty() {
        return statusText.getReadOnlyProperty();
    }

    public ReadOnlyListProperty<AvailablePlanModel> availablePlansProperty() {
        return availablePlans.getReadOnlyProperty();
    }

    public ReadOnlyListProperty<PartyMemberModel> activePartyMembersProperty() {
        return activePartyMembers.getReadOnlyProperty();
    }

    public ReadOnlyListProperty<SessionParticipantModel> sessionParticipantsProperty() {
        return sessionParticipants.getReadOnlyProperty();
    }

    public ReadOnlyListProperty<EncounterModel> plannedEncountersProperty() {
        return plannedEncounters.getReadOnlyProperty();
    }

    public ReadOnlyListProperty<RestGapModel> restGapsProperty() {
        return restGaps.getReadOnlyProperty();
    }

    public ReadOnlyListProperty<LootModel> lootPlaceholdersProperty() {
        return lootPlaceholders.getReadOnlyProperty();
    }

    public void apply(SessionPlannerSnapshot snapshot) {
        SessionPlannerSnapshot safe = snapshot == null ? SessionPlannerSnapshot.empty("") : snapshot;
        session.set(mapSession(safe.session()));
        party.set(mapParty(safe.party()));
        budget.set(mapBudget(safe.xpBudget()));
        restAdvice.set(mapRestAdvice(safe.restAdvice()));
        goldBudget.set(mapGold(safe.goldBudget()));
        statusText.set(safe.status());
        availablePlans.setAll(safe.availableEncounterPlans().stream()
                .map(SessionPlannerContributionModel::mapAvailablePlan)
                .toList());
        Set<Long> participantIds = safe.participants().stream()
                .map(SessionPlannerSnapshot.SessionParticipant::characterId)
                .collect(Collectors.toSet());
        activePartyMembers.setAll(safe.activePartyMembers().stream()
                .map(member -> mapPartyMember(member, participantIds.contains(member.characterId())))
                .toList());
        sessionParticipants.setAll(safe.participants().stream()
                .map(SessionPlannerContributionModel::mapSessionParticipant)
                .toList());
        List<SessionPlannerSnapshot.PlannedEncounter> sourceEncounters = safe.plannedEncounters();
        List<EncounterModel> mappedEncounters = mapEncounters(sourceEncounters);
        plannedEncounters.setAll(mappedEncounters);
        restGaps.setAll(safe.restGaps().stream()
                .map(gap -> new RestGapModel(
                        gap.gapIndex(),
                        gap.leftEncounterId(),
                        gap.rightEncounterId(),
                        restLabel(gap.restKind()),
                        gap.restKind() != null && gap.restKind() != SessionPlannerRestKind.NONE))
                .toList());
        lootPlaceholders.setAll(safe.lootPlaceholders().stream()
                .map(loot -> new LootModel(loot.token(), loot.label()))
                .toList());
        state.set(mapState(session.get(), mappedEncounters));
    }

    private static SessionModel mapSession(SessionPlannerSnapshot.SessionState session) {
        SessionPlannerSnapshot.SessionState safe = session == null
                ? SessionPlannerSnapshot.SessionState.empty()
                : session;
        String selectionText = safe.hasSelectedEncounter()
                ? "Encounter fuer State-Panel ausgewaehlt"
                : "Noch kein Encounter fuer State-Panel ausgewaehlt";
        return new SessionModel(
                safe.sessionId(),
                safe.encounterDaysText(),
                safe.hasSelectedEncounter(),
                selectionText);
    }

    private static PartyModel mapParty(SessionPlannerSnapshot.PartyState party) {
        SessionPlannerSnapshot.PartyState safe = party == null
                ? SessionPlannerSnapshot.PartyState.empty()
                : party;
        return new PartyModel(
                safe.headline(),
                safe.detail(),
                safe.ready());
    }

    private static BudgetModel mapBudget(SessionPlannerSnapshot.XpBudgetState budget) {
        SessionPlannerSnapshot.XpBudgetState safe = budget == null
                ? SessionPlannerSnapshot.XpBudgetState.empty()
                : budget;
        return new BudgetModel(
                safe.available(),
                format(safe.totalBudgetXp()),
                format(safe.plannedEncounterXp()),
                format(safe.remainingXp()),
                format(safe.overBudgetXp()),
                safe.progressFraction(),
                safe.overBudget(),
                milestoneText(safe.firstShortRestXp(), safe.secondShortRestXp()),
                safe.summary());
    }

    private static RestAdviceModel mapRestAdvice(SessionPlannerSnapshot.RestAdviceState restAdvice) {
        SessionPlannerSnapshot.RestAdviceState safe = restAdvice == null
                ? SessionPlannerSnapshot.RestAdviceState.empty()
                : restAdvice;
        return new RestAdviceModel(
                safe.available(),
                safe.recommendedShortRests(),
                safe.recommendedLongRests(),
                safe.placedShortRests(),
                safe.placedLongRests(),
                safe.summary());
    }

    private static GoldModel mapGold(SessionPlannerSnapshot.GoldBudgetState gold) {
        SessionPlannerSnapshot.GoldBudgetState safe = gold == null
                ? SessionPlannerSnapshot.GoldBudgetState.placeholder(0)
                : gold;
        return new GoldModel(safe.headline(), safe.detail(), safe.available());
    }

    private static AvailablePlanModel mapAvailablePlan(SessionPlannerSnapshot.AvailableEncounterPlan plan) {
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
            SessionPlannerSnapshot.ActivePartyMember member,
            boolean alreadyInSession
    ) {
        return new PartyMemberModel(
                member.characterId(),
                member.name(),
                member.level(),
                alreadyInSession);
    }

    private static SessionParticipantModel mapSessionParticipant(SessionPlannerSnapshot.SessionParticipant participant) {
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

    private static List<EncounterModel> mapEncounters(List<SessionPlannerSnapshot.PlannedEncounter> encounters) {
        List<SessionPlannerSnapshot.PlannedEncounter> safe = encounters == null ? List.of() : List.copyOf(encounters);
        return java.util.stream.IntStream.range(0, safe.size())
                .mapToObj(index -> {
                    SessionPlannerSnapshot.PlannedEncounter encounter = safe.get(index);
                    String comparison = "Ziel " + format(encounter.targetXp())
                            + " XP · Ist " + format(encounter.adjustedXp()) + " XP";
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
                            format(encounter.targetXp()),
                            comparison,
                            encounter.selected(),
                            index > 0,
                            index < safe.size() - 1);
                })
                .toList();
    }

    private static StateModel mapState(
            SessionModel session,
            List<EncounterModel> encounters
    ) {
        EncounterModel selectedEncounter = encounters.stream()
                .filter(EncounterModel::selected)
                .findFirst()
                .orElse(null);
        if (selectedEncounter == null) {
            return new StateModel(
                    false,
                    "Kein Session-Encounter ausgewaehlt",
                    "Waehle im Planner einen Encounter aus, um den vorbereitenden State-Kontext zu sehen.",
                    "",
                    session.selectionText(),
                    "Katalog-Vorbereitung",
                    "Der generische Katalog folgt spaeter. Dieser Slice reserviert nur die planner-eigene read-only Flaeche.");
        }
        String detail = selectedEncounter.creatureCount() + " Kreaturen"
                + (selectedEncounter.generatedLabel().isBlank() ? "" : " · " + selectedEncounter.generatedLabel());
        String xpSummary = selectedEncounter.budgetPercentageText() + " Budget · "
                + selectedEncounter.comparisonText();
        return new StateModel(
                true,
                selectedEncounter.name(),
                detail,
                xpSummary,
                "Ausgewaehlter Encounter #" + selectedEncounter.token(),
                "Katalog-Vorbereitung",
                "Read-only Placeholder fuer spaetere Monster-, Spell- und Loot-Aktionen. Noch keine echte Catalog-Boundary und keine Mutation.");
    }

    private static String milestoneText(int firstShortRestXp, int secondShortRestXp) {
        if (firstShortRestXp <= 0 && secondShortRestXp <= 0) {
            return "Keine Rast-Meilensteine";
        }
        return "SR " + format(firstShortRestXp) + " · SR " + format(secondShortRestXp);
    }

    private static String restLabel(SessionPlannerRestKind restKind) {
        return switch (restKind == null ? SessionPlannerRestKind.NONE : restKind) {
            case NONE -> "Keine Rast";
            case SHORT_REST -> "Kurze Rast";
            case LONG_REST -> "Lange Rast";
        };
    }

    private static String format(int value) {
        NumberFormat format = NumberFormat.getIntegerInstance(Locale.GERMANY);
        return format.format(Math.max(0, value));
    }

    private static String formatPercent(BigDecimal percentage) {
        BigDecimal safe = percentage == null ? BigDecimal.ZERO : percentage.stripTrailingZeros();
        return safe.toPlainString() + "%";
    }

    public record SessionModel(
            long sessionId,
            String encounterDaysText,
            boolean hasSelectedEncounter,
            String selectionText
    ) {

        static SessionModel empty() {
            return new SessionModel(0L, "1", false, "Noch kein Encounter fuer State-Panel ausgewaehlt");
        }
    }

    public record PartyModel(
            String headline,
            String detail,
            boolean ready
    ) {

        static PartyModel empty() {
            return new PartyModel("Keine aktive Party", "Session Planner ist deaktiviert.", false);
        }
    }

    public record BudgetModel(
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

        static BudgetModel empty() {
            return new BudgetModel(false, "0", "0", "0", "0", 0.0, false, "Keine Rast-Meilensteine", "Kein XP-Budget verfuegbar.");
        }
    }

    public record RestAdviceModel(
            boolean available,
            int recommendedShortRests,
            int recommendedLongRests,
            int placedShortRests,
            int placedLongRests,
            String summaryText
    ) {

        static RestAdviceModel empty() {
            return new RestAdviceModel(false, 0, 0, 0, 0, "Keine Rastempfehlung verfuegbar.");
        }
    }

    public record GoldModel(
            String headline,
            String detail,
            boolean available
    ) {

        static GoldModel placeholder() {
            return new GoldModel("Goldbudget offen", "Loot-Platzhalter werden sichtbar, Gold folgt spaeter.", false);
        }
    }

    public record StateModel(
            boolean selectedEncounterAvailable,
            String selectedEncounterTitle,
            String selectedEncounterDetail,
            String selectedEncounterXpSummary,
            String stateContextLabel,
            String placeholderTitle,
            String placeholderDetail
    ) {

        static StateModel empty() {
            return new StateModel(
                    false,
                    "Kein Session-Encounter ausgewaehlt",
                    "Waehle im Planner einen Encounter aus, um den vorbereitenden State-Kontext zu sehen.",
                    "",
                    "",
                    "Katalog-Vorbereitung",
                    "Planner-owned read-only Placeholder.");
        }
    }

    public record AvailablePlanModel(
            long planId,
            String name,
            String generatedLabel,
            int creatureCount,
            int adjustedXp,
            String difficultyLabel,
            String statusText,
            boolean importEnabled
    ) {
    }

    public record PartyMemberModel(
            long characterId,
            String name,
            int level,
            boolean alreadyInSession
    ) {
    }

    public record SessionParticipantModel(
            long characterId,
            String name,
            int level,
            boolean available,
            String detail,
            boolean removable
    ) {
    }

    public record EncounterModel(
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
    }

    public record RestGapModel(
            int gapIndex,
            long leftEncounterId,
            long rightEncounterId,
            String label,
            boolean hasAssignedRest
    ) {
    }

    public record LootModel(
            long token,
            String label
    ) {
    }
}
