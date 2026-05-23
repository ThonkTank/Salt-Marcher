package src.domain.encounter.model.generation.usecase;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.helper.EncounterAutoTuningHelper;
import src.domain.encounter.model.generation.helper.EncounterDraftAssemblyHelper;
import src.domain.encounter.model.generation.model.EncounterCandidateProfile;
import src.domain.encounter.model.generation.model.EncounterDifficultyThresholds;
import src.domain.encounter.model.generation.model.EncounterDraft;
import src.domain.encounter.model.generation.model.EncounterDraftGenerationModel;
import src.domain.encounter.model.generation.model.EncounterGenerationAttempt;
import src.domain.encounter.model.generation.model.EncounterGenerationDiagnosticsData;
import src.domain.encounter.model.generation.model.EncounterGenerationRequest;

final class EncounterGenerationSearchUseCase {

    private static final int AUTO_ATTEMPT_LIMIT = 12;
    private static final long NO_GENERATION_SEED = 0L;

    private EncounterGenerationSearchUseCase() {
    }

    static GenerationSearchResult generateDrafts(
            EncounterGenerationRequest request,
            EncounterDifficultyThresholds thresholds,
            int partySize,
            EncounterGenerationLockedCreatureUseCase.LockedCreatures lockedCreatures,
            List<EncounterCandidateProfile> unlockedProfiles
    ) {
        List<EncounterGenerationAttempt> attempts = EncounterAutoTuningHelper.resolveAttempts(
                request.targetDifficulty(),
                request.targetDifficultyAuto(),
                request.tuning(),
                effectiveSeed(request),
                AUTO_ATTEMPT_LIMIT);
        SearchAccumulator accumulator =
                SearchAccumulator.empty(lockedCreatures.lockedProfiles().size() + unlockedProfiles.size());
        for (EncounterGenerationAttempt attempt : attempts) {
            List<EncounterDraft> drafts = EncounterDraftAssemblyHelper.createDrafts(new EncounterDraftGenerationModel(
                    attempt.targetDifficulty(),
                    thresholds,
                    partySize,
                    attempt.tuning(),
                    lockedCreatures.lockedProfiles().values(),
                    lockedCreatures.lockedQuantities(),
                    unlockedProfiles));
            accumulator = accumulator.record(attempt, drafts);
            List<EncounterDraft> exactDrafts = exactDrafts(drafts, attempt);
            if (!exactDrafts.isEmpty()) {
                return accumulator.exact(attempt, exactDrafts);
            }
        }
        return accumulator.fallback();
    }

    private static List<EncounterDraft> exactDrafts(
            List<EncounterDraft> drafts,
            EncounterGenerationAttempt attempt
    ) {
        List<EncounterDraft> exactDrafts = new ArrayList<>();
        for (EncounterDraft draft : drafts) {
            if (draft.achievedDifficulty() == attempt.targetDifficulty()) {
                exactDrafts.add(draft);
            }
        }
        return exactDrafts;
    }

    private static long effectiveSeed(EncounterGenerationRequest request) {
        if (request.generationSeed() > NO_GENERATION_SEED) {
            return request.generationSeed();
        }
        return Integer.toUnsignedLong(Objects.hash(
                request.creatureTypes(),
                request.creatureSubtypes(),
                request.biomes(),
                request.targetDifficulty(),
                request.targetDifficultyAuto(),
                request.tuning(),
                request.encounterTableIds(),
                request.excludedCreatureIds(),
                request.lockedCreatures()));
    }

    private record SearchAccumulator(
            int candidatePoolSize,
            int attempts,
            int candidateEvaluations,
            @Nullable EncounterGenerationAttempt bestFallbackAttempt,
            List<EncounterDraft> bestFallbackDrafts
    ) {

        private static SearchAccumulator empty(int candidatePoolSize) {
            return new SearchAccumulator(candidatePoolSize, 0, 0, null, List.of());
        }

        private SearchAccumulator record(EncounterGenerationAttempt attempt, List<EncounterDraft> drafts) {
            List<EncounterDraft> safeDrafts = drafts == null ? List.of() : List.copyOf(drafts);
            if (safeDrafts.isEmpty()) {
                return new SearchAccumulator(
                        candidatePoolSize,
                        attempts + 1,
                        candidateEvaluations,
                        bestFallbackAttempt,
                        bestFallbackDrafts);
            }
            EncounterGenerationAttempt nextFallbackAttempt = bestFallbackAttempt;
            List<EncounterDraft> nextFallbackDrafts = bestFallbackDrafts;
            if (nextFallbackDrafts.isEmpty()
                    || EncounterAutoTuningHelper.prefersFallbackDrafts(safeDrafts, nextFallbackDrafts)) {
                nextFallbackAttempt = attempt;
                nextFallbackDrafts = safeDrafts;
            }
            return new SearchAccumulator(
                    candidatePoolSize,
                    attempts + 1,
                    candidateEvaluations + safeDrafts.size(),
                    nextFallbackAttempt,
                    nextFallbackDrafts);
        }

        private GenerationSearchResult exact(EncounterGenerationAttempt attempt, List<EncounterDraft> drafts) {
            return result(attempt, drafts, false, "Encounter options generated.");
        }

        private GenerationSearchResult fallback() {
            if (bestFallbackAttempt == null || bestFallbackDrafts.isEmpty()) {
                return new GenerationSearchResult(
                        List.of(),
                        null,
                        false,
                        false,
                        "No encounter compositions fit the current request.");
            }
            return result(
                    bestFallbackAttempt,
                    bestFallbackDrafts,
                    true,
                    "No exact target found; best fallback encounter options generated.");
        }

        private GenerationSearchResult result(
                EncounterGenerationAttempt attempt,
                List<EncounterDraft> drafts,
                boolean fallbackUsed,
                String message
        ) {
            return new GenerationSearchResult(
                    drafts,
                    new EncounterGenerationDiagnosticsData(
                            attempt.targetDifficulty(),
                            attempt.tuning(),
                            candidatePoolSize,
                            attempts,
                            candidateEvaluations),
                    attempt.autoResolved(),
                    fallbackUsed,
                    message);
        }
    }

    record GenerationSearchResult(
            List<EncounterDraft> drafts,
            @Nullable EncounterGenerationDiagnosticsData diagnostics,
            boolean autoResolved,
            boolean fallbackUsed,
            String message
    ) {

        GenerationSearchResult {
            drafts = drafts == null ? List.of() : List.copyOf(drafts);
            message = message == null ? "" : message;
        }
    }
}
