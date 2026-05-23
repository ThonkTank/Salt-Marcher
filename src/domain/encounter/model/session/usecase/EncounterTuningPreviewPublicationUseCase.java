package src.domain.encounter.model.session.usecase;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.helper.EncounterDifficultyMathHelper;
import src.domain.encounter.model.generation.model.EncounterBudgetSummary;
import src.domain.encounter.model.generation.model.EncounterDifficultyThresholds;
import src.domain.encounter.model.generation.model.EncounterRequestedDifficulty;
import src.domain.encounter.model.session.model.EncounterTuningPreviewData;
import src.domain.encounter.model.session.model.PartyBudgetFacts;

final class EncounterTuningPreviewPublicationUseCase {

    private static final String TUNING_PREVIEW_LOAD_FAILED = "Encounter tuning preview could not be loaded.";
    private static final String TUNING_PREVIEW_NOT_REGISTERED = "Encounter tuning preview service is not registered.";

    private final @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase;

    EncounterTuningPreviewPublicationUseCase(@Nullable LoadEncounterBudgetUseCase loadBudgetUseCase) {
        this.loadBudgetUseCase = loadBudgetUseCase;
    }

    EncounterTuningPreviewData toData() {
        return toTuningPreviewData(loadBudgetResult());
    }

    private LoadEncounterBudgetUseCase.Result loadBudgetResult() {
        if (loadBudgetUseCase == null) {
            return new LoadEncounterBudgetUseCase.Result(
                    PartyBudgetFacts.Status.STORAGE_ERROR,
                    emptyBudgetSummary(),
                    TUNING_PREVIEW_NOT_REGISTERED);
        }
        try {
            return loadBudgetUseCase.execute();
        } catch (IllegalStateException exception) {
            return new LoadEncounterBudgetUseCase.Result(
                    PartyBudgetFacts.Status.STORAGE_ERROR,
                    emptyBudgetSummary(),
                    TUNING_PREVIEW_LOAD_FAILED);
        }
    }

    private static EncounterTuningPreviewData toTuningPreviewData(LoadEncounterBudgetUseCase.Result result) {
        if (result == null) {
            EncounterTuningPreviewData labels = tuningPreviewLabels(emptyBudgetSummary());
            return EncounterTuningPreviewData.storageError(
                    labels.difficultyLabels(),
                    labels.balanceLabels(),
                    labels.amountLabels(),
                    labels.diversityLabels(),
                    TUNING_PREVIEW_NOT_REGISTERED);
        }
        EncounterTuningPreviewData labels = tuningPreviewLabels(result.budget() == null ? emptyBudgetSummary() : result.budget());
        return toData(result.status(), labels, result.message());
    }

    private static EncounterTuningPreviewData toData(
            PartyBudgetFacts.Status status,
            EncounterTuningPreviewData labels,
        String message
    ) {
        if (status == null) {
            return EncounterTuningPreviewData.storageError(
                    labels.difficultyLabels(),
                    labels.balanceLabels(),
                    labels.amountLabels(),
                    labels.diversityLabels(),
                    message);
        }
        return switch (status) {
            case SUCCESS -> EncounterTuningPreviewData.available(
                    labels.difficultyLabels(),
                    labels.balanceLabels(),
                    labels.amountLabels(),
                    labels.diversityLabels(),
                    message);
            case NO_ACTIVE_PARTY -> EncounterTuningPreviewData.noActiveParty(
                    labels.difficultyLabels(),
                    labels.balanceLabels(),
                    labels.amountLabels(),
                    labels.diversityLabels(),
                    message);
            case STORAGE_ERROR -> EncounterTuningPreviewData.storageError(
                    labels.difficultyLabels(),
                    labels.balanceLabels(),
                    labels.amountLabels(),
                    labels.diversityLabels(),
                    message);
        };
    }

    private static EncounterTuningPreviewData tuningPreviewLabels(EncounterBudgetSummary budget) {
        int averageLevel = budget == null ? 1 : Math.max(1, Math.min(20, budget.averagePartyLevel()));
        int partySize = budget == null || budget.activePartyLevels().isEmpty()
                ? 1
                : Math.max(1, budget.activePartyLevels().size());
        return EncounterTuningPreviewData.available(
                List.of(
                        previewLabel(1.0, difficultyRangeLabel(EncounterRequestedDifficulty.EASY, averageLevel, partySize)),
                        previewLabel(2.0, difficultyRangeLabel(EncounterRequestedDifficulty.MEDIUM, averageLevel, partySize)),
                        previewLabel(3.0, difficultyRangeLabel(EncounterRequestedDifficulty.HARD, averageLevel, partySize)),
                        previewLabel(4.0, difficultyRangeLabel(EncounterRequestedDifficulty.DEADLY, averageLevel, partySize))),
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
                        previewLabel(4.0, "4 Typen")),
                "");
    }

    private static EncounterTuningPreviewData.PreviewPoint previewLabel(double value, String label) {
        return new EncounterTuningPreviewData.PreviewPoint(value, label);
    }

    private static String difficultyRangeLabel(EncounterRequestedDifficulty band, int averageLevel, int partySize) {
        DifficultyPreviewRange range = difficultyPreviewRange(band, averageLevel, partySize);
        return range.lowerAdjustedXp() + "-" + range.upperAdjustedXp() + " XP";
    }

    private static DifficultyPreviewRange difficultyPreviewRange(
            EncounterRequestedDifficulty band,
            int averageLevel,
            int partySize
    ) {
        EncounterDifficultyThresholds thresholds = thresholdsForAverageParty(averageLevel, partySize);
        int deadly125 = (int) Math.round(thresholds.deadly() * 1.25);
        EncounterRequestedDifficulty effectiveBand = band == null ? EncounterRequestedDifficulty.MEDIUM : band;
        if (effectiveBand == EncounterRequestedDifficulty.EASY) {
            return new DifficultyPreviewRange(thresholds.easy(), Math.max(thresholds.easy(), thresholds.medium() - 1));
        }
        if (effectiveBand == EncounterRequestedDifficulty.HARD) {
            return new DifficultyPreviewRange(thresholds.hard(), Math.max(thresholds.hard(), thresholds.deadly() - 1));
        }
        if (effectiveBand == EncounterRequestedDifficulty.DEADLY) {
            return new DifficultyPreviewRange(thresholds.deadly(), Math.max(thresholds.deadly(), deadly125));
        }
        return new DifficultyPreviewRange(thresholds.medium(), Math.max(thresholds.medium(), thresholds.hard() - 1));
    }

    private static EncounterDifficultyThresholds thresholdsForAverageParty(int averageLevel, int partySize) {
        int level = Math.max(1, Math.min(20, averageLevel));
        int size = Math.max(1, partySize);
        List<Integer> partyLevels = new java.util.ArrayList<>(size);
        for (int index = 0; index < size; index++) {
            partyLevels.add(level);
        }
        return EncounterDifficultyMathHelper.thresholdsFor(partyLevels);
    }

    private static EncounterBudgetSummary emptyBudgetSummary() {
        return new EncounterBudgetSummary(List.of(), 1, 0, 0, 0, 0, 0, 0, 0);
    }

    private record DifficultyPreviewRange(int lowerAdjustedXp, int upperAdjustedXp) {
    }
}
