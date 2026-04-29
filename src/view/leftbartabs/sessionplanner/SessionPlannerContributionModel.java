package src.view.leftbartabs.sessionplanner;

import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SessionPlannerSnapshot;

public final class SessionPlannerContributionModel {

    private static final NumberFormat INTEGER_FORMAT = NumberFormat.getIntegerInstance(Locale.GERMANY);

    private final ReadOnlyObjectWrapper<PartyModel> party =
            new ReadOnlyObjectWrapper<>(PartyModel.empty());
    private final ReadOnlyObjectWrapper<BudgetModel> budget =
            new ReadOnlyObjectWrapper<>(BudgetModel.empty());
    private final ReadOnlyObjectWrapper<RestAdviceModel> restAdvice =
            new ReadOnlyObjectWrapper<>(RestAdviceModel.empty());
    private final ReadOnlyObjectWrapper<GoldModel> goldBudget =
            new ReadOnlyObjectWrapper<>(GoldModel.placeholder());
    private final ReadOnlyStringWrapper statusText = new ReadOnlyStringWrapper("");
    private final ObservableList<AvailablePlanModel> availablePlans = FXCollections.observableArrayList();
    private final ObservableList<EncounterModel> plannedEncounters = FXCollections.observableArrayList();
    private final ObservableList<RestGapModel> restGaps = FXCollections.observableArrayList();
    private final ObservableList<LootModel> lootPlaceholders = FXCollections.observableArrayList();
    private final ObservableList<AvailablePlanModel> readOnlyAvailablePlans =
            FXCollections.unmodifiableObservableList(availablePlans);
    private final ObservableList<EncounterModel> readOnlyPlannedEncounters =
            FXCollections.unmodifiableObservableList(plannedEncounters);
    private final ObservableList<RestGapModel> readOnlyRestGaps =
            FXCollections.unmodifiableObservableList(restGaps);
    private final ObservableList<LootModel> readOnlyLootPlaceholders =
            FXCollections.unmodifiableObservableList(lootPlaceholders);

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

    public ReadOnlyStringProperty statusTextProperty() {
        return statusText.getReadOnlyProperty();
    }

    public ObservableList<AvailablePlanModel> availablePlans() {
        return readOnlyAvailablePlans;
    }

    public ObservableList<EncounterModel> plannedEncounters() {
        return readOnlyPlannedEncounters;
    }

    public ObservableList<RestGapModel> restGaps() {
        return readOnlyRestGaps;
    }

    public ObservableList<LootModel> lootPlaceholders() {
        return readOnlyLootPlaceholders;
    }

    public void apply(SessionPlannerSnapshot snapshot) {
        SessionPlannerSnapshot safe = snapshot == null ? SessionPlannerSnapshot.empty("") : snapshot;
        party.set(mapParty(safe.party()));
        budget.set(mapBudget(safe.xpBudget()));
        restAdvice.set(mapRestAdvice(safe.restAdvice()));
        goldBudget.set(mapGold(safe.goldBudget()));
        statusText.set(safe.status());
        availablePlans.setAll(safe.availableEncounterPlans().stream()
                .map(SessionPlannerContributionModel::mapAvailablePlan)
                .toList());
        List<SessionPlannerSnapshot.PlannedEncounter> sourceEncounters = safe.plannedEncounters();
        plannedEncounters.setAll(mapEncounters(sourceEncounters));
        restGaps.setAll(safe.restGaps().stream()
                .map(gap -> new RestGapModel(
                        gap.gapIndex(),
                        restLabel(gap.restKind()),
                        gap.restKind() != null && gap.restKind() != SessionPlannerRestKind.NONE))
                .toList());
        lootPlaceholders.setAll(safe.lootPlaceholders().stream()
                .map(loot -> new LootModel(loot.token(), loot.label()))
                .toList());
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

    private static List<EncounterModel> mapEncounters(List<SessionPlannerSnapshot.PlannedEncounter> encounters) {
        List<SessionPlannerSnapshot.PlannedEncounter> safe = encounters == null ? List.of() : List.copyOf(encounters);
        return java.util.stream.IntStream.range(0, safe.size())
                .mapToObj(index -> {
                    SessionPlannerSnapshot.PlannedEncounter encounter = safe.get(index);
                    return new EncounterModel(
                            encounter.token(),
                            encounter.name(),
                            encounter.generatedLabel(),
                            encounter.creatureCount(),
                            encounter.totalBaseXp(),
                            encounter.adjustedXp(),
                            encounter.xpMultiplier(),
                            encounter.difficultyLabel(),
                            index > 0,
                            index < safe.size() - 1);
                })
                .toList();
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
        return INTEGER_FORMAT.format(Math.max(0, value));
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

    public record EncounterModel(
            long token,
            String name,
            String generatedLabel,
            int creatureCount,
            int totalBaseXp,
            int adjustedXp,
            double xpMultiplier,
            String difficultyLabel,
            boolean canMoveUp,
            boolean canMoveDown
    ) {
    }

    public record RestGapModel(
            int gapIndex,
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
