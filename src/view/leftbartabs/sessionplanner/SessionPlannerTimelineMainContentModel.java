package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.sessionplanner.published.SessionPlannerEncountersProjection;
import src.domain.sessionplanner.published.SessionPlannerRestKind;

public final class SessionPlannerTimelineMainContentModel {

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.empty());

    ReadOnlyObjectProperty<Projection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void applyEncounters(SessionPlannerEncountersProjection encountersProjection) {
        projection.set(Projection.from(encountersProjection));
    }

    record Projection(
            List<Projection.EncounterModel> encounters,
            List<Projection.RestGapModel> restGaps,
            List<Projection.LootModel> lootPlaceholders,
            String lootEmptyMessage
    ) {

        Projection {
            encounters = safeCopy(encounters);
            restGaps = safeCopy(restGaps);
            lootPlaceholders = safeCopy(lootPlaceholders);
            lootEmptyMessage = safeText(lootEmptyMessage);
        }

        static Projection empty() {
            return new Projection(List.of(), List.of(), List.of(), "Keine Loot-Platzhalter angelegt.");
        }

        static Projection from(SessionPlannerEncountersProjection projection) {
            SessionPlannerEncountersProjection safe =
                    projection == null ? SessionPlannerEncountersProjection.empty() : projection;
            return new Projection(
                    mapEncounters(safe.plannedEncounters()),
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
                            .toList(),
                    "Keine Loot-Platzhalter angelegt.");
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
}
