package src.domain.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.application.EncounterGenerationUseCase;
import src.domain.encounter.application.ListSavedEncounterPlansUseCase;
import src.domain.encounter.application.LoadEncounterBudgetUseCase;
import src.domain.encounter.application.LoadEncounterPlanBudgetUseCase;
import src.domain.encounter.application.LoadSavedEncounterPlanUseCase;
import src.domain.encounter.application.SaveEncounterPlanUseCase;
import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.encounter.generation.value.EncounterDifficultyIntent;
import src.domain.encounter.generation.value.EncounterTuningIntent;
import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.plan.value.EncounterPlanCreature;
import src.domain.encounter.plan.value.EncounterPlanSummary;
import src.domain.encounter.published.EncounterBudgetSummary;
import src.domain.encounter.published.EncounterCreature;
import src.domain.encounter.published.EncounterDifficultyBand;
import src.domain.encounter.published.EncounterGenerationAdvisory;
import src.domain.encounter.published.EncounterGenerationDiagnostics;
import src.domain.encounter.published.EncounterGenerationSolutionQuality;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.EncounterGenerationStopCategory;
import src.domain.encounter.published.EncounterGenerationTuning;
import src.domain.encounter.published.EncounterLock;
import src.domain.encounter.published.EncounterPlanBudgetSummary;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encounter.published.GenerateEncounterCommand;
import src.domain.encounter.published.GeneratedEncounter;
import src.domain.encounter.published.SavedEncounterPlan;
import src.domain.encounter.published.SavedEncounterPlanCreature;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.SavedEncounterPlanSummary;

final class EncounterPublishedMapper {

    private EncounterPublishedMapper() {
    }

    static EncounterGenerationUseCase.GenerateRequest toGenerateRequest(GenerateEncounterCommand request) {
        GenerateEncounterCommand effectiveRequest = request == null
                ? new GenerateEncounterCommand(
                        List.of(),
                        List.of(),
                        List.of(),
                        EncounterDifficultyBand.defaultBand(),
                        5,
                        List.of(),
                        List.of())
                : request;
        return new EncounterGenerationUseCase.GenerateRequest(
                effectiveRequest.creatureTypes(),
                effectiveRequest.creatureSubtypes(),
                effectiveRequest.biomes(),
                toDifficultyIntent(effectiveRequest.targetDifficulty()),
                effectiveRequest.targetDifficulty() != null && effectiveRequest.targetDifficulty().isAuto(),
                effectiveRequest.alternativeCount(),
                toTuningIntent(effectiveRequest.tuning()),
                effectiveRequest.generationSeed(),
                effectiveRequest.encounterTableIds(),
                effectiveRequest.excludedCreatureIds(),
                effectiveRequest.lockedCreatures().stream()
                        .filter(Objects::nonNull)
                        .map(EncounterPublishedMapper::toLockedCreature)
                        .toList());
    }

    static @Nullable EncounterBudgetSummary toPublishedBudget(
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

    static @Nullable EncounterBudgetSummary toPublishedBudget(
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

    static @Nullable EncounterPlanBudgetSummary toPublishedPlanBudget(
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

    static EncounterPlanBudgetStatus toPublishedPlanBudgetStatus(
            LoadEncounterPlanBudgetUseCase.Status status
    ) {
        LoadEncounterPlanBudgetUseCase.Status effectiveStatus = status == null
                ? LoadEncounterPlanBudgetUseCase.Status.STORAGE_ERROR
                : status;
        return switch (effectiveStatus) {
            case SUCCESS -> EncounterPlanBudgetStatus.SUCCESS;
            case NOT_FOUND -> EncounterPlanBudgetStatus.NOT_FOUND;
            case NO_ACTIVE_PARTY -> EncounterPlanBudgetStatus.NO_ACTIVE_PARTY;
            case INVALID_REQUEST -> EncounterPlanBudgetStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> EncounterPlanBudgetStatus.STORAGE_ERROR;
        };
    }

    static SavedEncounterPlanStatus toPublishedSavePlanStatus(
            SaveEncounterPlanUseCase.Status status
    ) {
        SaveEncounterPlanUseCase.Status effectiveStatus = status == null
                ? SaveEncounterPlanUseCase.Status.STORAGE_ERROR
                : status;
        return switch (effectiveStatus) {
            case SUCCESS -> SavedEncounterPlanStatus.SUCCESS;
            case INVALID_REQUEST -> SavedEncounterPlanStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> SavedEncounterPlanStatus.STORAGE_ERROR;
        };
    }

    static SavedEncounterPlanStatus toPublishedLoadPlanStatus(
            LoadSavedEncounterPlanUseCase.Status status
    ) {
        LoadSavedEncounterPlanUseCase.Status effectiveStatus = status == null
                ? LoadSavedEncounterPlanUseCase.Status.STORAGE_ERROR
                : status;
        return switch (effectiveStatus) {
            case SUCCESS -> SavedEncounterPlanStatus.SUCCESS;
            case NOT_FOUND -> SavedEncounterPlanStatus.NOT_FOUND;
            case INVALID_REQUEST -> SavedEncounterPlanStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> SavedEncounterPlanStatus.STORAGE_ERROR;
        };
    }

    static SavedEncounterPlanStatus toPublishedListPlansStatus(
            ListSavedEncounterPlansUseCase.Status status
    ) {
        ListSavedEncounterPlansUseCase.Status effectiveStatus = status == null
                ? ListSavedEncounterPlansUseCase.Status.STORAGE_ERROR
                : status;
        return switch (effectiveStatus) {
            case SUCCESS -> SavedEncounterPlanStatus.SUCCESS;
            case STORAGE_ERROR -> SavedEncounterPlanStatus.STORAGE_ERROR;
        };
    }

    static EncounterGenerationStatus mapStatus(EncounterGenerationUseCase.GenerateStatus status) {
        EncounterGenerationUseCase.GenerateStatus effectiveStatus = status == null
                ? EncounterGenerationUseCase.GenerateStatus.STORAGE_ERROR
                : status;
        return switch (effectiveStatus) {
            case SUCCESS -> EncounterGenerationStatus.SUCCESS;
            case NO_ACTIVE_PARTY -> EncounterGenerationStatus.NO_ACTIVE_PARTY;
            case NO_CREATURES -> EncounterGenerationStatus.NO_CREATURES;
            case NO_SOLUTION -> EncounterGenerationStatus.NO_SOLUTION;
            case INVALID_REQUEST -> EncounterGenerationStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> EncounterGenerationStatus.STORAGE_ERROR;
        };
    }

    static EncounterGenerationStatus mapBudgetStatus(LoadEncounterBudgetUseCase.Status status) {
        LoadEncounterBudgetUseCase.Status effectiveStatus = status == null
                ? LoadEncounterBudgetUseCase.Status.STORAGE_ERROR
                : status;
        return switch (effectiveStatus) {
            case SUCCESS -> EncounterGenerationStatus.SUCCESS;
            case NO_ACTIVE_PARTY -> EncounterGenerationStatus.NO_ACTIVE_PARTY;
            case STORAGE_ERROR -> EncounterGenerationStatus.STORAGE_ERROR;
        };
    }

    static GeneratedEncounter toPublishedEncounter(EncounterGenerationUseCase.GeneratedEncounterData encounter) {
        return new GeneratedEncounter(
                encounter.title(),
                toPublishedDifficulty(encounter.achievedDifficulty()),
                encounter.creatureCount(),
                encounter.totalBaseXp(),
                encounter.adjustedXp(),
                encounter.xpMultiplier(),
                encounter.highlights(),
                encounter.creatures().stream().map(EncounterPublishedMapper::toPublishedCreature).toList());
    }

    static @Nullable EncounterGenerationDiagnostics toPublishedDiagnostics(
            EncounterGenerationUseCase.@Nullable GenerationDiagnostics diagnostics
    ) {
        if (diagnostics == null) {
            return null;
        }
        return new EncounterGenerationDiagnostics(
                toPublishedDifficulty(diagnostics.resolvedDifficulty()),
                toPublishedTuning(diagnostics.resolvedTuning()),
                toPublishedQuality(diagnostics.solutionQuality()),
                toPublishedStopCategory(diagnostics.stopCategory()),
                diagnostics.candidatePoolSize(),
                diagnostics.attempts(),
                diagnostics.candidateEvaluations());
    }

    static EncounterTuningPreviewLabels tuningPreviewLabels(@Nullable EncounterBudgetSummary budget) {
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

    static SavedEncounterPlan toPublishedPlan(EncounterPlan plan) {
        return new SavedEncounterPlan(
                plan.id(),
                plan.name(),
                plan.generatedLabel(),
                plan.creatures().stream()
                        .map(creature -> new SavedEncounterPlanCreature(
                                creature.creatureId(),
                                creature.quantity()))
                        .toList());
    }

    static SavedEncounterPlanSummary toPublishedSummary(EncounterPlanSummary summary) {
        return new SavedEncounterPlanSummary(
                summary.id(),
                summary.name(),
                summary.generatedLabel(),
                summary.creatureCount());
    }

    static EncounterPlanCreature toPlanCreature(SavedEncounterPlanCreature creature) {
        return new EncounterPlanCreature(creature.creatureId(), creature.quantity());
    }

    static EncounterGenerationAdvisory toPublishedAdvisory(
            EncounterGenerationUseCase.GenerationAdvisory advisory
    ) {
        if (advisory == EncounterGenerationUseCase.GenerationAdvisory.AUTO_RESOLVED) {
            return EncounterGenerationAdvisory.AUTO_RESOLVED;
        }
        return EncounterGenerationAdvisory.FALLBACK_USED;
    }

    private static EncounterGenerationUseCase.LockedCreature toLockedCreature(EncounterLock lock) {
        return new EncounterGenerationUseCase.LockedCreature(lock.creatureId(), lock.quantity());
    }

    private static EncounterDifficultyBand toPublishedDifficulty(EncounterDifficultyIntent intent) {
        EncounterDifficultyIntent effectiveIntent = intent == null ? EncounterDifficultyIntent.MEDIUM : intent;
        return switch (effectiveIntent) {
            case EASY -> EncounterDifficultyBand.EASY;
            case MEDIUM -> EncounterDifficultyBand.MEDIUM;
            case HARD -> EncounterDifficultyBand.HARD;
            case DEADLY -> EncounterDifficultyBand.DEADLY;
        };
    }

    private static EncounterDifficultyIntent toDifficultyIntent(EncounterDifficultyBand band) {
        EncounterDifficultyBand effectiveBand = band == null ? EncounterDifficultyBand.defaultBand() : band;
        return switch (effectiveBand) {
            case AUTO -> EncounterDifficultyIntent.MEDIUM;
            case EASY -> EncounterDifficultyIntent.EASY;
            case MEDIUM -> EncounterDifficultyIntent.MEDIUM;
            case HARD -> EncounterDifficultyIntent.HARD;
            case DEADLY -> EncounterDifficultyIntent.DEADLY;
        };
    }

    private static EncounterGenerationTuning toPublishedTuning(EncounterTuningIntent tuning) {
        EncounterTuningIntent effective = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
        return new EncounterGenerationTuning(
                effective.balanceLevel(),
                effective.amountValue(),
                effective.diversityLevel());
    }

    private static EncounterTuningIntent toTuningIntent(EncounterGenerationTuning tuning) {
        EncounterGenerationTuning effective = tuning == null ? EncounterGenerationTuning.defaultTuning() : tuning;
        return new EncounterTuningIntent(
                effective.balanceLevel(),
                effective.amountValue(),
                effective.diversityLevel());
    }

    private static EncounterCreature toPublishedCreature(EncounterGenerationUseCase.EncounterCreatureData creature) {
        return new EncounterCreature(
                creature.creatureId(),
                creature.name(),
                creature.challengeRating(),
                creature.xp(),
                creature.quantity(),
                creature.role(),
                creature.tags());
    }

    private static EncounterGenerationSolutionQuality toPublishedQuality(
            EncounterGenerationUseCase.GenerationSolutionQuality quality
    ) {
        if (quality == EncounterGenerationUseCase.GenerationSolutionQuality.EXACT) {
            return EncounterGenerationSolutionQuality.EXACT;
        }
        return EncounterGenerationSolutionQuality.FALLBACK;
    }

    private static EncounterGenerationStopCategory toPublishedStopCategory(
            EncounterGenerationUseCase.GenerationStopCategory category
    ) {
        if (category == EncounterGenerationUseCase.GenerationStopCategory.COMPLETED) {
            return EncounterGenerationStopCategory.COMPLETED;
        }
        return EncounterGenerationStopCategory.SEARCH_EXHAUSTED;
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
