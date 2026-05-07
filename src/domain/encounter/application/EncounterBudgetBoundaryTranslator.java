package src.domain.encounter.application;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.encounter.published.EncounterBudgetSummary;
import src.domain.encounter.published.EncounterDifficultyBand;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.EncounterPlanBudgetSummary;
import src.domain.encounter.published.EncounterTuningPreviewLabels;

public final class EncounterBudgetBoundaryTranslator {

    private EncounterBudgetBoundaryTranslator() {
    }

    public static @Nullable EncounterBudgetSummary toPublishedBudget(
            EncounterGenerationUseCase.@Nullable BudgetSummary budget
    ) {
        if (budget == null) {
            return null;
        }
        return new EncounterBudgetSummary(
                budget.partyLevels(),
                budget.averageLevel(),
                budget.easyXp(),
                budget.mediumXp(),
                budget.hardXp(),
                budget.deadlyXp(),
                budget.dailyBudgetXp(),
                budget.consumedDailyXp(),
                budget.remainingDailyXp());
    }

    public static @Nullable EncounterBudgetSummary toPublishedBudget(
            EncounterDifficultyMath.@Nullable BudgetSummary budget
    ) {
        if (budget == null) {
            return null;
        }
        return new EncounterBudgetSummary(
                budget.activePartyLevels(),
                budget.averagePartyLevel(),
                budget.easyThreshold(),
                budget.mediumThreshold(),
                budget.hardThreshold(),
                budget.deadlyThreshold(),
                budget.dailyBudgetXp(),
                budget.consumedDailyXp(),
                budget.remainingDailyXp());
    }

    public static @Nullable EncounterPlanBudgetSummary toPublishedPlanBudget(
            LoadEncounterPlanBudgetUseCase.@Nullable Summary summary
    ) {
        if (summary == null) {
            return null;
        }
        return new EncounterPlanBudgetSummary(
                summary.planId(),
                summary.name(),
                summary.generatedLabel(),
                summary.partyLevels(),
                summary.averageLevel(),
                summary.easyXp(),
                summary.mediumXp(),
                summary.hardXp(),
                summary.deadlyXp(),
                summary.creatureCount(),
                summary.totalBaseXp(),
                summary.adjustedXp(),
                summary.xpMultiplier(),
                summary.difficultyLabel());
    }

    public static EncounterPlanBudgetStatus toPublishedPlanBudgetStatus(
            LoadEncounterPlanBudgetUseCase.Status status
    ) {
        return EncounterPlanBudgetStatus.valueOf(status == null ? "STORAGE_ERROR" : status.name());
    }

    public static EncounterGenerationStatus mapBudgetStatus(LoadEncounterBudgetUseCase.Status status) {
        return EncounterGenerationStatus.valueOf(status == null ? "STORAGE_ERROR" : status.name());
    }

    public static EncounterTuningPreviewLabels tuningPreviewLabels(@Nullable EncounterBudgetSummary budget) {
        int averageLevel = budget == null ? 1 : Math.max(1, Math.min(20, budget.averageLevel()));
        int partySize = budget == null || budget.partyLevels().isEmpty() ? 1 : Math.max(1, budget.partyLevels().size());
        return new EncounterTuningPreviewLabels(
                List.of(
                        previewLabel(1.0, difficultyRangeLabel(EncounterDifficultyBand.EASY, averageLevel, partySize)),
                        previewLabel(2.0, difficultyRangeLabel(EncounterDifficultyBand.MEDIUM, averageLevel, partySize)),
                        previewLabel(3.0, difficultyRangeLabel(EncounterDifficultyBand.HARD, averageLevel, partySize)),
                        previewLabel(4.0, difficultyRangeLabel(EncounterDifficultyBand.DEADLY, averageLevel, partySize))),
                List.of(
                        previewLabel(1.0, "Extreme++"),
                        previewLabel(2.0, "Extreme+"),
                        previewLabel(3.0, "Neutral"),
                        previewLabel(4.0, "Durchschnitt+"),
                        previewLabel(5.0, "Durchschnitt++")),
                List.of(
                        previewLabel(1.0, "Boss++"),
                        previewLabel(2.0, "Boss+"),
                        previewLabel(3.0, "Ausgeglichen"),
                        previewLabel(4.0, "Minions+"),
                        previewLabel(5.0, "Minions++")),
                List.of(
                        previewLabel(1.0, "1 Typ"),
                        previewLabel(2.0, "2 Typen"),
                        previewLabel(3.0, "3 Typen"),
                        previewLabel(4.0, "4 Typen")));
    }

    private static EncounterTuningPreviewLabels.PreviewLabel previewLabel(double value, String label) {
        return new EncounterTuningPreviewLabels.PreviewLabel(value, label);
    }

    private static String difficultyRangeLabel(EncounterDifficultyBand band, int averageLevel, int partySize) {
        DifficultyPreviewRange range = difficultyPreviewRange(band, averageLevel, partySize);
        return range.lowerAdjustedXp() + "-" + range.upperAdjustedXp() + " XP";
    }

    private static DifficultyPreviewRange difficultyPreviewRange(
            EncounterDifficultyBand band,
            int averageLevel,
            int partySize
    ) {
        EncounterDifficultyMath.Thresholds thresholds = thresholdsForAverageParty(averageLevel, partySize);
        int deadly125 = (int) Math.round(thresholds.deadly() * 1.25);
        EncounterDifficultyBand effectiveBand = band == null ? EncounterDifficultyBand.MEDIUM : band;
        return switch (effectiveBand) {
            case EASY -> new DifficultyPreviewRange(
                    thresholds.easy(),
                    Math.max(thresholds.easy(), thresholds.medium() - 1));
            case MEDIUM, AUTO -> new DifficultyPreviewRange(
                    thresholds.medium(),
                    Math.max(thresholds.medium(), thresholds.hard() - 1));
            case HARD -> new DifficultyPreviewRange(
                    thresholds.hard(),
                    Math.max(thresholds.hard(), thresholds.deadly() - 1));
            case DEADLY -> new DifficultyPreviewRange(
                    thresholds.deadly(),
                    Math.max(thresholds.deadly(), deadly125));
        };
    }

    private static EncounterDifficultyMath.Thresholds thresholdsForAverageParty(int averageLevel, int partySize) {
        int level = Math.max(1, Math.min(20, averageLevel));
        int size = Math.max(1, partySize);
        List<Integer> partyLevels = new ArrayList<>(size);
        for (int index = 0; index < size; index++) {
            partyLevels.add(level);
        }
        return EncounterDifficultyMath.thresholdsFor(partyLevels);
    }

    private record DifficultyPreviewRange(int lowerAdjustedXp, int upperAdjustedXp) {
    }
}
