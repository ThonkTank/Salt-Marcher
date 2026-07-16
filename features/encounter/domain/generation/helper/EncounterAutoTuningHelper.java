package features.encounter.domain.generation.helper;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.SplittableRandom;
import features.encounter.domain.generation.EncounterDifficultyIntent;
import features.encounter.domain.generation.EncounterDraft;
import features.encounter.domain.generation.EncounterGenerationAttempt;
import features.encounter.domain.generation.EncounterTuningIntent;

public final class EncounterAutoTuningHelper {

    private EncounterAutoTuningHelper() {
    }

    public static List<EncounterGenerationAttempt> resolveAttempts(
            EncounterDifficultyIntent requestedDifficulty,
            boolean difficultyAuto,
            EncounterTuningIntent requestedTuning,
            long generationSeed,
            int maxAttempts
    ) {
        EncounterDifficultyIntent explicitDifficulty = requestedDifficulty == null
                ? EncounterDifficultyIntent.MEDIUM
                : requestedDifficulty;
        EncounterTuningIntent tuning = requestedTuning == null ? EncounterTuningIntent.defaultIntent() : requestedTuning;
        int limit = Math.max(1, maxAttempts);
        if (!difficultyAuto && !tuning.hasAuto()) {
            return List.of(new EncounterGenerationAttempt(explicitDifficulty, tuning, false));
        }
        return AutoAttemptSequence.resolveAutoAttempts(
                explicitDifficulty,
                difficultyAuto,
                tuning,
                generationSeed,
                limit);
    }

    public static boolean prefersFallbackDrafts(List<EncounterDraft> candidate, List<EncounterDraft> current) {
        return fallbackScore(candidate) > fallbackScore(current);
    }

    private static int fallbackScore(List<EncounterDraft> drafts) {
        return drafts == null || drafts.isEmpty() ? Integer.MIN_VALUE : drafts.getFirst().metrics().score();
    }

    private static final class AutoAttemptSequence {

        private static final List<EncounterDifficultyIntent> AUTO_DIFFICULTIES = List.of(
                EncounterDifficultyIntent.EASY,
                EncounterDifficultyIntent.MEDIUM,
                EncounterDifficultyIntent.HARD,
                EncounterDifficultyIntent.DEADLY);
        private static final int DEFAULT_BALANCE_LEVEL = 3;
        private static final double DEFAULT_AMOUNT_VALUE = 3.0;
        private static final int DEFAULT_DIVERSITY_LEVEL = 2;
        private static final int BALANCE_LEVEL_OPTIONS = 5;
        private static final int AMOUNT_VALUE_OPTIONS = 401;
        private static final int DIVERSITY_LEVEL_OPTIONS = 4;
        private static final int DRAW_LIMIT_MULTIPLIER = 4;

        private static List<EncounterGenerationAttempt> resolveAutoAttempts(
                EncounterDifficultyIntent explicitDifficulty,
                boolean difficultyAuto,
                EncounterTuningIntent tuning,
                long generationSeed,
                int limit
        ) {
            SplittableRandom random = new SplittableRandom(generationSeed == 0L ? 1L : generationSeed);
            List<EncounterGenerationAttempt> attempts = new ArrayList<>();
            Set<String> seen = new LinkedHashSet<>();
            addAttempt(
                    attempts,
                    seen,
                    difficultyAuto ? EncounterDifficultyIntent.MEDIUM : explicitDifficulty,
                    neutralTuning(tuning),
                    true);
            completeAttempts(
                    attempts,
                    seen,
                    random,
                    shuffledDifficulties(random),
                    explicitDifficulty,
                    difficultyAuto,
                    tuning,
                    limit);
            return List.copyOf(attempts);
        }

        private static void completeAttempts(
                List<EncounterGenerationAttempt> attempts,
                Set<String> seen,
                SplittableRandom random,
                List<EncounterDifficultyIntent> difficultyOrder,
                EncounterDifficultyIntent explicitDifficulty,
                boolean difficultyAuto,
                EncounterTuningIntent tuning,
                int limit
        ) {
            int difficultyOptions = difficultyAuto ? AUTO_DIFFICULTIES.size() : 1;
            int balanceOptions = tuning.isBalanceAuto() ? BALANCE_LEVEL_OPTIONS : 1;
            int amountOptions = tuning.isAmountAuto() ? AMOUNT_VALUE_OPTIONS : 1;
            int diversityOptions = tuning.isDiversityAuto() ? DIVERSITY_LEVEL_OPTIONS : 1;
            int maximumAttempts = difficultyOptions * balanceOptions * amountOptions * diversityOptions;
            int remainingDraws = Math.max(limit, maximumAttempts) * DRAW_LIMIT_MULTIPLIER;
            int probeIndex = 0;
            while (attempts.size() < limit && remainingDraws > 0) {
                remainingDraws--;
                if (!addNextAttempt(
                        attempts,
                        seen,
                        random,
                        difficultyOrder,
                        explicitDifficulty,
                        difficultyAuto,
                        tuning,
                        probeIndex)
                        && seen.size() >= maximumAttempts) {
                    break;
                }
                probeIndex++;
            }
        }

        private static boolean addNextAttempt(
                List<EncounterGenerationAttempt> attempts,
                Set<String> seen,
                SplittableRandom random,
                List<EncounterDifficultyIntent> difficultyOrder,
                EncounterDifficultyIntent explicitDifficulty,
                boolean difficultyAuto,
                EncounterTuningIntent tuning,
                int probeIndex
        ) {
            EncounterDifficultyIntent difficulty = difficultyAuto
                    ? difficultyOrder.get(Math.floorMod(probeIndex, difficultyOrder.size()))
                    : explicitDifficulty;
            return addAttempt(attempts, seen, difficulty, nextTuning(tuning, random), true);
        }

        private static EncounterTuningIntent neutralTuning(EncounterTuningIntent tuning) {
            return new EncounterTuningIntent(
                    tuning.isBalanceAuto() ? DEFAULT_BALANCE_LEVEL : tuning.balanceLevel(),
                    tuning.isAmountAuto() ? DEFAULT_AMOUNT_VALUE : tuning.amountValue(),
                    tuning.isDiversityAuto() ? DEFAULT_DIVERSITY_LEVEL : tuning.diversityLevel());
        }

        private static EncounterTuningIntent nextTuning(EncounterTuningIntent tuning, SplittableRandom random) {
            return new EncounterTuningIntent(
                    tuning.isBalanceAuto() ? 1 + random.nextInt(BALANCE_LEVEL_OPTIONS) : tuning.balanceLevel(),
                    tuning.isAmountAuto() ? gaussianLevel(random, DEFAULT_AMOUNT_VALUE, 1.15) : tuning.amountValue(),
                    tuning.isDiversityAuto() ? 1 + random.nextInt(DIVERSITY_LEVEL_OPTIONS) : tuning.diversityLevel());
        }

        private static boolean addAttempt(
                List<EncounterGenerationAttempt> attempts,
                Set<String> seen,
                EncounterDifficultyIntent difficulty,
                EncounterTuningIntent tuning,
                boolean autoResolved
        ) {
            String key = difficulty.name()
                    + ':'
                    + tuning.balanceLevel()
                    + ':'
                    + Math.round(tuning.amountValue() * 100.0)
                    + ':'
                    + tuning.diversityLevel();
            if (!seen.add(key)) {
                return false;
            }
            attempts.add(new EncounterGenerationAttempt(difficulty, tuning, autoResolved));
            return true;
        }

        private static List<EncounterDifficultyIntent> shuffledDifficulties(SplittableRandom random) {
            List<EncounterDifficultyIntent> result = new ArrayList<>(AUTO_DIFFICULTIES);
            for (int index = result.size() - 1; index > 0; index--) {
                int swap = random.nextInt(index + 1);
                EncounterDifficultyIntent current = result.get(index);
                result.set(index, result.get(swap));
                result.set(swap, current);
            }
            return result;
        }

        private static double gaussianLevel(SplittableRandom random, double center, double deviation) {
            double first = Math.max(Double.MIN_VALUE, random.nextDouble());
            double second = random.nextDouble();
            double gaussian = Math.sqrt(-2.0 * Math.log(first)) * Math.cos(2.0 * Math.PI * second);
            return Math.max(1.0, Math.min(5.0, center + gaussian * deviation));
        }
    }
}
