package src.domain.encounter.application;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.generation.value.EncounterDifficultyIntent;
import src.domain.encounter.generation.value.EncounterGenerationInputs;
import src.domain.encounter.generation.value.EncounterGenerationRequest;
import src.domain.encounter.generation.value.EncounterLockedCreature;
import src.domain.encounter.generation.value.EncounterRequestedDifficulty;
import src.domain.encounter.generation.value.EncounterTuningIntent;
import src.domain.encounter.published.EncounterCreature;
import src.domain.encounter.published.EncounterDifficultyBand;
import src.domain.encounter.published.EncounterGenerationAdvisory;
import src.domain.encounter.published.EncounterGenerationDiagnostics;
import src.domain.encounter.published.EncounterGenerationSolutionQuality;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.EncounterGenerationStopCategory;
import src.domain.encounter.published.EncounterGenerationTuning;
import src.domain.encounter.published.EncounterLock;
import src.domain.encounter.published.GenerateEncounterCommand;
import src.domain.encounter.published.GeneratedEncounter;

public final class EncounterGenerationBoundaryTranslator {

    private EncounterGenerationBoundaryTranslator() {
    }

    public static EncounterGenerationRequest toGenerateRequest(GenerateEncounterCommand request) {
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
        return new EncounterGenerationRequest(
                new EncounterGenerationInputs(
                        effectiveRequest.creatureTypes(),
                        effectiveRequest.creatureSubtypes(),
                        effectiveRequest.biomes(),
                        toRequestedDifficulty(effectiveRequest.targetDifficulty()),
                        toTuningIntent(effectiveRequest.tuning()),
                        effectiveRequest.encounterTableIds()),
                effectiveRequest.alternativeCount(),
                effectiveRequest.generationSeed(),
                effectiveRequest.excludedCreatureIds(),
                effectiveRequest.lockedCreatures().stream()
                        .filter(Objects::nonNull)
                        .map(EncounterGenerationBoundaryTranslator::toLockedCreature)
                        .toList());
    }

    public static EncounterGenerationStatus mapStatus(EncounterGenerationUseCase.GenerateStatus status) {
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

    public static GeneratedEncounter toPublishedEncounter(EncounterGenerationUseCase.GeneratedEncounterData encounter) {
        return new GeneratedEncounter(
                encounter.title(),
                toPublishedDifficulty(encounter.achievedDifficulty()),
                encounter.creatureCount(),
                encounter.totalBaseXp(),
                encounter.adjustedXp(),
                encounter.xpMultiplier(),
                encounter.highlights(),
                encounter.creatures().stream().map(EncounterGenerationBoundaryTranslator::toPublishedCreature).toList());
    }

    public static @Nullable EncounterGenerationDiagnostics toPublishedDiagnostics(
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

    public static EncounterGenerationAdvisory toPublishedAdvisory(
            EncounterGenerationUseCase.GenerationAdvisory advisory
    ) {
        if (advisory == EncounterGenerationUseCase.GenerationAdvisory.AUTO_RESOLVED) {
            return EncounterGenerationAdvisory.AUTO_RESOLVED;
        }
        return EncounterGenerationAdvisory.FALLBACK_USED;
    }

    private static EncounterLockedCreature toLockedCreature(EncounterLock lock) {
        return new EncounterLockedCreature(lock.creatureId(), lock.quantity());
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

    private static EncounterRequestedDifficulty toRequestedDifficulty(EncounterDifficultyBand band) {
        EncounterDifficultyBand effectiveBand = band == null ? EncounterDifficultyBand.defaultBand() : band;
        return switch (effectiveBand) {
            case AUTO -> EncounterRequestedDifficulty.AUTO;
            case EASY -> EncounterRequestedDifficulty.EASY;
            case MEDIUM -> EncounterRequestedDifficulty.MEDIUM;
            case HARD -> EncounterRequestedDifficulty.HARD;
            case DEADLY -> EncounterRequestedDifficulty.DEADLY;
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
}
